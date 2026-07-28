import { readFileSync } from 'node:fs';
import { createApp, type App } from 'vue';
import { createVuetify } from 'vuetify';
import 'vuetify/styles';
import AssetGroupsPanel from '../../features/asset-groups/asset-groups-panel.vue';
// @ts-expect-error Virtual module emitted by the extension Vite build.
import styleLocation from '@/style-location';

interface AssetGroupsPanelHost {
  readonly $: {
    readonly app: HTMLDivElement;
  };
}

const panelApps = new WeakMap<object, App>();

module.exports = Editor.Panel.define({
  template: '<div id="app"></div>',
  style: readFileSync(styleLocation, 'utf8'),
  $: {
    app: '#app',
  },
  ready(this: AssetGroupsPanelHost): void {
    const app = createApp(AssetGroupsPanel);
    app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('ui-');
    app.use(createVuetify({
      defaults: {
        global: {
          density: 'compact',
        },
      },
      theme: {
        defaultTheme: 'dark',
      },
    }));
    app.mount(this.$.app);
    panelApps.set(this, app);
  },
  close(this: AssetGroupsPanelHost): void {
    const app = panelApps.get(this);
    if (app === undefined) {
      throw new Error('Cyclo Asset Groups panel closed before its Vue application was mounted');
    }
    app.unmount();
    panelApps.delete(this);
  },
});
