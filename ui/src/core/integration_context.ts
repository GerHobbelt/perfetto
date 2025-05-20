// Copyright (C) 2025 The Android Open Source Project
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

import {RouteArgs} from "../public/route_schema";
import {SerializedAppState} from "./state_serialization_schema";

export type ViewOpener = (url: string) => void;

// Extensions for integration with host applications. If the context
// does not exist, then there is no host application.
export class IntegrationContext {
  private _ignoreUnknownPostMessage?: boolean;
  private _disableMainRendering?: boolean;
  private _disableHashBasedRouting?: boolean;
  private _relaxContentSecurity: boolean = false;
  private _cachePrefix: string = '';
  private _viewOpener?: ViewOpener;
  private _initialRouteArgs?: RouteArgs;
  private _allowFileDrop = true;
  private _promptToLoadFromTraceProcessorShell = true;
  private _appState?: SerializedAppState;
  private _rootRelativePath?: string;

  static create(): IntegrationContext {
    return new IntegrationContext();
  }

  private constructor() {}

  get ignoreUnknownPostMessage(): boolean {
    return !!this._ignoreUnknownPostMessage;
  }

  set ignoreUnknownPostMessage(value: boolean) {
    this._ignoreUnknownPostMessage = value;
  }

  get disableMainRendering(): boolean {
    return !!this._disableMainRendering;
  }

  set disableMainRendering(value: boolean) {
    this._disableMainRendering = value;
  }

  get disableHashBasedRouting(): boolean {
    return !!this._disableHashBasedRouting;
  }

  set disableHashBasedRouting(value: boolean) {
    this._disableHashBasedRouting = value;
  }

  get relaxContentSecurity(): boolean {
    return !!this._relaxContentSecurity;
  }

  set relaxContentSecurity(value: boolean) {
    this._relaxContentSecurity = value;
  }

  get initialRouteArgs(): RouteArgs {
    return this._initialRouteArgs ?? {};
  }

  set initialRouteArgs(value: RouteArgs) {
    this._initialRouteArgs = structuredClone(value);
  }

  get cachePrefix(): string {
    return this._cachePrefix;
  }

  set cachePrefix(value: string) {
    this._cachePrefix = value;
  }

  get viewOpener(): ViewOpener | undefined {
    return this._viewOpener;
  }

  set viewOpener(viewOpener: ViewOpener | undefined) {
    this._viewOpener = viewOpener;
  }

  get allowFileDrop(): boolean {
    return this._allowFileDrop;
  }

  set allowFileDrop(allowFileDrop: boolean) {
    this._allowFileDrop = allowFileDrop;
  }

  get promptToLoadFromTraceProcessorShell(): boolean {
    return this._promptToLoadFromTraceProcessorShell;
  }

  set promptToLoadFromTraceProcessorShell(promptToLoadFromTraceProcessorShell: boolean) {
    this._promptToLoadFromTraceProcessorShell = promptToLoadFromTraceProcessorShell;
  }

  get appState(): SerializedAppState | undefined {
    return this._appState;
  }

  set appState(appState: SerializedAppState | undefined) {
    this._appState = appState;
  }

  get rootRelativePath(): string {
    return this._rootRelativePath ?? '';
  }

  set rootRelativePath(rootRelativePath: string) {
    this._rootRelativePath = rootRelativePath;
  }

}
