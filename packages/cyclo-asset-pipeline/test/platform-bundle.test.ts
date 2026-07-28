import path from 'node:path';

import {
  build,
  type Plugin,
} from 'vite';
import {
  describe,
  expect,
  it,
} from 'vitest';

const VIRTUAL_ENTRY_ID = '\0cyclo-asset-pipeline-bundle-entry';
const VIRTUAL_ENV_ID = '\0cyclo-asset-pipeline-cc-env';
const SOURCE_ENTRY_ID = 'cyclo-asset-pipeline-source-entry';
const sourceEntry = path.resolve(import.meta.dirname, '..', 'src', 'index.ts');

describe('platform production bundles', () => {
  it('tree-shakes Noble SHA-256 from the HTML5 production graph', async () => {
    /// @case
    /// Vite produces a real optimized HTML5 bundle whose public install entry
    /// selects the Web platform at compile time.
    /// @expect
    /// No @noble/hashes module survives in the emitted Rollup module graph,
    /// because Web uses only crypto.subtle.
    const moduleIds = await buildHtml5ModuleGraph();

    expect(nobleModuleIds(moduleIds)).toEqual([]);
  });
});

async function buildHtml5ModuleGraph(): Promise<readonly string[]> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [html5PlatformModules()],
    build: {
      minify: false,
      target: 'es2022',
      write: false,
      rollupOptions: {
        input: VIRTUAL_ENTRY_ID,
        external: (id) => id === 'cc',
      },
    },
  });
  if ('on' in result) {
    throw new Error('A production build unexpectedly returned a watcher.');
  }
  const outputs = Array.isArray(result) ? result : [result];
  return outputs.flatMap(({ output }) => output.flatMap((entry) => (
    entry.type === 'chunk' ? Object.keys(entry.modules) : []
  )));
}

function html5PlatformModules(): Plugin {
  return {
    name: 'cyclo-asset-pipeline-html5-bundle-test',
    resolveId(id) {
      if (id === VIRTUAL_ENTRY_ID || id === 'cc/env') {
        return id === 'cc/env' ? VIRTUAL_ENV_ID : VIRTUAL_ENTRY_ID;
      }
      if (id === SOURCE_ENTRY_ID) {
        return sourceEntry;
      }
      return undefined;
    },
    load(id) {
      if (id === VIRTUAL_ENTRY_ID) {
        return [
          `import { installAssetPipeline } from '${SOURCE_ENTRY_ID}'`,
          'globalThis.__cycloAssetPipeline = installAssetPipeline()',
        ].join('\n');
      }
      if (id === VIRTUAL_ENV_ID) {
        return [
          'export const HTML5 = true',
          'export const WECHAT = false',
          'export const ALIPAY = false',
          'export const BYTEDANCE = false',
        ].join('\n');
      }
      return undefined;
    },
  };
}

function nobleModuleIds(moduleIds: readonly string[]): readonly string[] {
  return moduleIds
    .map((id) => id.replaceAll('\\', '/').split('?')[0] ?? id)
    .filter((id) => id.includes('/node_modules/@noble/hashes/'))
    .sort();
}
