// Copyright (C) 2023 The Android Open Source Project
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

import {produce} from 'immer';
import m from 'mithril';
import {RafScheduler} from '../core/raf_scheduler';
import {globals} from './globals';
import {App} from '../public/app';

declare global {
  interface Window {
    m: typeof m;
    app: App;
    globals: typeof globals;
    produce: typeof produce;
    raf: RafScheduler;
  }
}

export function registerDebugGlobals() {
  window.m = m;
  window.app = globals.app;
  window.globals = globals;
  window.produce = produce;
  window.raf = globals.raf;
}
