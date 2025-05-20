// Copyright (C) 2018 The Android Open Source Project
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

import {assertExists} from '../base/logging';
import {RafScheduler} from 'src/core/raf_scheduler';
import {AppImpl} from '../core/app_impl';

/**
 * Global accessors for state/dispatch in the frontend.
 */
export class Globals {
  // This is normally undefined is injected in via is_internal_user.js.
  // WARNING: do not change/rename/move without considering impact on the
  // internal_user script.
  private _isInternalUser: boolean | undefined = undefined;

  private readonly _apps: AppImpl[] = [];

  // WARNING: do not change/rename/move without considering impact on the
  // internal_user script.
  get extraSqlPackages() {
    return this._apps[0]?.extraSqlPackages ?? [];
  }

  // This variable is set by the is_internal_user.js script if the user is a
  // googler. This is used to avoid exposing features that are not ready yet
  // for public consumption. The gated features themselves are not secret.
  // If a user has been detected as a Googler once, make that sticky in
  // localStorage, so that we keep treating them as such when they connect over
  // public networks.
  get isInternalUser() {
    if (this._isInternalUser === undefined) {
      this._isInternalUser = localStorage.getItem('isInternalUser') === '1';
    }
    return this._isInternalUser;
  }

  set isInternalUser(value: boolean) {
    localStorage.setItem('isInternalUser', value ? '1' : '0');
    this._isInternalUser = value;
    this._apps.forEach((app) => app.raf.scheduleFullRedraw());
  }

  addApp(app: AppImpl): Disposable {
    this._apps.push(app);
    const apps = this._apps;
    return {
      [Symbol.dispose](): void {
        const index = apps.indexOf(app);
        if (index >= 0) {
          apps.splice(index, 1);
        }
      },
    };
  }

  get app(): AppImpl {
    return assertExists(this._apps[0]);
  }

  get raf(): RafScheduler {
    return this.app.raf as RafScheduler;
  }

  // Used when switching to the legacy TraceViewer UI.
  // Most resources are cleaned up by replacing the current |window| object,
  // however pending RAFs and workers seem to outlive the |window| and need to
  // be cleaned up explicitly.
  shutdown() {
    this._apps.forEach((app) => (app.raf as RafScheduler).shutdown());
  }
}

export const globals = new Globals();
