// Copyright (C) 2024 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Time} from '../base/time';
import {EngineBase} from '../trace_processor/engine';
import {AppImpl} from './app_impl';
import {IntegrationContext} from './integration_context';
import {Router} from './router';
import {TraceImpl} from './trace_impl';
import {TraceInfoImpl} from './trace_info_impl';

export interface FakeTraceImplArgs {
  // If true suppresses exceptions when trying to issue a query. This is to
  // catch bugs where we are trying to query an empty instance. However some
  // unittests need to do so. Default: false.
  allowQueries?: boolean;
}

const integrationContext = IntegrationContext.create();
const appImpl = AppImpl.createCoreInstance({
  initialRouteArgs: {},
  router: new Router(integrationContext),
  integrationContext,
});

export function initializeAppImplForTesting(): AppImpl {
  return appImpl;
}

// For testing purposes only.
export function createFakeTraceImpl(args: FakeTraceImplArgs = {}) {
  initializeAppImplForTesting();
  const fakeTraceInfo: TraceInfoImpl = {
    source: {type: 'URL', url: ''},
    traceTitle: '',
    traceUrl: '',
    start: Time.fromSeconds(0),
    end: Time.fromSeconds(10),
    realtimeOffset: Time.ZERO,
    utcOffset: Time.ZERO,
    traceTzOffset: Time.ZERO,
    cpus: [],
    importErrors: 0,
    traceType: 'proto',
    hasFtrace: false,
    uuid: '',
    cached: false,
    downloadable: false,
  };
  appImpl.closeCurrentTrace();
  const trace = TraceImpl.createInstanceForCore(
    appImpl,
    new FakeEngine(args.allowQueries ?? false),
    fakeTraceInfo,
  );
  appImpl.setActiveTrace(trace);
  return trace;
}

class FakeEngine extends EngineBase {
  readonly mode = 'WASM';
  id: string = 'TestEngine';

  constructor(private allowQueries: boolean) {
    super();
  }

  rpcSendRequestBytes(_data: Uint8Array) {
    if (!this.allowQueries) {
      throw new Error(
        'FakeEngine.query() should never be reached. ' +
          'If this is a unittest, try adding {allowQueries: true} to the ' +
          'createFakeTraceImpl() call.',
      );
    }
  }

  [Symbol.dispose]() {}
}
