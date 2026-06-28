import { defineConfig } from 'vitest/config';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(__dirname);

const timeout = process.env.VITEST_NO_TIMEOUT ? 1e9 : undefined;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/*.test.ts'],
    exclude: ['**/fixtures/**'],
    testTimeout: timeout,
    hookTimeout: timeout,
  },
  resolve: {
    alias: [
      {
        find: /^@\/(.*)/,
        replacement: path.join(projectRoot, 'src', '$1'),
      },
    ],
  },
});
