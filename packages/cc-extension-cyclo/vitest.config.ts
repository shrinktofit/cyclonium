import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      cc: fileURLToPath(new URL('./test/fixtures/cc.ts', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./test/setup.ts'],
  },
});
