import { Buffer } from 'node:buffer';
import type {
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import path from 'node:path';
import process from 'node:process';

import ccTest from '@cyclonium/cc-test/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import {
  defineConfig,
  type Plugin,
  type UserWorkspaceConfig,
} from 'vitest/config';

const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC'
  + 'AAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const projectRoot = path.resolve(import.meta.dirname);
const managedArtifacts = new Map<string, Buffer>();
const managedArtifactAcquires = new Map<string, number>();
const playwrightExecutablePath
  = process.env.CYCLO_PLAYWRIGHT_EXECUTABLE_PATH;
const browserProvider = playwrightExecutablePath === undefined
  ? playwright()
  : playwright({
    launchOptions: {
      executablePath: playwrightExecutablePath,
    },
  });

const unitProject: UserWorkspaceConfig = {
  test: {
    name: 'unit',
    environment: 'node',
    include: ['test/*.test.ts'],
  },
  resolve: {
    alias: testAliases(),
  },
};

const browserProject: UserWorkspaceConfig = {
  test: {
    name: 'browser',
    include: ['test/browser/*.test.ts'],
    setupFiles: ['test/browser/setup-cocos-dom.ts'],
    browser: {
      enabled: true,
      provider: browserProvider,
      instances: [
        {
          browser: 'chromium',
        },
      ],
      screenshotFailures: false,
    },
  },
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  plugins: [
    cycloAssetFixtureServer(),
    ccTest({
      defaultStrategy: 'standalone',
      autoInit: false,
      headless: false,
      configure: {
        platform: 'HTML5',
        HEADLESS: false,
        BUILD: true,
      },
    }),
  ],
};

export default defineConfig({
  test: {
    projects: [unitProject, browserProject],
  },
});

function testAliases(): Array<{
  readonly find: string | RegExp;
  readonly replacement: string;
}> {
  return [
    {
      find: 'cc/env',
      replacement: path.join(projectRoot, 'test', 'fixtures', 'cc-env.ts'),
    },
    {
      find: 'cc',
      replacement: path.join(projectRoot, 'test', 'fixtures', 'cc.ts'),
    },
    {
      find: /^@\/(.*)/,
      replacement: path.join(projectRoot, 'src', '$1'),
    },
  ];
}

function cycloAssetFixtureServer(): Plugin {
  return {
    name: 'cyclo-asset-pipeline-browser-fixtures',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        switch (request.url) {
        case '/__cyclo_asset_pipeline__/typed-json':
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify({ answer: 42 }));
          return;
        case '/__cyclo_asset_pipeline__/greeting.txt':
          response.setHeader('Content-Type', 'text/plain');
          response.end('hello from Cyclo');
          return;
        case '/__cyclo_asset_pipeline__/pixel.png':
          response.setHeader('Content-Type', 'image/png');
          response.setHeader('Content-Length', PIXEL_PNG.byteLength);
          response.end(PIXEL_PNG);
          return;
        default:
          if (serveManagedArtifact(request, response)) {
            return;
          }
          next();
        }
      });
    },
  };
}

function serveManagedArtifact(
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  const artifactPrefix = '/__cyclo_asset_pipeline__/managed/';
  const countPrefix = '/__cyclo_asset_pipeline__/managed-count/';
  const url = request.url ?? '';

  if (url.startsWith(countPrefix) && request.method === 'GET') {
    const key = decodeURIComponent(url.slice(countPrefix.length));
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      acquires: managedArtifactAcquires.get(key) ?? 0,
    }));
    return true;
  }

  if (!url.startsWith(artifactPrefix)) {
    return false;
  }

  const key = decodeURIComponent(url.slice(artifactPrefix.length));
  if (request.method === 'POST') {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      managedArtifacts.set(key, Buffer.concat(chunks));
      managedArtifactAcquires.set(key, 0);
      response.statusCode = 204;
      response.end();
    });
    return true;
  }

  if (request.method === 'GET') {
    const artifact = managedArtifacts.get(key);
    if (artifact === undefined) {
      response.statusCode = 404;
      response.end();
      return true;
    }
    managedArtifactAcquires.set(
      key,
      (managedArtifactAcquires.get(key) ?? 0) + 1,
    );
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Length', artifact.byteLength);
    response.end(artifact);
    return true;
  }

  response.statusCode = 405;
  response.end();
  return true;
}
