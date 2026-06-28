import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import dts from 'unplugin-dts/vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
      },
      formats: ['es'],
    },
    outDir: './lib',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: [
        'cc',
        'cc/env',
        /\?wasm-binary$/,
      ],
    },
  },
  plugins: [
    {
      name: 'make-it-work',
      transform(code, id, options) {
        if (id.replace(/\\/g, '/').endsWith('rapier2d/rapier_wasm2d.js')) {
          return 'export * from "./rapier_wasm2d_bg.js";';
        }
      },
      async buildEnd(error) {
        this.emitFile({
          type: 'asset',
          fileName: 'rapier_wasm2d_bg.wasm',
          source: await readFile(createRequire(import.meta.url).resolve('@dimforge/rapier2d/rapier_wasm2d_bg.wasm')),
        });
      },
    },

    dts({
      bundleTypes: false,
    }),
  ],
});
