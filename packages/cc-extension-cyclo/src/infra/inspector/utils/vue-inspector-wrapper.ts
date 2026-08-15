import { createApp, h, reactive, type Reactive } from 'vue';
import { logger } from '../../../logger.js';
import fs from 'fs-extra';
// @ts-expect-error -- Vite replaces this virtual style-location module during the extension build.
import styleLocation from '@/style-location';
import PrimeVue from 'primevue/config';
import type { Dump } from '../../../dump/dump.js';

export function wrapVueInspector<TComponent extends abstract new (...args: never[]) => object>(componentAccessor: () => TComponent) {
  const template = '<div id="container"></div>';

  const $ = {
    container: '#container',
  };

  let style = '';
  try {
    style = fs.readFileSync(styleLocation, 'utf-8');
  } catch (err) {
    logger.error(`Failed to load style`, err);
  }

  interface InspectorInstance {
    $: { container: HTMLDivElement };
    _inspectorData: Reactive<{ dump: null | Dump }>;
    _instance: null | InstanceType<TComponent>;
  }

  function ready(this: InspectorInstance, ...args: unknown[]) {
    console.debug(`Ready`, ...args);
    this._inspectorData = reactive<{ dump: null | Dump }>({ dump: null });
    // https://github.com/vuejs/core/issues/4874
    const app = createApp({
      render: () => {
        return h(componentAccessor(), { inspectorData: this._inspectorData });
      },
    });
    // @ts-expect-error -- PrimeVue's plugin type currently conflicts with Vue's duplicated App type in this extension workspace.
    app.use(PrimeVue);
    this._instance = app.mount(this.$.container) as InstanceType<TComponent>;
  }

  function update(this: InspectorInstance, dump: Dump) {
    console.debug(`Update`, dump);
    if (!this._instance) {
      logger.error(`No instance`);
      return;
    }
    this._inspectorData.dump = dump;
  }

  return {
    template,
    $,
    ready,
    update,
    style,
  };
}
