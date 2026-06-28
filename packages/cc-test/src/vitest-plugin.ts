import ejs from 'ejs';
import { type Plugin } from 'vitest/config';
import bundleWasm from '@cyclonium/bundle-wasm/vite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import exportMap from './export-map.js';
import { canvasSnapshotCommands } from './node/canvas-snapshot-command.js';
import type { CanvasOptions, StandaloneConfigure } from './runtime/internal-shared.js';
import type { InternalInjections } from 'virtual:cyclo-cc-test/internal-injections';

type PluginOption = NonNullable<import('vitest/config').ViteUserConfig['plugins']>[number];

export interface PluginOptions {
  autoInit?: boolean;
  headless?: boolean;
  canvas?: CanvasOptions;
  configure?: StandaloneConfigure;
  defaultStrategy?: 'editor-preview-based' | 'standalone';
  editorBased?: {
    baseURL?: string;
  };
  standalone?: {
    dir?: string;
  };
}

export default (opts: PluginOptions = {}): PluginOption => {
  return [
    corePlugin(opts),
    bundleWasm({
      test: true,
    }),
  ];
};

const MODULE_ID_CC = 'cc';
const MODULE_ID_CC_ENV = 'cc/env';
const PACKAGE_NAME_CC_TEST = '@cyclonium/cc-test';
const MODULE_ID_CC_TEST_PACKAGE_RE = /^@cyclonium\/cc-test\/runtime(?:\/|$)/;
const moduleBaseInit = '\0cc-test:init';
const moduleStandaloneConfigureGuard = '\0cc-test:standalone-configure-guard';
const moduleRuntimeInternalInjections = '\0cc-test:runtime-internal-injections';
const moduleRuntimeInternalInjectionsSpecifier = 'virtual:cyclo-cc-test/internal-injections';
const DEFAULT_EDITOR_BASE_URL = 'http://localhost:7456/';
const strategies = ['editor-preview-based', 'standalone'] as const;
type Strategy = typeof strategies[number];
type CcModuleId = typeof MODULE_ID_CC | typeof MODULE_ID_CC_ENV;
type InternalModuleBase = CcModuleId | typeof moduleBaseInit | typeof moduleStandaloneConfigureGuard;
const moduleIdToStandaloneModuleId = {
  [MODULE_ID_CC]: 'cc',
  [MODULE_ID_CC_ENV]: 'cc-env.js',
};
const moduleIdToInternalModuleId = {
  [MODULE_ID_CC]: 'cc',
  [MODULE_ID_CC_ENV]: 'cc-env',
};
let standaloneConfigureGuardSeed = 0;

function corePlugin({
  autoInit = true,
  headless = true,
  canvas: canvasOpts,
  configure: configureOpts = {},
  defaultStrategy = 'editor-preview-based',
  editorBased: editorBasedOpts = {},
  standalone: standaloneOpts,
}: PluginOptions): Plugin {
  let viteEnvEditorBaseURL = '';
  let viteEnvStandaloneEngineDir = '';
  const standaloneConfigureGuardModuleId = getInternalStandaloneConfigureGuardModuleId('standalone', standaloneConfigureGuardSeed++);
  return {
    name: 'vitest-plugin-cc-test',

    enforce: 'pre',

    config() {
      return {
        optimizeDeps: {
          exclude: [
            PACKAGE_NAME_CC_TEST,
          ],
        },
        test: {
          browser: {
            commands: canvasSnapshotCommands,
          },
        },
      };
    },

    configResolved(config) {
      viteEnvEditorBaseURL = config.env.VITE_CC_TEST_EDITOR_BASE_URL || '';
      viteEnvStandaloneEngineDir = config.env.VITE_CC_TEST_STANDALONE_ENGINE_DIR || '';
    },

    resolveId(source, _importer, options) {
      if (MODULE_ID_CC_TEST_PACKAGE_RE.test(source)) {
        return this.resolve(source, join(import.meta.dirname, '../'), {
          ...options,
          skipSelf: true,
        });
      }

      if (source === moduleRuntimeInternalInjectionsSpecifier) {
        return moduleRuntimeInternalInjections;
      }

      if (parseInternalModuleId(source)) {
        return source;
      }

      for (const base of [MODULE_ID_CC, MODULE_ID_CC_ENV] as const) {
        if (source === base) {
          return {
            id: getInternalModuleId(base, defaultStrategy),
          };
        };
      }
    },

    load(id) {
      if (id === moduleRuntimeInternalInjections) {
        return {
          code: renderTemplate('runtime/internal-injections.ts.ejs', {
            internalInjections: toSource(createInternalInjections({
              defaultStrategy,
              headless,
              editorBased: editorBasedOpts,
              viteEnvEditorBaseURL,
            })),
          }),
        };
      }

      const parsed = parseInternalModuleId(id);
      if (!parsed) {
        return;
      }

      switch (parsed.strategy) {
      case 'editor-preview-based': {
        if (parsed.base === moduleBaseInit) {
          const initModuleId = fileURLToPath(new URL('./editor-preview-based/init.js', import.meta.url)).replace(/\\/g, '/');
          const initOpts = {
            baseURL: getEditorBaseURL(editorBasedOpts, viteEnvEditorBaseURL),
            canvas: canvasOpts,
          };
          return {
            code: renderTemplate('editor-preview-based/pre-init.ts.ejs', {
              initModuleSpecifier: toModuleSpecifier(initModuleId),
              initOpts: toSource(initOpts),
            }),
          };
        }

        const syntheticNamedExports = '__synthetic';
        return {
          syntheticNamedExports,
          code: renderTemplate('editor-preview-based/engine-module-proxy.ts.ejs', {
            targetModuleId: parsed.base,
            targetModuleSpecifier: toSource(parsed.base),
            preInitModuleSpecifier: toModuleSpecifier(getInternalInitModuleId(parsed.strategy)),
            postInitModuleSpecifier: toModuleSpecifier(pathToFileURL(join(import.meta.dirname, 'editor-preview-based/post-init.js')).href),
            postInitOpts: toSource({ setupGame: autoInit }),
            syntheticNamedExportsId: syntheticNamedExports,
            exportBindings: exportMap[parsed.base],
          }),
        };
      }
      case 'standalone': {
        const standaloneDir = standaloneOpts?.dir || viteEnvStandaloneEngineDir;
        if (!standaloneDir) {
          this.error(`Standalone mode requires you specifying the 'standalone.dir' plugin option or 'VITE_CC_TEST_STANDALONE_ENGINE_DIR' plugin option.`);
        }

        if (parsed.base === moduleBaseInit) {
          return {
            code: renderTemplate('standalone/pre-init.ts.ejs', {}),
          };
        }

        if (parsed.base === moduleStandaloneConfigureGuard) {
          const defaultConfigure = {
            HEADLESS: true,
            ...configureOpts,
          };
          return {
            code: renderTemplate('standalone/configure-guard.ts.ejs', {
              configureModuleSpecifier: toModuleSpecifier(`${standaloneDir.replace(/\\/g, '/')}/configure.js`),
              ccTestConfigureModuleSpecifier: toModuleSpecifier(pathToFileURL(join(import.meta.dirname, 'runtime/internal-configure.js')).href),
              defaultConfigure: toSource(defaultConfigure),
            }),
          };
        }

        return {
          code: renderTemplate('standalone/engine-module-proxy.ts.ejs', {
            targetModuleId: parsed.base,
            configureGuardModuleSpecifier: toModuleSpecifier(standaloneConfigureGuardModuleId),
            preInitModuleSpecifier: toModuleSpecifier(getInternalInitModuleId(parsed.strategy)),
            targetModuleSpecifier: toModuleSpecifier(`${standaloneDir.replace(/\\/g, '/')}/${moduleIdToStandaloneModuleId[parsed.base]}`),
            postInitModuleSpecifier: toModuleSpecifier(pathToFileURL(join(import.meta.dirname, 'standalone/post-init.js')).href),
            postInitOpts: toSource({ setupGame: autoInit }),
          }),
        };
      }
      }
    },

    configureServer() {
      // todo
    },
  };
}

function createInternalInjections({
  defaultStrategy,
  headless,
  editorBased,
  viteEnvEditorBaseURL,
}: {
  defaultStrategy: NonNullable<PluginOptions['defaultStrategy']>;
  headless: NonNullable<PluginOptions['headless']>;
  editorBased: NonNullable<PluginOptions['editorBased']>;
  viteEnvEditorBaseURL: string;
}): InternalInjections {
  return {
    baseURL: defaultStrategy === 'standalone' ? '' : getEditorBaseURL(editorBased, viteEnvEditorBaseURL),
    headless,
  };
}

function getEditorBaseURL(editorBased: NonNullable<PluginOptions['editorBased']>, viteEnvEditorBaseURL: string): string {
  return editorBased.baseURL || viteEnvEditorBaseURL || DEFAULT_EDITOR_BASE_URL;
}

function renderTemplate(templateFile: string, data: ejs.Data): string {
  const filename = join(import.meta.dirname, '../static', templateFile);
  return ejs.render(readFileSync(filename, 'utf8'), data, {
    filename,
  });
}

function toModuleSpecifier(value: string): string {
  return toSource(value);
}

function toSource(value: unknown): string {
  return JSON.stringify(value, undefined, 2);
}

function getInternalInitModuleId(strategy: Strategy): string {
  return `${moduleBaseInit}:${strategy}`;
}

function getInternalStandaloneConfigureGuardModuleId(strategy: Strategy, seed: number): string {
  return `${moduleStandaloneConfigureGuard}:${strategy}:${seed}`;
}

function getInternalModuleId(base: CcModuleId, strategy: Strategy): string {
  return `\0cc-test:${moduleIdToInternalModuleId[base]}:${strategy}`;
}

function parseInternalModuleId(id: string): undefined | {
  base: InternalModuleBase;
  strategy: Strategy;
} {
  for (const strategy of strategies) {
    if (id === getInternalInitModuleId(strategy)) {
      return { base: moduleBaseInit, strategy };
    }
    if (id.startsWith(`${moduleStandaloneConfigureGuard}:${strategy}:`)) {
      return { base: moduleStandaloneConfigureGuard, strategy };
    }
    for (const base of [MODULE_ID_CC, MODULE_ID_CC_ENV] as const) {
      if (id === getInternalModuleId(base, strategy)) {
        return { base, strategy };
      }
    }
  }
}
