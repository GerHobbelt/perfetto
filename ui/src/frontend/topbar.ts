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

import m from 'mithril';
import {classNames} from '../base/classnames';
import {Popup, PopupPosition} from '../widgets/popup';
import {assertFalse} from '../base/logging';
import {OmniboxMode} from '../core/omnibox_manager';
import {AppImplAttrs} from '../core/app_impl';
import {OptionalTraceImplAttrs, TraceImplAttrs} from '../core/trace_impl';

class Progress implements m.ClassComponent<AppImplAttrs & TraceImplAttrs> {
  view({attrs}: m.CVnode<AppImplAttrs & TraceImplAttrs>): m.Children {
    const app = attrs.app;
    const engine = attrs.trace.engine;
    const isLoading =
      app.isLoadingTrace ||
      engine.numRequestsPending > 0 ||
      app.taskTracker.hasPendingTasks();
    const classes = classNames(isLoading && 'progress-anim');
    return m('.progress', {class: classes});
  }
}

class TraceErrorIcon implements m.ClassComponent<AppImplAttrs & TraceImplAttrs> {
  private tracePopupErrorDismissed = false;

  view({attrs}: m.CVnode<AppImplAttrs & TraceImplAttrs>) {
    const {app, trace} = attrs;
    if (app.embeddedMode) return;

    const mode = app.omnibox.mode;
    const totErrors = trace.traceInfo.importErrors + trace.loadingErrors.length;
    if (totErrors === 0 || mode === OmniboxMode.Command) {
      return;
    }
    const message = Boolean(totErrors)
      ? `${totErrors} import or data loss errors detected.`
      : `Metric error detected.`;

    const icon = m(
      'i.material-icons',
      {
        title: message + ` Click for more info.`,
      },
      'announcement');

    const viewOpener = app.integrationContext?.viewOpener;
    const infoButton = viewOpener ?
       m('button.error', {onclick: () => viewOpener('#!/info')}, icon) :
       m('a.error', {href: '#!/info'}, icon);

    return m(
      '.error-box',
      m(
        Popup,
        {
          trigger: m('.popup-trigger'),
          isOpen: !this.tracePopupErrorDismissed,
          position: PopupPosition.Left,
          onChange: (shouldOpen: boolean) => {
            assertFalse(shouldOpen);
            this.tracePopupErrorDismissed = true;
          },
        },
        m('.error-popup', 'Data-loss/import error. Click for more info.'),
      ),
      infoButton,
    );
  }
}

export interface TopbarAttrs extends AppImplAttrs, OptionalTraceImplAttrs {
  omnibox: m.Children;
}

export class Topbar implements m.ClassComponent<TopbarAttrs> {
  view({attrs}: m.Vnode<TopbarAttrs>) {
    const {app, omnibox, trace} = attrs;
    return m(
      '.topbar',
      {
        class: app.sidebar.visible ? '' : 'hide-sidebar',
      },
      omnibox,
      trace && m(Progress, {app, trace}),
      trace && m(TraceErrorIcon, {app, trace}),
    );
  }
}
