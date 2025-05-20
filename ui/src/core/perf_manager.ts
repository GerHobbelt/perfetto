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
import {AppImpl, AppImplAttrs} from './app_impl';
import {RafScheduler} from './raf_scheduler';
import {PerfStats, PerfStatsContainer, runningStatStr} from './perf_stats';
import {MithrilEvent} from '../base/mithril_utils';

export class PerfManager {
  private _enabled = false;
  readonly containers: PerfStatsContainer[] = [];

  constructor(private readonly raf: RafScheduler) {}

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(enabled: boolean) {
    this._enabled = enabled;
    this.raf.setPerfStatsEnabled(true);
    this.containers.forEach((c) => c.setPerfStatsEnabled(enabled));
  }

  addContainer(container: PerfStatsContainer): Disposable {
    this.containers.push(container);
    return {
      [Symbol.dispose]: () => {
        const i = this.containers.indexOf(container);
        this.containers.splice(i, 1);
      },
    };
  }

  renderPerfStats(app: AppImpl): m.Children {
    if (!this._enabled) return;
    // The rendering of the perf stats UI is atypical. The main issue is that we
    // want to redraw the mithril component even if there is no full DOM redraw
    // happening (and we don't want to force redraws as a side effect). So we
    // return here just a container and handle its rendering ourselves.
    const perfMgr = this;
    let removed = false;
    return m('.pf-perf-stats', {
      oncreate(vnode: m.VnodeDOM) {
        const animationFrame = (dom: Element) => {
          if (removed) return;
          m.render(dom, m(PerfStatsUi, {app, perfMgr}));
          requestAnimationFrame(() => animationFrame(dom));
        };
        animationFrame(vnode.dom);
      },
      onremove() {
        removed = true;
      },
    });
  }
}

// The mithril component that draws the contents of the perf stats box.

interface PerfStatsUiAttrs extends AppImplAttrs {
  perfMgr: PerfManager;
}

class PerfStatsUi implements m.ClassComponent<PerfStatsUiAttrs> {
  view({attrs}: m.Vnode<PerfStatsUiAttrs>) {
    return m(
      '.pf-perf-stats',
      {},
      m('section', this.renderRafSchedulerStats(attrs.app)),
      m(
        'button.close-button',
        {
          onclick: () => {
            attrs.perfMgr.enabled = false;
            attrs.app.raf.scheduleFullRedraw();
          },
        },
        m('i.pf-material-icons', 'close'),
      ),
      attrs.perfMgr.containers.map((c, i) =>
        m('section', m('div', `Container #${i + 1}`), c.renderPerfStats()),
      ),
    );
  }

  renderRafSchedulerStats(app: AppImpl) {
    return m(
      'div',
      m('div', [
        m(
          'button',
          {
            onclick: (e: MithrilEvent) => {
              e.redraw = false;
              app.raf.scheduleCanvasRedraw();
            },
          },
          'Do Canvas Redraw',
        ),
        '   |   ',
        m(
          'button',
          {onclick: () => app.raf.scheduleFullRedraw()},
          'Do Full Redraw',
        ),
      ]),
      m('div', 'Raf Timing ' + '(Total may not add up due to imprecision)'),
      m(
        'table',
        this.statTableHeader(),
        this.statTableRow('Actions', app.raf.perfStats.rafActions),
        this.statTableRow('Dom', app.raf.perfStats.rafDom),
        this.statTableRow('Canvas', app.raf.perfStats.rafCanvas),
        this.statTableRow('Total', app.raf.perfStats.rafTotal),
      ),
      m(
        'div',
        'Dom redraw: ' +
          `Count: ${app.raf.perfStats.domRedraw.count} | ` +
          runningStatStr(app.raf.perfStats.domRedraw),
      ),
    );
  }

  statTableHeader() {
    return m(
      'tr',
      m('th', ''),
      m('th', 'Last (ms)'),
      m('th', 'Avg (ms)'),
      m('th', 'Avg-10 (ms)'),
    );
  }

  statTableRow(title: string, stat: PerfStats) {
    return m(
      'tr',
      m('td', title),
      m('td', stat.last.toFixed(2)),
      m('td', stat.mean.toFixed(2)),
      m('td', stat.bufferMean.toFixed(2)),
    );
  }
}
