// Copyright (C) 2021 The Android Open Source Project
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

import {assetSrc} from '../base/assets';
import {download} from '../base/clipboard';
import {defer} from '../base/deferred';
import {ErrorDetails} from '../base/logging';
import {utf8Decode} from '../base/string_utils';
import {time} from '../base/time';
import {AppImpl} from '../core/app_impl';
import {TraceImpl} from '../core/trace_impl';
import {App} from '../public/app';
import {maybeShowErrorDialog} from './error_dialog';

type Args =
  | UpdateStatusArgs
  | JobCompletedArgs
  | DownloadFileArgs
  | OpenTraceInLegacyArgs
  | ErrorArgs;

interface UpdateStatusArgs {
  kind: 'updateStatus';
  status: string;
}

interface JobCompletedArgs {
  kind: 'jobCompleted';
}

interface DownloadFileArgs {
  kind: 'downloadFile';
  buffer: Uint8Array;
  name: string;
}

interface OpenTraceInLegacyArgs {
  kind: 'openTraceInLegacy';
  buffer: Uint8Array;
}

interface ErrorArgs {
  kind: 'error';
  error: ErrorDetails;
}

type OpenTraceInLegacyCallback = (
  app: App,
  name: string,
  data: ArrayBuffer | string,
  size: number,
) => void;

async function makeWorkerAndPost(
  app: App,
  msg: unknown,
  openTraceInLegacy?: OpenTraceInLegacyCallback,
) {
  const promise = defer<void>();

  const appImpl = getAppImpl(app);
  function handleOnMessage(msg: MessageEvent): void {
    const args: Args = msg.data;
    if (args.kind === 'updateStatus') {
      appImpl.omnibox.showStatusMessage(app, args.status);
    } else if (args.kind === 'jobCompleted') {
      promise.resolve();
    } else if (args.kind === 'downloadFile') {
      download(new File([new Blob([args.buffer])], args.name));
    } else if (args.kind === 'openTraceInLegacy') {
      const str = utf8Decode(args.buffer);
      openTraceInLegacy?.(app, 'trace.json', str, 0);
    } else if (args.kind === 'error') {
      maybeShowErrorDialog(args.error);
    } else {
      throw new Error(`Unhandled message ${JSON.stringify(args)}`);
    }
  }

  const worker = new Worker(assetSrc('traceconv_bundle.js'));
  worker.onmessage = handleOnMessage;
  worker.postMessage(msg);
  return promise;
}

export function convertTraceToJsonAndDownload(app: App, trace: Blob): Promise<void> {
  return makeWorkerAndPost(app, {
    kind: 'ConvertTraceAndDownload',
    trace,
    format: 'json',
  });
}

export function convertTraceToSystraceAndDownload(app: App, trace: Blob): Promise<void> {
  return makeWorkerAndPost(app, {
    kind: 'ConvertTraceAndDownload',
    trace,
    format: 'systrace',
  });
}

export function convertToJson(
  app: App,
  trace: Blob,
  openTraceInLegacy: OpenTraceInLegacyCallback,
  truncate?: 'start' | 'end',
): Promise<void> {
  return makeWorkerAndPost(
    app,
    {
      kind: 'ConvertTraceAndOpenInLegacy',
      trace,
      truncate,
    },
    openTraceInLegacy,
  );
}

export function convertTraceToPprofAndDownload(
  app: App,
  trace: Blob,
  pid: number,
  ts: time,
): Promise<void> {
  return makeWorkerAndPost(app, {
    kind: 'ConvertTraceToPprof',
    trace,
    pid,
    ts,
  });
}

function getAppImpl(app: App): AppImpl {
  if (app instanceof AppImpl) {
    return app;
  }
  if (app instanceof TraceImpl) {
    return getAppImpl(app);
  }
  throw new TypeError('app is not traceable to an AppImpl');
}
