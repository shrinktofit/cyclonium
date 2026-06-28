import { defineConfig } from 'vitest/config';
import ccTest from '@cyclonium/cc-test/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  build: {
    minify: false,
  },
  test: {
    browser: {
      provider: playwright({
        launchOptions: {
          args: ['--disable-web-security'],
        },
      }),
      enabled: true,
      instances: [
        { browser: 'chromium' },
      ],
      screenshotFailures: false,
    },
  },
  optimizeDeps: {
    // Modules in node_modules might also need 'cc', for example, @cyclonium/core linked by pnpm
    noDiscovery: true,
    include: [],
  },
  resolve: {
    alias: [
      {
        find: /^@\/(.*)/,
        replacement: '../src/$1',
      },
    ],
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    ccTest({
      autoInit: false,
      headless: false,
    }),
  ],
});
