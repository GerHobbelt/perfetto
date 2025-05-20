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

import {AppImpl} from '../core/app_impl';

let lastDragTarget: EventTarget | null = null;

export function installFileDropHandler(app: AppImpl): Disposable {
  const dragEnterHandler = (evt: DragEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    lastDragTarget = evt.target;
    if (dragEventHasFiles(evt)) {
      document.body.classList.add('pf-filedrag');
    }
  };
  window.addEventListener('dragenter', dragEnterHandler);

  const dragLeaveHandler = (evt: DragEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.target === lastDragTarget) {
      document.body.classList.remove('pf-filedrag');
    }
  };
  window.addEventListener('dragleave', dragLeaveHandler);

  const dropHandler = (evt: DragEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
    document.body.classList.remove('pf-filedrag');
    if (evt.dataTransfer && dragEventHasFiles(evt)) {
      const file = evt.dataTransfer.files[0];
      // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
      if (file) {
        app.openTraceFromFile(file);
      }
    }
    evt.preventDefault();
  };
  window.addEventListener('drop', dropHandler);

  const dragOverHandler = (evt: DragEvent) => {
    evt.preventDefault();
    evt.stopPropagation();
  };
  window.addEventListener('dragover', dragOverHandler);

  return {
    [Symbol.dispose](): void {
      window.removeEventListener('dragover', dragOverHandler);
      window.removeEventListener('drop', dropHandler);
      window.removeEventListener('dragleave', dragLeaveHandler);
      window.removeEventListener('dragenter', dragEnterHandler);
    },
  };
}

function dragEventHasFiles(event: DragEvent): boolean {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (event.dataTransfer && event.dataTransfer.types) {
    for (const type of event.dataTransfer.types) {
      if (type === 'Files') return true;
    }
  }
  return false;
}
