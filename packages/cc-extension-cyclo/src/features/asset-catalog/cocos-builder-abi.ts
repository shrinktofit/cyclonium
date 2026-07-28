import type {
  BundleCompressionType,
  IBuildTaskOption,
  IBundleOptions,
  Platform,
} from '@cocos/creator-types/editor/packages/builder/@types/public';
import type { AssetInfo } from '@cocos/creator-types/editor/packages/asset-db/@types/public';

const SUPPORTED_EDITOR_VERSIONS = new Set([
  '3.8.7',
]);
const BUNDLE_BUILD_SUCCESS_CODE = 36;
const BUNDLE_COMPRESSION_TYPES = new Set<BundleCompressionType>([
  'none',
  'merge_dep',
  'merge_all_json',
  'subpackage',
  'zip',
]);
const DEFAULT_BUNDLE_CONFIG = {
  configs: {
    native: {
      preferredOptions: { isRemote: false, compressionType: 'merge_dep' },
    },
    web: {
      preferredOptions: { isRemote: false, compressionType: 'merge_dep' },
      fallbackOptions: { compressionType: 'merge_dep' },
    },
    miniGame: {
      fallbackOptions: { isRemote: false, compressionType: 'merge_dep' },
      configMode: 'fallback',
    },
  },
} as const;
const CYCLO_BUNDLE_CONFIG_ID = 'cyclo-asset-pipeline-unpacked';
const CYCLO_BUNDLE_CONFIG = {
  displayName: 'Cyclo Asset Pipeline (Unpacked)',
  configs: {
    native: {
      preferredOptions: { isRemote: false, compressionType: 'none' },
    },
    web: {
      preferredOptions: { isRemote: false, compressionType: 'none' },
      fallbackOptions: { compressionType: 'none' },
    },
    miniGame: {
      fallbackOptions: { isRemote: false, compressionType: 'none' },
      configMode: 'fallback',
    },
  },
} as const;
// Vortex 3.8.7 app/builtin/builder/dist/browser/tasks.js resolves
// a completed successful task with status code 36.

type PrivateEditorRequest = (
  packageName: string,
  message: string,
  ...args: readonly unknown[]
) => Promise<unknown>;

export interface CocosBuildTask {
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  readonly options: IBuildTaskOption;
}

export interface CocosBundleBuildRequest {
  readonly buildTaskId: string;
  readonly destination: string;
  readonly bundleConfigs: readonly IBundleOptions[];
}

export class CocosBuilderAbiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CocosBuilderAbiError';
  }
}

export class CocosBuilderAbi {
  constructor() {
    if (!SUPPORTED_EDITOR_VERSIONS.has(Editor.App.version)) {
      throw new CocosBuilderAbiError(
        `Cyclo Catalog Builder supports Vortex/Creator ${[...SUPPORTED_EDITOR_VERSIONS].join(', ')}; `
        + `the current editor is ${Editor.App.version}.`,
      );
    }
  }

  async queryAsset(uuidOrUrl: string): Promise<AssetInfo | undefined> {
    const asset: unknown = await Editor.Message.request(
      'asset-db',
      'query-asset-info',
      uuidOrUrl,
    );
    if (asset === null) {
      return undefined;
    }
    return parseAssetInfo(asset, `asset-db.query-asset-info(${uuidOrUrl})`);
  }

  compressUuid(uuid: string): string {
    const compressed = Editor.Utils.UUID.compressUUID(uuid, true);
    if (typeof compressed !== 'string' || compressed.length === 0) {
      throw new CocosBuilderAbiError(`Editor.Utils.UUID.compressUUID failed for "${uuid}".`);
    }
    return compressed;
  }

  decompressUuid(uuid: string): string {
    const decompressed = Editor.Utils.UUID.decompressUUID(uuid);
    if (typeof decompressed !== 'string' || decompressed.length === 0) {
      throw new CocosBuilderAbiError(`Editor.Utils.UUID.decompressUUID failed for "${uuid}".`);
    }
    return decompressed;
  }

  async queryAssetsUnder(directoryUrl: string): Promise<readonly AssetInfo[]> {
    const assets: unknown = await Editor.Message.request(
      'asset-db',
      'query-assets',
      { pattern: `${directoryUrl.replace(/\/+$/u, '')}/**/*` },
    );
    if (!Array.isArray(assets)) {
      throw new CocosBuilderAbiError(
        'asset-db.query-assets returned an unsupported value.',
      );
    }
    return assets.map((asset, index) => parseAssetInfo(
      asset,
      `asset-db.query-assets[${index}]`,
    ));
  }

  async queryDirectAssetDependencies(uuid: string): Promise<readonly string[]> {
    const result = await this.#requestPrivate(
      'asset-db',
      'query-asset-dependencies',
      uuid,
      'asset',
    );
    if (!isStringArray(result)) {
      throw new CocosBuilderAbiError(
        'asset-db.query-asset-dependencies returned an unsupported value.',
      );
    }
    return result;
  }

  async queryProjectBundleOptions(platform: Platform): Promise<readonly IBundleOptions[]> {
    const customConfigs: unknown = await Editor.Profile.getProject(
      'builder',
      'bundleConfig.custom',
    );
    const renderConfigs = await this.#requestPrivate(
      'builder',
      'query-bundle-config',
    );
    const platformDefinition = findBundlePlatformDefinition(renderConfigs, platform);
    const queriedAssets: unknown = await Editor.Message.request(
      'asset-db',
      'query-assets',
      { isBundle: true },
      ['meta'],
    );
    if (!Array.isArray(queriedAssets)) {
      throw new CocosBuilderAbiError(
        'asset-db.query-assets({ isBundle: true }) returned an unsupported value.',
      );
    }
    const assets = queriedAssets.map((asset, index) => parseAssetInfo(
      asset,
      `asset-db.query-assets({ isBundle: true })[${index}]`,
    ));
    return assets.map((asset): IBundleOptions => {
      const userData = asset.meta?.userData;
      if (!isRecord(userData)) {
        throw new CocosBuilderAbiError(
          `Cocos Bundle directory "${asset.url}" has no readable meta.userData.`,
        );
      }
      const configId = readOptionalString(userData.bundleConfigID) ?? 'default';
      const platformOptions = this.#queryProjectBundlePlatformOptions(
        customConfigs,
        configId,
        platformDefinition,
        platform,
      );
      const priority = readOptionalNumber(userData.priority);
      const bundleFilterConfig = readBundleFilters(userData.bundleFilterConfig);
      return {
        root: asset.url,
        name: readOptionalString(userData.bundleName) ?? asset.name,
        compressionType: platformOptions.compressionType,
        isRemote: platformOptions.isRemote,
        ...(priority === undefined ? {} : { priority }),
        ...(bundleFilterConfig === undefined ? {} : { bundleFilterConfig }),
      };
    });
  }

  async queryBuildTasks(): Promise<readonly CocosBuildTask[]> {
    const result = await this.#requestPrivate(
      'builder',
      'query-tasks-info',
      { type: 'build' },
    );
    if (!isRecord(result) || !Array.isArray(result.list)) {
      throw new CocosBuilderAbiError(
        'builder.query-tasks-info returned an unsupported value.',
      );
    }
    return result.list.map((value, index) => {
      if (
        !isRecord(value)
        || typeof value.id !== 'string'
        || !isSafePathSegment(value.id)
        || value.type !== 'build'
        || !isBuildTaskOptions(value.options)
      ) {
        throw new CocosBuilderAbiError(
          `builder.query-tasks-info returned an invalid build task at index ${index}.`,
        );
      }
      return {
        id: value.id,
        name: value.options.taskName,
        platform: value.options.platform,
        options: value.options,
      };
    });
  }

  async buildBundles(request: CocosBundleBuildRequest): Promise<void> {
    const result = await this.#requestPrivate(
      'builder',
      'add-bundle-task',
      {
        buildTaskIds: [request.buildTaskId],
        dest: request.destination,
        id: `cyclo-content-${Date.now()}`,
        bundleConfigs: request.bundleConfigs,
        taskName: 'Build Cyclo Content',
      },
      true,
    );
    if (result !== BUNDLE_BUILD_SUCCESS_CODE) {
      throw new CocosBuilderAbiError(
        `builder.add-bundle-task failed with Vortex status code ${String(result)}.`,
      );
    }
  }

  async configureTechnicalBundles(bundles: readonly IBundleOptions[]): Promise<void> {
    const customConfigs: unknown = await Editor.Profile.getProject(
      'builder',
      'bundleConfig.custom',
    );
    if (!isRecord(customConfigs)) {
      throw new CocosBuilderAbiError(
        'builder.bundleConfig.custom project profile has an unsupported value.',
      );
    }
    if (!equalJsonValue(customConfigs[CYCLO_BUNDLE_CONFIG_ID], CYCLO_BUNDLE_CONFIG)) {
      await Editor.Profile.setProject(
        'builder',
        'bundleConfig.custom',
        {
          ...customConfigs,
          [CYCLO_BUNDLE_CONFIG_ID]: CYCLO_BUNDLE_CONFIG,
        },
      );
    }

    for (const bundle of bundles) {
      const info = await this.queryAsset(bundle.root);
      if (!info?.isDirectory) {
        throw new CocosBuilderAbiError(
          `Cyclo technical Bundle root is not an imported directory: ${bundle.root}`,
        );
      }
      const meta = await this.#requestPrivate(
        'asset-db',
        'query-asset-meta',
        info.uuid,
      );
      if (!isRecord(meta)) {
        throw new CocosBuilderAbiError(
          `asset-db.query-asset-meta returned invalid metadata for ${bundle.root}.`,
        );
      }
      const userData = isRecord(meta.userData) ? meta.userData : {};
      const nextMeta = {
        ...meta,
        userData: {
          ...userData,
          isBundle: true,
          bundleName: bundle.name,
          bundleConfigID: CYCLO_BUNDLE_CONFIG_ID,
          priority: bundle.priority,
          bundleFilterConfig: bundle.bundleFilterConfig ?? [],
        },
      };
      if (equalJsonValue(meta, nextMeta)) {
        continue;
      }
      const saved = await this.#requestPrivate(
        'asset-db',
        'save-asset-meta',
        info.uuid,
        JSON.stringify(nextMeta, undefined, 2),
      );
      if (saved !== true) {
        throw new CocosBuilderAbiError(
          `asset-db.save-asset-meta failed for Cyclo technical Bundle ${bundle.root}.`,
        );
      }
      await this.#requestPrivate('asset-db', 'reimport-asset', info.uuid);
    }
  }

  readonly #requestPrivate = Editor.Message.request as unknown as PrivateEditorRequest;

  #queryProjectBundlePlatformOptions(
    customConfigs: unknown,
    configId: string,
    platformDefinition: BundlePlatformDefinition,
    platform: Platform,
  ): BundlePlatformOptions {
    if (
      customConfigs !== undefined
      && customConfigs !== null
      && !isRecord(customConfigs)
    ) {
      throw new CocosBuilderAbiError(
        'builder.bundleConfig.custom project profile has an unsupported value.',
      );
    }
    const configured = isRecord(customConfigs) ? customConfigs[configId] : undefined;
    const config = configured ?? (configId === 'default' ? DEFAULT_BUNDLE_CONFIG : undefined);
    if (!isRecord(config) || !isRecord(config.configs)) {
      throw new CocosBuilderAbiError(
        `Cocos Bundle references missing bundle config "${configId}".`,
      );
    }
    const platformSettings = config.configs[platformDefinition.platformType];
    if (!isRecord(platformSettings)) {
      throw new CocosBuilderAbiError(
        `Cocos Bundle config "${configId}" has no ${platformDefinition.platformType} settings.`,
      );
    }
    return selectBundlePlatformOptions(
      platformSettings,
      platformDefinition,
      platform,
      configId,
    );
  }
}

interface BundlePlatformOptions {
  readonly compressionType: BundleCompressionType;
  readonly isRemote: boolean;
}

interface BundlePlatformDefinition {
  readonly platformType: string;
  readonly supportedCompressionTypes: ReadonlySet<BundleCompressionType>;
}

function findBundlePlatformDefinition(
  value: unknown,
  platform: Platform,
): BundlePlatformDefinition {
  if (!isRecord(value)) {
    throw new CocosBuilderAbiError(
      'builder.query-bundle-config returned an unsupported value.',
    );
  }
  const matches = Object.entries(value)
    .filter(([, candidate]) => (
      isRecord(candidate)
      && isRecord(candidate.platformConfigs)
      && Object.hasOwn(candidate.platformConfigs, platform)
    ))
    .map(([platformType]) => platformType);
  if (matches.length !== 1) {
    throw new CocosBuilderAbiError(
      `builder.query-bundle-config matched ${matches.length} platform types for "${platform}".`,
    );
  }
  const platformType = matches[0];
  const candidate = value[platformType];
  const platformConfig = isRecord(candidate) && isRecord(candidate.platformConfigs)
    ? candidate.platformConfigs[platform]
    : undefined;
  const supportOptions = isRecord(platformConfig) ? platformConfig.supportOptions : undefined;
  const compressionTypes = isRecord(supportOptions) ? supportOptions.compressionType : undefined;
  if (!isStringArray(compressionTypes)) {
    throw new CocosBuilderAbiError(
      `builder.query-bundle-config returned no compression support for "${platform}".`,
    );
  }
  const supportedCompressionTypes = new Set<BundleCompressionType>();
  for (const compressionType of compressionTypes) {
    if (BUNDLE_COMPRESSION_TYPES.has(compressionType as BundleCompressionType)) {
      supportedCompressionTypes.add(compressionType as BundleCompressionType);
    }
  }
  return { platformType, supportedCompressionTypes };
}

function selectBundlePlatformOptions(
  settings: Record<string, unknown>,
  definition: BundlePlatformDefinition,
  platform: Platform,
  configId: string,
): BundlePlatformOptions {
  const preferred = isRecord(settings.preferredOptions) ? settings.preferredOptions : {};
  const fallback = isRecord(settings.fallbackOptions) ? settings.fallbackOptions : undefined;
  const overwriteSettings = isRecord(settings.overwriteSettings)
    ? settings.overwriteSettings
    : undefined;
  const overwritten = overwriteSettings?.[platform];
  const configMode = readOptionalString(settings.configMode)
    ?? (definition.platformType === 'miniGame' ? 'fallback' : 'auto');
  let selected: Record<string, unknown>;
  if (configMode === 'fallback' && fallback !== undefined) {
    selected = {
      ...preferred,
      compressionType: fallback.compressionType,
      isRemote: readOptionalBoolean(fallback.isRemote) ?? false,
    };
  } else if (isRecord(overwritten)) {
    selected = overwritten;
  } else if (configMode === 'overwrite') {
    selected = { compressionType: 'merge_dep', isRemote: false };
  } else if (
    typeof preferred.compressionType === 'string'
    && definition.supportedCompressionTypes.has(
      preferred.compressionType as BundleCompressionType,
    )
  ) {
    selected = preferred;
  } else if (fallback !== undefined) {
    selected = { ...preferred, compressionType: fallback.compressionType };
  } else {
    selected = preferred;
  }

  const compressionType = readOptionalString(selected.compressionType) ?? 'merge_dep';
  if (!BUNDLE_COMPRESSION_TYPES.has(compressionType as BundleCompressionType)) {
    throw new CocosBuilderAbiError(
      `Cocos Bundle config "${configId}" selected invalid compression for "${platform}".`,
    );
  }
  const typedCompression = compressionType as BundleCompressionType;
  const configuredRemote = readOptionalBoolean(selected.isRemote) ?? false;
  return {
    compressionType: typedCompression,
    isRemote: typedCompression !== 'subpackage'
      && (typedCompression === 'zip' || configuredRemote),
  };
}

function isBuildTaskOptions(value: unknown): value is IBuildTaskOption {
  return isRecord(value)
    && typeof value.taskName === 'string'
    && typeof value.platform === 'string'
    && typeof value.outputName === 'string'
    && isSafePathSegment(value.outputName)
    && typeof value.buildPath === 'string';
}

function isSafePathSegment(value: string): boolean {
  return value.length > 0
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\');
}

function parseAssetInfo(value: unknown, context: string): AssetInfo {
  if (
    !isRecord(value)
    || typeof value.name !== 'string'
    || typeof value.uuid !== 'string'
    || typeof value.url !== 'string'
    || typeof value.type !== 'string'
    || typeof value.isDirectory !== 'boolean'
    || !isStringRecord(value.library)
  ) {
    throw new CocosBuilderAbiError(`${context} returned an unsupported AssetInfo.`);
  }
  return value as unknown as AssetInfo;
}

function readBundleFilters(value: unknown): IBundleOptions['bundleFilterConfig'] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new CocosBuilderAbiError('Cocos Bundle bundleFilterConfig is not an array.');
  }
  return value.map((filter, index) => {
    if (
      !isRecord(filter)
      || (filter.range !== 'include' && filter.range !== 'exclude')
      || (filter.type !== 'asset' && filter.type !== 'url')
    ) {
      throw new CocosBuilderAbiError(
        `Cocos Bundle bundleFilterConfig[${index}] is invalid.`,
      );
    }
    if (filter.assets !== undefined && !isStringArray(filter.assets)) {
      throw new CocosBuilderAbiError(
        `Cocos Bundle bundleFilterConfig[${index}].assets is invalid.`,
      );
    }
    return {
      range: filter.range,
      type: filter.type,
      ...(filter.assets === undefined ? {} : { assets: filter.assets }),
    };
  });
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value)
    && Object.values(value).every((item) => typeof item === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function equalJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
