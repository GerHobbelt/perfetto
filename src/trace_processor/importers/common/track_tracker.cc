/*
 * Copyright (C) 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include "src/trace_processor/importers/common/track_tracker.h"

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <utility>

#include "perfetto/base/compiler.h"
#include "perfetto/base/logging.h"
#include "perfetto/ext/base/string_utils.h"
#include "perfetto/ext/base/string_view.h"
#include "src/trace_processor/importers/common/args_tracker.h"
#include "src/trace_processor/importers/common/cpu_tracker.h"
#include "src/trace_processor/importers/common/process_track_translation_table.h"
#include "src/trace_processor/importers/common/track_classification.h"
#include "src/trace_processor/storage/trace_storage.h"
#include "src/trace_processor/tables/profiler_tables_py.h"
#include "src/trace_processor/tables/track_tables_py.h"
#include "src/trace_processor/types/trace_processor_context.h"
#include "src/trace_processor/types/variadic.h"

namespace perfetto::trace_processor {
namespace {

const char* GetNameForGroup(TrackTracker::Group group) {
  switch (group) {
    case TrackTracker::Group::kMemory:
      return "Memory";
    case TrackTracker::Group::kIo:
      return "IO";
    case TrackTracker::Group::kVirtio:
      return "Virtio";
    case TrackTracker::Group::kNetwork:
      return "Network";
    case TrackTracker::Group::kPower:
      return "Power";
    case TrackTracker::Group::kDeviceState:
      return "Device State";
    case TrackTracker::Group::kThermals:
      return "Thermals";
    case TrackTracker::Group::kClockFrequency:
      return "Clock Freqeuncy";
    case TrackTracker::Group::kBatteryMitigation:
      return "Battery Mitigation";
    case TrackTracker::Group::kSizeSentinel:
      PERFETTO_FATAL("Unexpected size passed as group");
  }
  PERFETTO_FATAL("For GCC");
}

bool IsLegacyStringIdNameAllowed(TrackClassification classification) {
  // **DO NOT** add new values here. Use TrackTracker::AutoName instead.
  return classification ==
             TrackClassification::kAndroidEnergyEstimationBreakdown ||
         classification ==
             TrackClassification::kAndroidEnergyEstimationBreakdownPerUid ||
         classification == TrackClassification::kUnknown;
}

bool IsLegacyCharArrayNameAllowed(TrackClassification classification) {
  // **DO NOT** add new values here. Use TrackTracker::AutoName instead.
  return classification == TrackClassification::kTrigger ||
         classification == TrackClassification::kInterconnect ||
         classification == TrackClassification::kLinuxRuntimePowerManagement ||
         classification == TrackClassification::kIrqCpu ||
         classification == TrackClassification::kSoftirqCpu ||
         classification == TrackClassification::kNapiGroCpu ||
         classification == TrackClassification::kFuncgraphCpu ||
         classification == TrackClassification::kMaliIrqCpu ||
         classification == TrackClassification::kPkvmHypervisor ||
         classification == TrackClassification::kCpuFrequency ||
         classification == TrackClassification::kCpuFrequencyThrottle ||
         classification == TrackClassification::kCpuIdle ||
         classification == TrackClassification::kUserTime ||
         classification == TrackClassification::kSystemModeTime ||
         classification == TrackClassification::kCpuIdleTime ||
         classification == TrackClassification::kIoWaitTime ||
         classification == TrackClassification::kIrqTime ||
         classification == TrackClassification::kSoftIrqTime ||
         classification == TrackClassification::kIrqCounter ||
         classification == TrackClassification::kSoftirqCounter ||
         classification == TrackClassification::kCpuUtilization ||
         classification == TrackClassification::kCpuCapacity ||
         classification == TrackClassification::kCpuNumberRunning ||
         classification == TrackClassification::kCpuMaxFrequencyLimit ||
         classification == TrackClassification::kCpuMinFrequencyLimit;
}

}  // namespace

TrackTracker::TrackTracker(TraceProcessorContext* context)
    : source_key_(context->storage->InternString("source")),
      trace_id_key_(context->storage->InternString("trace_id")),
      trace_id_is_process_scoped_key_(
          context->storage->InternString("trace_id_is_process_scoped")),
      source_scope_key_(context->storage->InternString("source_scope")),
      category_key_(context->storage->InternString("category")),
      scope_id_(context->storage->InternString("scope")),
      cookie_id_(context->storage->InternString("cookie")),
      fuchsia_source_(context->storage->InternString("fuchsia")),
      chrome_source_(context->storage->InternString("chrome")),
      utid_id_(context->storage->InternString("utid")),
      upid_id_(context->storage->InternString("upid")),
      ucpu_id_(context->storage->InternString("ucpu")),
      uid_id_(context->storage->InternString("uid")),
      gpu_id_(context->storage->InternString("gpu")),
      name_id_(context->storage->InternString("name")),
      context_(context) {}

TrackId TrackTracker::CreateTrack(TrackClassification classification,
                                  std::optional<Dimensions> dimensions,
                                  const TrackName& name) {
  tables::TrackTable::Row row(StringIdFromTrackName(classification, name));
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  if (dimensions) {
    row.dimension_arg_set_id = dimensions->arg_set_id;
  }
  row.machine_id = context_->machine_id();

  return context_->storage->mutable_track_table()->Insert(row).id;
}

TrackId TrackTracker::CreateCounterTrack(TrackClassification classification,
                                         std::optional<Dimensions> dimensions,
                                         const TrackName& name) {
  tables::CounterTrackTable::Row row(
      StringIdFromTrackName(classification, name));
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  if (dimensions) {
    row.dimension_arg_set_id = dimensions->arg_set_id;
  }
  row.machine_id = context_->machine_id();

  return context_->storage->mutable_counter_track_table()->Insert(row).id;
}

TrackId TrackTracker::CreateProcessTrack(TrackClassification classification,
                                         UniquePid upid,
                                         std::optional<Dimensions> dims,
                                         const TrackName& name) {
  Dimensions dims_id =
      dims ? *dims : SingleDimension(upid_id_, Variadic::Integer(upid));

  tables::ProcessTrackTable::Row row(
      StringIdFromTrackName(classification, name));
  row.upid = upid;
  row.dimension_arg_set_id = dims_id.arg_set_id;
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  row.machine_id = context_->machine_id();

  return context_->storage->mutable_process_track_table()->Insert(row).id;
}

TrackId TrackTracker::CreateProcessCounterTrack(
    TrackClassification classification,
    UniquePid upid,
    std::optional<Dimensions> dims,
    const TrackName& name) {
  Dimensions dims_id =
      dims ? *dims : SingleDimension(upid_id_, Variadic::Integer(upid));

  tables::ProcessCounterTrackTable::Row row(
      StringIdFromTrackName(classification, name));
  row.upid = upid;
  row.machine_id = context_->machine_id();
  row.dimension_arg_set_id = dims_id.arg_set_id;
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));

  return context_->storage->mutable_process_counter_track_table()
      ->Insert(row)
      .id;
}

TrackId TrackTracker::CreateThreadTrack(TrackClassification classification,
                                        UniqueTid utid,
                                        const TrackName& name) {
  Dimensions dims_id = SingleDimension(utid_id_, Variadic::Integer(utid));

  tables::ThreadTrackTable::Row row(
      StringIdFromTrackName(classification, name));
  row.utid = utid;
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  row.dimension_arg_set_id = dims_id.arg_set_id;
  row.machine_id = context_->machine_id();

  return context_->storage->mutable_thread_track_table()->Insert(row).id;
}

TrackId TrackTracker::CreateThreadCounterTrack(
    TrackClassification classification,
    UniqueTid utid,
    const TrackName& name) {
  Dimensions dims_id = SingleDimension(utid_id_, Variadic::Integer(utid));

  tables::ThreadCounterTrackTable::Row row(
      StringIdFromTrackName(classification, name));
  row.utid = utid;
  row.machine_id = context_->machine_id();
  row.dimension_arg_set_id = dims_id.arg_set_id;
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));

  return context_->storage->mutable_thread_counter_track_table()
      ->Insert(row)
      .id;
}

TrackId TrackTracker::InternTrack(TrackClassification classification,
                                  std::optional<Dimensions> dimensions,
                                  const TrackName& name,
                                  const SetArgsCallback& callback) {
  auto* it = tracks_.Find({classification, dimensions});
  if (it)
    return *it;

  TrackId id = CreateTrack(classification, dimensions, name);
  tracks_[{classification, dimensions}] = id;
  if (callback) {
    ArgsTracker::BoundInserter inserter = context_->args_tracker->AddArgsTo(id);
    callback(inserter);
  }
  return id;
}

TrackId TrackTracker::InternCounterTrack(TrackClassification classification,
                                         std::optional<Dimensions> dimensions,
                                         const TrackName& name) {
  auto* it = tracks_.Find({classification, dimensions});
  if (it)
    return *it;

  TrackId id = CreateCounterTrack(classification, dimensions, name);
  tracks_[{classification, dimensions}] = id;
  return id;
}

TrackId TrackTracker::InternProcessTrack(TrackClassification classification,
                                         UniquePid upid,
                                         const TrackName& name) {
  Dimensions dims_id = SingleDimension(upid_id_, Variadic::Integer(upid));

  auto* it = tracks_.Find({classification, dims_id});
  if (it)
    return *it;

  TrackId track_id =
      CreateProcessTrack(classification, upid, std::nullopt, name);
  tracks_[{classification, dims_id}] = track_id;
  return track_id;
}

TrackId TrackTracker::LegacyInternProcessCounterTrack(StringId raw_name,
                                                      UniquePid upid,
                                                      StringId unit,
                                                      StringId description) {
  const StringId name =
      context_->process_track_translation_table->TranslateName(raw_name);

  TrackMapKey key;
  key.classification = TrackClassification::kUnknown;

  DimensionsBuilder dims_builder = CreateDimensionsBuilder();
  dims_builder.AppendUpid(upid);
  dims_builder.AppendName(name);
  key.dimensions = std::move(dims_builder).Build();

  auto* it = tracks_.Find(key);
  if (it) {
    return *it;
  }

  tables::ProcessCounterTrackTable::Row row(name);
  row.upid = upid;
  row.unit = unit;
  row.description = description;
  row.machine_id = context_->machine_id();
  row.classification = context_->storage->InternString(
      TrackClassificationToString(key.classification));
  row.dimension_arg_set_id = key.dimensions->arg_set_id;
  TrackId track_id =
      context_->storage->mutable_process_counter_track_table()->Insert(row).id;

  tracks_[key] = track_id;
  return track_id;
}

TrackId TrackTracker::InternThreadTrack(UniqueTid utid, const TrackName& name) {
  Dimensions dims = SingleDimension(utid_id_, Variadic::Integer(utid));

  auto* it = tracks_.Find({TrackClassification::kThread, dims});
  if (it)
    return *it;
  TrackId track_id =
      CreateThreadTrack(TrackClassification::kThread, utid, name);
  tracks_[{TrackClassification::kThread, dims}] = track_id;
  return track_id;
}

TrackId TrackTracker::LegacyInternThreadCounterTrack(StringId name,
                                                     UniqueTid utid) {
  TrackMapKey key;
  key.classification = TrackClassification::kUnknown;

  DimensionsBuilder dims_builder = CreateDimensionsBuilder();
  dims_builder.AppendUtid(utid);
  dims_builder.AppendName(name);
  key.dimensions = std::move(dims_builder).Build();

  auto* it = tracks_.Find(key);
  if (it) {
    return *it;
  }

  TrackId track_id = CreateThreadCounterTrack(TrackClassification::kUnknown,
                                              utid, LegacyStringIdName{name});
  tracks_[key] = track_id;
  return track_id;
}

TrackId TrackTracker::InternCpuTrack(TrackClassification classification,
                                     uint32_t cpu,
                                     const TrackName& name) {
  auto ucpu = context_->cpu_tracker->GetOrCreateCpu(cpu);
  Dimensions dims_id = SingleDimension(ucpu_id_, Variadic::Integer(ucpu.value));

  auto* it = tracks_.Find({classification, dims_id});
  if (it) {
    return *it;
  }

  tables::CpuTrackTable::Row row(StringIdFromTrackName(classification, name));
  row.ucpu = ucpu;
  row.machine_id = context_->machine_id();
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  row.dimension_arg_set_id = dims_id.arg_set_id;

  TrackId track_id =
      context_->storage->mutable_cpu_track_table()->Insert(row).id;
  tracks_[{classification, dims_id}] = track_id;
  return track_id;
}

TrackId TrackTracker::InternGlobalTrack(TrackClassification classification,
                                        const TrackName& name,
                                        const SetArgsCallback& callback) {
  return InternTrack(classification, std::nullopt, name, callback);
}

TrackId TrackTracker::LegacyInternGpuTrack(
    const tables::GpuTrackTable::Row& row) {
  DimensionsBuilder dims_builder = CreateDimensionsBuilder();
  dims_builder.AppendGpu(row.context_id.value_or(0));
  if (row.scope != kNullStringId) {
    dims_builder.AppendDimension(scope_id_, Variadic::String(row.scope));
  }
  dims_builder.AppendName(row.name);
  Dimensions dims_id = std::move(dims_builder).Build();

  TrackMapKey key;
  key.classification = TrackClassification::kUnknown;
  key.dimensions = dims_id;

  auto* it = tracks_.Find(key);
  if (it)
    return *it;

  auto row_copy = row;
  row_copy.classification = context_->storage->InternString(
      TrackClassificationToString(TrackClassification::kUnknown));
  row_copy.dimension_arg_set_id = dims_id.arg_set_id;
  row_copy.machine_id = context_->machine_id();

  TrackId track_id =
      context_->storage->mutable_gpu_track_table()->Insert(row_copy).id;
  tracks_[key] = track_id;
  return track_id;
}

TrackId TrackTracker::LegacyInternGlobalCounterTrack(TrackTracker::Group group,
                                                     StringId name,
                                                     SetArgsCallback callback,
                                                     StringId unit,
                                                     StringId description) {
  TrackMapKey key;
  key.classification = TrackClassification::kUnknown;
  key.dimensions = SingleDimension(name_id_, Variadic::String(name));

  auto* it = tracks_.Find(key);
  if (it) {
    return *it;
  }

  tables::CounterTrackTable::Row row(name);
  row.parent_id = InternTrackForGroup(group);
  row.unit = unit;
  row.description = description;
  row.machine_id = context_->machine_id();
  row.classification = context_->storage->InternString(
      TrackClassificationToString(TrackClassification::kUnknown));

  TrackId track =
      context_->storage->mutable_counter_track_table()->Insert(row).id;
  tracks_[key] = track;

  if (callback) {
    auto inserter = context_->args_tracker->AddArgsTo(track);
    callback(inserter);
  }

  return track;
}

TrackId TrackTracker::InternCpuCounterTrack(TrackClassification classification,
                                            uint32_t cpu,
                                            const TrackName& name) {
  auto ucpu = context_->cpu_tracker->GetOrCreateCpu(cpu);
  StringId name_id = StringIdFromTrackName(classification, name);

  TrackMapKey key;
  key.classification = classification;

  DimensionsBuilder dims_builder = CreateDimensionsBuilder();
  dims_builder.AppendUcpu(ucpu);
  dims_builder.AppendName(name_id);
  key.dimensions = std::move(dims_builder).Build();

  auto* it = tracks_.Find(key);
  if (it) {
    return *it;
  }

  tables::CpuCounterTrackTable::Row row(name_id);
  row.ucpu = ucpu;
  row.machine_id = context_->machine_id();
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  row.dimension_arg_set_id = key.dimensions->arg_set_id;

  TrackId track_id =
      context_->storage->mutable_cpu_counter_track_table()->Insert(row).id;
  tracks_[key] = track_id;
  return track_id;
}

TrackId TrackTracker::LegacyInternCpuIdleStateTrack(uint32_t cpu,
                                                    StringId state) {
  auto ucpu = context_->cpu_tracker->GetOrCreateCpu(cpu);
  DimensionsBuilder dims_builder = CreateDimensionsBuilder();
  dims_builder.AppendDimension(
      context_->storage->InternString("cpu_idle_state"),
      Variadic::String(state));
  dims_builder.AppendUcpu(ucpu);
  Dimensions dims_id = std::move(dims_builder).Build();

  TrackClassification classification = TrackClassification::kCpuIdleState;

  auto* it = tracks_.Find({classification, dims_id});
  if (it) {
    return *it;
  }

  std::string name =
      "cpuidle." + context_->storage->GetString(state).ToStdString();

  tables::CpuCounterTrackTable::Row row(
      context_->storage->InternString(name.c_str()));
  row.ucpu = ucpu;
  row.machine_id = context_->machine_id();
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  row.dimension_arg_set_id = dims_id.arg_set_id;

  TrackId track_id =
      context_->storage->mutable_cpu_counter_track_table()->Insert(row).id;
  tracks_[{classification, dims_id}] = track_id;
  return track_id;
}

TrackId TrackTracker::InternGpuCounterTrack(TrackClassification classification,
                                            uint32_t gpu_id,
                                            const TrackName& name) {
  Dimensions dims_id = SingleDimension(gpu_id_, Variadic::Integer(gpu_id));

  auto* it = tracks_.Find({classification, dims_id});
  if (it) {
    return *it;
  }

  tables::GpuCounterTrackTable::Row row(
      StringIdFromTrackName(classification, name));
  row.gpu_id = gpu_id;
  row.machine_id = context_->machine_id();
  row.dimension_arg_set_id = dims_id.arg_set_id;
  row.classification = context_->storage->InternString(
      TrackClassificationToString(classification));
  if (classification == TrackClassification::kGpuFrequency)
    row.name = context_->storage->InternString("gpufreq");

  TrackId track_id =
      context_->storage->mutable_gpu_counter_track_table()->Insert(row).id;

  tracks_[{classification, dims_id}] = track_id;
  return track_id;
}

TrackId TrackTracker::LegacyCreateGpuCounterTrack(StringId name,
                                                  uint32_t gpu_id,
                                                  StringId description,
                                                  StringId unit) {
  tables::GpuCounterTrackTable::Row row(name);
  row.gpu_id = gpu_id;
  row.description = description;
  row.unit = unit;
  row.machine_id = context_->machine_id();
  row.classification = context_->storage->InternString(
      TrackClassificationToString(TrackClassification::kUnknown));
  row.dimension_arg_set_id =
      SingleDimension(gpu_id_, Variadic::Integer(gpu_id)).arg_set_id;

  return context_->storage->mutable_gpu_counter_track_table()->Insert(row).id;
}

TrackId TrackTracker::LegacyCreatePerfCounterTrack(
    StringId name,
    tables::PerfSessionTable::Id perf_session_id,
    uint32_t cpu,
    bool is_timebase) {
  auto ucpu = context_->cpu_tracker->GetOrCreateCpu(cpu);
  DimensionsBuilder dims_builder = CreateDimensionsBuilder();
  dims_builder.AppendUcpu(ucpu);
  dims_builder.AppendDimension(
      context_->storage->InternString("perf_session_id"),
      Variadic::Integer(perf_session_id.value));
  Dimensions dims_id = std::move(dims_builder).Build();

  tables::PerfCounterTrackTable::Row row(name);
  row.perf_session_id = perf_session_id;
  row.cpu = cpu;
  row.is_timebase = is_timebase;
  row.dimension_arg_set_id = dims_id.arg_set_id;
  row.classification = context_->storage->InternString(
      TrackClassificationToString(TrackClassification::kUnknown));
  row.machine_id = context_->machine_id();
  return context_->storage->mutable_perf_counter_track_table()->Insert(row).id;
}

TrackId TrackTracker::InternTrackForGroup(TrackTracker::Group group) {
  uint32_t group_idx = static_cast<uint32_t>(group);
  const std::optional<TrackId>& group_id = group_track_ids_[group_idx];
  if (group_id) {
    return *group_id;
  }

  StringId name_id = context_->storage->InternString(GetNameForGroup(group));
  TrackId track_id = InternTrack(TrackClassification::kUnknown, std::nullopt,
                                 LegacyStringIdName{name_id});
  group_track_ids_[group_idx] = track_id;
  return track_id;
}

TrackId TrackTracker::LegacyInternLegacyChromeAsyncTrack(
    StringId raw_name,
    uint32_t upid,
    int64_t trace_id,
    bool trace_id_is_process_scoped,
    StringId source_scope) {
  DimensionsBuilder dims_builder = CreateDimensionsBuilder();
  dims_builder.AppendDimension(scope_id_, Variadic::String(source_scope));
  if (trace_id_is_process_scoped) {
    dims_builder.AppendUpid(upid);
  }
  dims_builder.AppendDimension(cookie_id_, Variadic::Integer(trace_id));

  const StringId name =
      context_->process_track_translation_table->TranslateName(raw_name);

  TrackMapKey key;
  key.classification = TrackClassification::kUnknown;
  key.dimensions = std::move(dims_builder).Build();

  auto* it = tracks_.Find(key);
  if (it) {
    if (name != kNullStringId) {
      // The track may have been created for an end event without name. In
      // that case, update it with this event's name.
      auto& tracks = *context_->storage->mutable_track_table();
      auto rr = *tracks.FindById(*it);
      if (rr.name() == kNullStringId) {
        rr.set_name(name);
      }
    }
    return *it;
  }

  // Legacy async tracks are always drawn in the context of a process, even if
  // the ID's scope is global.
  tables::ProcessTrackTable::Row track(name);
  track.upid = upid;
  track.classification = context_->storage->InternString(
      TrackClassificationToString(TrackClassification::kUnknown));
  track.dimension_arg_set_id = key.dimensions->arg_set_id;
  track.machine_id = context_->machine_id();

  TrackId id =
      context_->storage->mutable_process_track_table()->Insert(track).id;
  tracks_[key] = id;

  context_->args_tracker->AddArgsTo(id)
      .AddArg(source_key_, Variadic::String(chrome_source_))
      .AddArg(trace_id_key_, Variadic::Integer(trace_id))
      .AddArg(trace_id_is_process_scoped_key_,
              Variadic::Boolean(trace_id_is_process_scoped))
      .AddArg(source_scope_key_, Variadic::String(source_scope));

  return id;
}

StringId TrackTracker::StringIdFromTrackName(
    TrackClassification classification,
    const TrackTracker::TrackName& name) {
  switch (name.index()) {
    case base::variant_index<TrackName, AutoName>():
      return kNullStringId;
    case base::variant_index<TrackName, LegacyStringIdName>():
      PERFETTO_DCHECK(IsLegacyStringIdNameAllowed(classification));
      return std::get<LegacyStringIdName>(name).id;
    case base::variant_index<TrackName, LegacyCharArrayName>():
      PERFETTO_DCHECK(IsLegacyCharArrayNameAllowed(classification));
      return context_->storage->InternString(
          std::get<LegacyCharArrayName>(name).name);
    case base::variant_index<TrackName, FromTraceName>():
      return std::get<FromTraceName>(name).id;
  }
  PERFETTO_FATAL("For GCC");
}

}  // namespace perfetto::trace_processor
