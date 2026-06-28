import { defineConfig, Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { builtinModules } from 'node:module';
import { join } from 'node:path';
import useEditorModules from '@cyclonium/cc-extension-utils/vite-plugins/use-editor-modules';
import { contributionModules } from '@cyclonium/cc-extension-utils/vite-plugins/contribution-modules';

export default defineConfig({
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        main: './src/main.ts',
        hooks: './src/hooks.ts',
      },
      formats: ['cjs'],
      cssFileName: 'style',
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        /^node:.*/,
        'fs-extra',
        'winston',
        'yaml',
        'vue',
      ],
    },
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => {
            if (tag.startsWith('ui-')) {
              return true;
            } else {
              return false;
            }
          },
        },
      },
    }),
    useEditorModules(),
    styleLocation(),
    contributionModules({
      sourceRoot: join(import.meta.dirname, 'src'),
    }),
  ],
});

function styleLocation(): Plugin {
  const styleModuleId = '@/style-location';
  let helperFileId = '';

  return {
    name: 'style-location',

    buildStart() {
      helperFileId = this.emitFile({
        type: 'asset',
        fileName: '.here',
        source: '',
      });
    },

    resolveId(source, _importer, _options) {
      if (source === styleModuleId) {
        return styleModuleId;
      }
    },

    load(id, _options) {
      if (id === styleModuleId) {
        return `export default require('path').resolve(__dirname, import.meta.ROLLUP_FILE_URL_${helperFileId}, '../style.css')`;
      }
    },

    resolveFileUrl({ relativePath, referenceId }) {
      if (referenceId === helperFileId) {
        return `require('path').resolve(__dirname, '${relativePath}')`;
      }
    },
  };
}
