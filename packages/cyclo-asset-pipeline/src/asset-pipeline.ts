import { invariant } from '@cyclonium/invariant';

import {
  AssetIntegrityPolicy,
  AssetMergeMode,
  type AssetCollectionHandle,
  type AssetHandle,
  type AssetId,
  type AssetLoadOptions,
  type AssetPipelineInstallOptions,
  type AssetType,
  type CycloAsset,
  type RemoteAssetLoadOptions,
} from './core/public.js';
import { AssetSystem } from './core/asset-system.js';
import type { AssetRuntimeConfiguration } from './core/contracts.js';

interface NormalizedAssetPipelineInstallOptions {
  readonly artifactCacheByteBudget: number;
  readonly integrityPolicy: AssetIntegrityPolicy;
  readonly onIntegrityDiagnostic: AssetPipelineInstallOptions[
    'onIntegrityDiagnostic'
  ];
}

let installedOptions: NormalizedAssetPipelineInstallOptions | undefined;
let installedSystem: AssetSystem | undefined;
let installationOptions: NormalizedAssetPipelineInstallOptions | undefined;
let installationPromise: Promise<AssetPipeline> | undefined;
let assetPipelineConstructor!: () => AssetPipeline;

export function constructAssetPipeline(): AssetPipeline {
  return assetPipelineConstructor();
}

/**
 * Public contract for loading Cocos runtime assets through the Cyclo pipeline.
 */
export class AssetPipeline {
  loadAsset<TAsset extends CycloAsset>(
    id: AssetId,
    options?: AssetLoadOptions,
  ): AssetHandle<TAsset> {
    return this.#requireSystem().loadAsset<TAsset>(id, options);
  }

  loadAssets<TAsset extends CycloAsset>(
    key: AssetId,
    options?: AssetLoadOptions,
  ): AssetCollectionHandle<TAsset>;

  loadAssets<TAsset extends CycloAsset>(
    keys: readonly AssetId[],
    mergeMode: AssetMergeMode,
    options?: AssetLoadOptions,
  ): AssetCollectionHandle<TAsset>;

  loadAssets<TAsset extends CycloAsset>(
    keyOrKeys: AssetId | readonly AssetId[],
    mergeModeOrOptions?: AssetMergeMode | AssetLoadOptions,
    options?: AssetLoadOptions,
  ): AssetCollectionHandle<TAsset> {
    if (typeof keyOrKeys === 'string') {
      return this.#requireSystem().loadAssets<TAsset>(
        keyOrKeys,
        mergeModeOrOptions as AssetLoadOptions | undefined,
      );
    }
    return this.#requireSystem().loadAssets<TAsset>(
      keyOrKeys,
      mergeModeOrOptions as AssetMergeMode,
      options,
    );
  }

  loadRemoteAsset<TAsset extends CycloAsset>(
    url: string,
    assetType: AssetType<TAsset>,
    options?: RemoteAssetLoadOptions,
  ): AssetHandle<TAsset> {
    return this.#requireSystem().loadRemoteAsset(url, assetType, options);
  }

  private constructor() {
    // Construction is intentionally restricted to the module-owned factory.
  }

  #requireSystem(): AssetSystem {
    if (installedSystem === undefined) {
      throw new Error(
        'AssetPipeline is not installed. Call installAssetPipeline() first.',
      );
    }
    return installedSystem;
  }

  static {
    assetPipelineConstructor = () => new AssetPipeline();
  }
}

export function installAssetPipelineInstance(
  pipeline: AssetPipeline,
  options?: AssetPipelineInstallOptions,
  createConfiguration?: (
    options: NormalizedAssetPipelineInstallOptions,
  ) => AssetRuntimeConfiguration | Promise<AssetRuntimeConfiguration>,
): Promise<AssetPipeline> {
  const artifactCacheByteBudget = options?.artifactCacheByteBudget ?? 0;
  const integrityPolicy = options?.integrityPolicy
    ?? AssetIntegrityPolicy.whenPresent;
  const onIntegrityDiagnostic = options?.onIntegrityDiagnostic;
  if (
    !Number.isSafeInteger(artifactCacheByteBudget)
    || artifactCacheByteBudget < 0
  ) {
    throw new RangeError(
      'artifactCacheByteBudget must be a non-negative safe integer.',
    );
  }
  if (!Object.values(AssetIntegrityPolicy).includes(integrityPolicy)) {
    throw new TypeError(`Unknown integrity policy "${integrityPolicy}".`);
  }
  if (
    integrityPolicy === AssetIntegrityPolicy.diagnostics
    && onIntegrityDiagnostic === undefined
  ) {
    throw new TypeError(
      'Diagnostics integrity policy requires onIntegrityDiagnostic.',
    );
  }

  const normalizedOptions = {
    artifactCacheByteBudget,
    integrityPolicy,
    onIntegrityDiagnostic,
  };
  const activeOptions = installedOptions ?? installationOptions;
  if (activeOptions !== undefined) {
    if (!sameInstallOptions(activeOptions, normalizedOptions)) {
      throw new Error(
        'AssetPipeline is already installed with different configuration.',
      );
    }
    invariant(
      installationPromise !== undefined,
      'Active AssetPipeline installation must retain its Promise.',
    );
    return installationPromise;
  }

  if (createConfiguration === undefined) {
    throw new Error('AssetPipeline runtime configuration is unavailable.');
  }

  installationOptions = normalizedOptions;
  const promise = Promise.resolve()
    .then(() => createConfiguration(normalizedOptions))
    .then((configuration) => {
      if (
        configuration.artifactCacheByteBudget
        !== normalizedOptions.artifactCacheByteBudget
        || configuration.integrityPolicy !== normalizedOptions.integrityPolicy
        || configuration.onIntegrityDiagnostic
        !== normalizedOptions.onIntegrityDiagnostic
      ) {
        throw new Error(
          'AssetPipeline runtime configuration differs from install options.',
        );
      }

      installedSystem = new AssetSystem(configuration);
      installedOptions = normalizedOptions;
      installationOptions = undefined;
      return pipeline;
    });
  const trackedPromise = promise.catch((error: unknown) => {
    if (installationPromise === trackedPromise) {
      installedSystem = undefined;
      installedOptions = undefined;
      installationOptions = undefined;
      installationPromise = undefined;
    }
    throw error;
  });
  installationPromise = trackedPromise;
  return trackedPromise;
}

function sameInstallOptions(
  left: NormalizedAssetPipelineInstallOptions,
  right: NormalizedAssetPipelineInstallOptions,
): boolean {
  return left.artifactCacheByteBudget === right.artifactCacheByteBudget
    && left.integrityPolicy === right.integrityPolicy
    && left.onIntegrityDiagnostic === right.onIntegrityDiagnostic;
}
