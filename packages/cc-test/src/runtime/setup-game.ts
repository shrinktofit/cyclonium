import type { IGameConfig } from 'cc';
import { internalInjections } from 'virtual:cyclo-cc-test/internal-injections';
import { internalShared, type CanvasOptions } from './internal-shared.js';

const DEFAULT_BUILTIN_ASSETS = [
  'a3cd009f-0ab0-420d-9278-b9fdab939bbc',
  'c8f66d17-351a-48da-a12c-0212d28575c4',
  '6a2d0734-bd9e-4ddf-946e-caa52498cb75',
];

export interface BuiltinAssetsOptions {
  includes?: string[];
  excludes?: string[];
}

export interface SetupGameOptions {
  builtinAssets?: BuiltinAssetsOptions;
  canvas?: CanvasOptions;
}

export async function setupGame({
  builtinAssets,
  canvas,
}: SetupGameOptions = {}): Promise<void> {
  if (!internalShared.cc) {
    throw new Error(`Can not setup game before import 'cc'.`);
  }
  if (canvas !== undefined) {
    if (!internalShared.canvas || !internalShared.configureCanvas) {
      throw new Error(`Can not configure setupGame canvas before editor preview canvas is initialized.`);
    }
    internalShared.configureCanvas(canvas);
  }

  // 引擎启动选项
  const option: IGameConfig & {
    id?: string;
  } = {
    overrideSettings: {},
  };
  option.id = internalShared.canvas?.id;
  option.overrideSettings.assets ??= {};
  option.overrideSettings.assets.server = internalInjections.baseURL;
  option.overrideSettings.assets.importBase = 'assets/general/import';
  option.overrideSettings.assets.nativeBase = 'assets/general/native';
  option.overrideSettings.assets.remoteBundles = [];
  option.overrideSettings.assets.subpackages = [];
  option.overrideSettings.screen ??= {};
  option.overrideSettings.screen.exactFitScreen = false;
  option.overrideSettings.rendering ??= {};
  option.overrideSettings.rendering.renderMode = internalInjections.headless ? 3 : undefined; // headless
  if (!internalInjections.headless) {
    option.overrideSettings.rendering.customPipeline = 'custom';
    option.overrideSettings.rendering.enableEffectImport = true;
    option.overrideSettings.rendering.effectSettingsPath = 'src/effect.bin';
    option.overrideSettings.engine ??= {};
    option.overrideSettings.engine.builtinAssets = resolveBuiltinAssets(builtinAssets);
  }
  // 等待引擎启动
  await internalShared.cc.game.init(option);
}

function resolveBuiltinAssets(opts?: BuiltinAssetsOptions): string[] {
  const settingsBuiltinAssets = internalShared.settingsJSON.engine?.builtinAssets;
  const defaultBuiltinAssets = new Set(DEFAULT_BUILTIN_ASSETS);
  const allBuiltinAssets = Array.isArray(settingsBuiltinAssets)
    ? settingsBuiltinAssets.filter((asset) => {
      return !defaultBuiltinAssets.has(asset);
    })
    : [];
  const includes = new Set(opts?.includes);
  const excludes = new Set(opts?.excludes ?? []);
  let builtinAssets = opts === undefined ? [] : allBuiltinAssets;
  if (opts?.includes !== undefined) {
    builtinAssets = builtinAssets.filter((asset) => {
      return includes.has(asset);
    });
  }
  if (opts?.excludes !== undefined) {
    builtinAssets = builtinAssets.filter((asset) => {
      return !excludes.has(asset);
    });
  }
  return Array.from(new Set([
    ...DEFAULT_BUILTIN_ASSETS,
    ...builtinAssets,
  ]));
}
