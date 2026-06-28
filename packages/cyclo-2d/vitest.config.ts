/// <reference types="node" />
/// <reference types="vitest" />

import { defineConfig, type Plugin, type UserWorkspaceConfig } from 'vitest/config';
import ccTest, { type PluginOptions } from '@cyclonium/cc-test/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const createCcTestPlugins = ccTest as unknown as (opts?: PluginOptions) => Plugin[];

const commonProjectConfig: UserWorkspaceConfig = {
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  resolve: {
    alias: [
      { find: /^@src\/(.*)/, replacement: `${__dirname}/src/$1` },
    ],
  },
  test: {
    server: {
      deps: {
        inline: [
          /\/@cyclonium\/.*\.[cm]?[jt]s/,
        ],
      },
    },
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        ...commonProjectConfig,
        test: {
          ...commonProjectConfig.test,
          name: 'headless',
          include: ['test/**/*.headless.test.ts'],
        },
        plugins: createCcTestPlugins({
          defaultStrategy: 'standalone',
        }),
      },
      {
        ...commonProjectConfig,
        test: {
          ...commonProjectConfig.test,
          name: 'browser',
          include: ['test/**/*.browser.test.ts'],
          browser: {
            provider: playwright({}),
            enabled: true,
            instances: [
              { browser: 'chromium' },
            ],
            screenshotFailures: false,
          },
        },
        plugins: [
          createCcTestPlugins({
            defaultStrategy: 'editor-preview-based',
            autoInit: false,
            headless: false,
          }),
        ],
      },
    ],
  },
});
