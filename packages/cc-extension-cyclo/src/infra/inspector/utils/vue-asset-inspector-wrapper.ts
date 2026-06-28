import { createApp, h, reactive, type Reactive } from 'vue';
import { logger } from '../../../logger.js';
import fs from 'fs-extra';
// @ts-expect-error
import styleLocation from '@/style-location';
import PrimeVue from 'primevue/config';
import type { AssetInspectorData, InspectorAsset, InspectorMeta } from '../asset/data.js';

export function wrapVueAssetInspector<TComponent extends new (...args: any[]) => any>(componentAccessor: () => TComponent) {
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
    _inspectorData: Reactive<{ data: null | AssetInspectorData }>;
    _instance: null | InstanceType<TComponent>;
  }

  function ready(this: InspectorInstance, ...args: unknown[]) {
    console.debug(`Ready`, ...args);
    this._inspectorData = reactive<{ data: null | AssetInspectorData }>({ data: null });
    // https://github.com/vuejs/core/issues/4874
    const app = createApp({
      render: () => {
        return h(componentAccessor(), { inspectorData: this._inspectorData });
      },
    });
    // @ts-expect-error
    app.use(PrimeVue);
    this._instance = app.mount(this.$.container) as InstanceType<TComponent>;
  }

  function update(this: InspectorInstance, assets: InspectorAsset[], metas: InspectorMeta[]) {
    console.debug(`Update`, assets, metas);
    if (assets.length === 0 || metas.length === 0 || assets.length !== metas.length) {
      logger.error(`No asset or meta or assets.length !== metas.length`);
      return;
    }
    if (!this._instance) {
      logger.error(`No instance`);
      return;
    }
    this._inspectorData.data = {
      asset: assets[0],
      meta: metas[0],
    };
  }

  return {
    template,
    $,
    ready,
    update,
    style,
  };
}
