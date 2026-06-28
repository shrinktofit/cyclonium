import { defineConfig } from 'vitest/config';
import ccTest from '@cyclonium/cc-test/vitest-plugin';
import path from 'node:path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: [
            {
              find: /^@\/(.*)/,
              replacement: path.join(projectRoot, 'src', '$1'),
            },
          ],
        },
        test: {
          include: ['test/**/*.test.ts'],
          server: {
            deps: {
              inline: [
                /\/@cyclonium\/.*\.[cm]?[jt]s/,
              ],
            },
          },
        },
        plugins: [
          ...ccTest({
            defaultStrategy: 'standalone',
          }),
        ],
      },
    ],
  },
});
