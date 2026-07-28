import {
  type AbortSignal,
} from '@cyclonium/abort-controller';

import { ArtifactOperationStore } from './artifact-operation.js';
import { releaseArtifact } from './artifact-lifetime.js';
import { AssetCollectionHandleImpl } from './asset-collection-handle.js';
import {
  AssetOperationStore,
  encodeOperationKey,
} from './asset-operation.js';
import {
  ByteArtifactCache,
  encodeArtifactHashCacheKey,
  encodeArtifactLocationCacheKey,
} from './byte-artifact-cache.js';
import { CatalogResolver } from './catalog-resolver.js';
import type {
  ArtifactSource,
  AssetDecoder,
  AssetRuntimeConfiguration,
  Sha256,
} from './contracts.js';
import {
  ArtifactKind,
  type Artifact,
  type ArtifactCandidate,
  type ArtifactLocation,
  type AssetRecord,
  type AssetResourceId,
  type DecodedAsset,
  type DependencyBinding,
  type NativeBinding,
} from './model.js';
import {
  AssetLoadError,
  AssetLoadStage,
  AssetIntegrityError,
  AssetIntegrityPolicy,
  AssetMergeMode,
  type AssetCollectionHandle,
  type AssetHandle,
  type AssetId,
  type AssetLoadOptions,
  type AssetType,
  type CycloAsset,
  type RemoteAssetLoadOptions,
} from './public.js';
import {
  RuntimeAssetStore,
  type RuntimeAssetLease,
} from './runtime-asset-store.js';

interface GraphNode {
  readonly decoded: DecodedAsset;
  readonly dependencies: Set<AssetResourceId>;
  readonly dependencyBindings: ReadonlyMap<
    DependencyBinding,
    AssetResourceId
  >;
  readonly record: AssetRecord;
  nativeLinked: boolean;
}

interface RemoteAssetRecord {
  readonly asset: CycloAsset;
  readonly nativeBinding?: NativeBinding;
  count: number;
  destroyed: boolean;
  reservations: number;
}

interface RemoteAssetReservation {
  readonly record: RemoteAssetRecord;
  released: boolean;
}

export class AssetSystem {
  constructor(configuration: AssetRuntimeConfiguration) {
    if (
      configuration.integrityPolicy === AssetIntegrityPolicy.diagnostics
      && configuration.onIntegrityDiagnostic === undefined
    ) {
      throw new TypeError(
        'Diagnostics integrity policy requires onIntegrityDiagnostic.',
      );
    }
    this.#configuration = configuration;
    this.#catalog = new CatalogResolver(configuration.catalog);
    this.#artifactCache = new ByteArtifactCache(
      configuration.artifactCacheByteBudget,
    );
    this.#sources = uniqueMap(
      configuration.sources,
      (source) => source.id,
      'artifact source',
    );
    this.#decoders = uniqueMap(
      configuration.decoders,
      (decoder) => decoder.id,
      'asset decoder',
    );
  }

  loadAsset<TAsset extends CycloAsset>(
    id: AssetId,
    options: AssetLoadOptions = {},
  ): AssetHandle<TAsset> {
    const record = this.#catalog.resolve(id);
    if (record === undefined) {
      return this.#missingAssetHandle(id, options);
    }

    return this.#loadRecord<TAsset>(id, record, options);
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
    mergeModeOrOptions: AssetMergeMode | AssetLoadOptions = {},
    options: AssetLoadOptions = {},
  ): AssetCollectionHandle<TAsset> {
    const keys = typeof keyOrKeys === 'string'
      ? [keyOrKeys]
      : [...keyOrKeys];
    const mergeMode = typeof keyOrKeys === 'string'
      ? AssetMergeMode.useFirst
      : mergeModeOrOptions as AssetMergeMode;
    const loadOptions = typeof keyOrKeys === 'string'
      ? mergeModeOrOptions as AssetLoadOptions
      : options;
    const resourceIds = this.#catalog.selectResourceIds(keys, mergeMode);
    const handles = resourceIds.flatMap((resourceId) => {
      const record = this.#catalog.resolveResource(resourceId);
      return record === undefined
        ? []
        : [this.#loadRecord<TAsset>(resourceId, record, loadOptions)];
    });
    if (handles.length === 0 && keys.length > 0) {
      const hasCatalogMatch = resourceIds.length > 0
        || mergeMode === AssetMergeMode.intersection;
      if (!hasCatalogMatch) {
        const missingKey = keys[0];
        if (missingKey !== undefined) {
          handles.push(this.#missingAssetHandle(missingKey, loadOptions));
        }
      }
    }
    return new AssetCollectionHandleImpl(
      keys,
      handles,
      collectSignals(loadOptions),
    );
  }

  loadRemoteAsset<TAsset extends CycloAsset>(
    url: string,
    assetType: AssetType<TAsset>,
    options: RemoteAssetLoadOptions = {},
  ): AssetHandle<TAsset> {
    const operationKey = this.#remoteOperationKey(
      url,
      assetType,
      options.format,
    );
    const encodedOperationKey = encodeOperationKey(operationKey);
    if (!this.#configuration.remoteAssetLoader.supports(assetType)) {
      return this.#operations.acquire<TAsset>(
        operationKey,
        url,
        () => Promise.reject(new AssetLoadError(
          url,
          AssetLoadStage.resolve,
          'The requested remote asset type is not supported.',
        )),
        {
          signals: collectSignals(options),
        },
      );
    }

    const reservation = this.#reserveRemoteAsset(encodedOperationKey);
    const releaseLoadingReservation = (): void => {
      this.#releaseRemoteReservation(reservation);
      if (reservation !== undefined) {
        this.#disposeRemoteAsset(
          encodedOperationKey,
          reservation.record.asset,
        );
      }
    };
    const handle = this.#operations.acquire<TAsset>(
      operationKey,
      url,
      async (signal) => {
        const cached = this.#remoteAssets.get(encodedOperationKey);
        if (cached !== undefined && !cached.destroyed) {
          return cached.asset as TAsset;
        }

        const request = {
          url,
          assetType,
          explicitFormat: options.format,
        };
        let location: ArtifactLocation;
        try {
          location = this.#configuration.remoteAssetLoader.resolve(request);
        } catch (error) {
          throw stageError(
            url,
            AssetLoadStage.resolve,
            url,
            error,
          );
        }

        let artifact: Artifact;
        try {
          artifact = await this.#acquireSharedArtifact(location, signal);
        } catch (error) {
          throw stageError(
            url,
            AssetLoadStage.acquire,
            url,
            error,
          );
        }

        let asset: TAsset;
        let nativeBinding: NativeBinding | undefined;
        try {
          const instantiated = await this.#configuration.remoteAssetLoader
            .instantiate(
              request,
              artifact,
              signal,
            );
          asset = instantiated.asset;
          nativeBinding = instantiated.nativeBinding;
        } catch (error) {
          throw stageError(
            url,
            AssetLoadStage.decode,
            url,
            error,
          );
        } finally {
          releaseArtifact(artifact);
        }
        if (signal.aborted) {
          try {
            asset.destroy();
          } finally {
            nativeBinding?.release();
          }
          throw abortError(url);
        }
        this.#remoteAssets.set(encodedOperationKey, {
          asset,
          count: 0,
          destroyed: false,
          nativeBinding,
          reservations: 0,
        });
        return asset;
      },
      {
        disposeUnclaimed: (asset) => {
          releaseLoadingReservation();
          this.#disposeRemoteAsset(encodedOperationKey, asset);
        },
        releaseLoadingReservation,
        signals: collectSignals(options),
        retain: (asset) => this.#retainRemoteAsset(
          encodedOperationKey,
          asset,
          reservation,
        ),
      },
    );
    return handle;
  }

  readonly #artifactCache: ByteArtifactCache;
  readonly #artifactOperations = new ArtifactOperationStore();
  readonly #catalog: CatalogResolver;
  readonly #configuration: AssetRuntimeConfiguration;
  readonly #decoders: ReadonlyMap<string, AssetDecoder>;
  readonly #operations = new AssetOperationStore();
  readonly #remoteAssets = new Map<string, RemoteAssetRecord>();
  readonly #remoteAssetTypeIds = new WeakMap<object, number>();
  readonly #runtimeAssets = new RuntimeAssetStore();
  readonly #sources: ReadonlyMap<string, ArtifactSource>;
  #graphArtifactSession: Map<string, Promise<Artifact>> | undefined;
  #graphQueue: Promise<void> = Promise.resolve();
  #nextRemoteAssetTypeId = 1;
  #queuedGraphLoads = 0;

  #missingAssetHandle<TAsset extends CycloAsset>(
    id: AssetId,
    options: AssetLoadOptions,
  ): AssetHandle<TAsset> {
    return this.#operations.acquire<TAsset>(
      {
        resourceId: `missing:${id}`,
        recordRevision: '',
        runtimeVariant: '',
      },
      id,
      () => Promise.reject(new AssetLoadError(
        id,
        AssetLoadStage.resolve,
        `Asset Catalog key "${id}" does not exist.`,
      )),
      {
        signals: collectSignals(options),
      },
    );
  }

  #loadRecord<TAsset extends CycloAsset>(
    id: AssetId,
    record: AssetRecord,
    options: AssetLoadOptions,
  ): AssetHandle<TAsset> {
    const operationKey = {
      resourceId: record.resourceId,
      recordRevision: record.revision,
      runtimeVariant: this.#configuration.runtimeVariant ?? '',
    };
    const loadingReservation = this.#runtimeAssets.retainCache(
      record.resourceId,
    );
    let loadingReservationReleased = false;
    const releaseLoadingReservation = (): void => {
      if (loadingReservationReleased) {
        return;
      }
      loadingReservationReleased = true;
      loadingReservation.release();
    };
    let constructionLease: RuntimeAssetLease | undefined;
    const releaseConstructionLease = (): void => {
      const lease = constructionLease;
      constructionLease = undefined;
      lease?.release();
    };

    try {
      return this.#operations.acquire<TAsset>(
        operationKey,
        id,
        async (signal) => {
          try {
            return await this.#withGraphLock(
              signal,
              (graphArtifacts) => this.#loadManagedGraph<TAsset>(
                id,
                record,
                graphArtifacts,
                signal,
                (lease) => {
                  if (constructionLease !== undefined) {
                    throw new Error(
                      'The managed graph already has a construction lease.',
                    );
                  }
                  constructionLease = lease;
                },
              ),
            );
          } catch (error) {
            releaseConstructionLease();
            throw error;
          }
        },
        {
          afterDelivery: releaseConstructionLease,
          disposeUnclaimed: () => {
            releaseConstructionLease();
          },
          releaseLoadingReservation,
          signals: collectSignals(options),
          retain: () => {
            const lease = this.#runtimeAssets.retainConsumer(record.resourceId);
            return () => {
              lease.release();
            };
          },
        },
      );
    } catch (error) {
      releaseLoadingReservation();
      throw error;
    }
  }

  async #loadManagedGraph<TAsset extends CycloAsset>(
    assetId: AssetId,
    rootRecord: AssetRecord,
    graphArtifacts: Map<string, Promise<Artifact>>,
    signal: AbortSignal,
    retainConstruction: (lease: RuntimeAssetLease) => void,
  ): Promise<TAsset> {
    const ready = this.#runtimeAssets.getReady<TAsset>(rootRecord.resourceId);
    if (ready !== undefined) {
      return ready;
    }

    retainConstruction(
      this.#runtimeAssets.retainCache(rootRecord.resourceId),
    );

    const nodes = new Map<AssetResourceId, GraphNode>();
    try {
      await this.#discoverGraph(
        assetId,
        rootRecord,
        nodes,
        graphArtifacts,
        signal,
      );
      const components = stronglyConnectedComponents(nodes);
      for (const component of components) {
        throwIfAborted(assetId, signal);
        const componentNodes = component
          .map((resourceId) => requireGraphNode(nodes, resourceId))
          .sort((left, right) => (
            left.record.resourceId.localeCompare(right.record.resourceId)
          ));

        for (const node of componentNodes) {
          for (
            const [binding, dependencyResourceId]
            of node.dependencyBindings
          ) {
            const dependency = this.#runtimeAssets.getShell(
              dependencyResourceId,
            );
            if (dependency === undefined) {
              throw new AssetLoadError(
                assetId,
                AssetLoadStage.link,
                `Dependency "${dependencyResourceId}" has no runtime shell.`,
              );
            }
            if (
              binding.expectedType !== undefined
              && !Object.prototype.isPrototypeOf.call(
                binding.expectedType.prototype,
                dependency,
              )
            ) {
              throw new AssetLoadError(
                assetId,
                AssetLoadStage.link,
                `Dependency "${dependencyResourceId}" does not match `
                + 'the serialized Cocos asset type.',
              );
            }
            if (!Reflect.set(binding.owner, binding.property, dependency)) {
              throw new AssetLoadError(
                assetId,
                AssetLoadStage.link,
                `Dependency "${dependencyResourceId}" could not be assigned `
                + `to property "${binding.property}".`,
              );
            }
          }
          this.#runtimeAssets.setDependencies(
            node.record.resourceId,
            node.dependencies,
          );
        }

        for (const node of componentNodes) {
          const binding = node.decoded.nativeBinding;
          if (binding === undefined) {
            continue;
          }

          try {
            if (!Reflect.set(node.decoded.asset, '_nativeAsset', binding.value)) {
              throw new Error(
                `Runtime Asset "${node.record.resourceId}" rejected its `
                + 'native artifact.',
              );
            }
          } catch (error) {
            throw stageError(
              assetId,
              AssetLoadStage.link,
              node.record.resourceId,
              error,
            );
          }
          node.nativeLinked = true;
          this.#runtimeAssets.addCleanup(
            node.record.resourceId,
            binding,
          );
        }
      }

      for (const component of components) {
        throwIfAborted(assetId, signal);
        const componentNodes = component
          .map((resourceId) => requireGraphNode(nodes, resourceId))
          .sort((left, right) => (
            left.record.resourceId.localeCompare(right.record.resourceId)
          ));
        const finalized: AssetResourceId[] = [];
        for (const node of componentNodes) {
          let finalizedAsset: CycloAsset;
          try {
            finalizedAsset = await this.#configuration.finalizer.finalize(
              node.decoded,
              signal,
            );
          } catch (error) {
            throw stageError(
              assetId,
              AssetLoadStage.finalize,
              node.record.resourceId,
              error,
            );
          }
          if (finalizedAsset !== node.decoded.asset) {
            finalizedAsset.destroy();
            throw new AssetLoadError(
              assetId,
              AssetLoadStage.publish,
              `Finalizer for "${node.record.resourceId}" returned a `
              + 'different runtime Asset.',
            );
          }
          finalized.push(node.record.resourceId);
        }
        for (const resourceId of finalized) {
          try {
            this.#runtimeAssets.markReady(resourceId);
          } catch (error) {
            throw stageError(
              assetId,
              AssetLoadStage.publish,
              resourceId,
              error,
            );
          }
        }
      }

      const result = this.#runtimeAssets.getReady<TAsset>(
        rootRecord.resourceId,
      );
      if (result === undefined) {
        throw new AssetLoadError(
          assetId,
          AssetLoadStage.publish,
          `Root asset "${rootRecord.resourceId}" was not published.`,
        );
      }
      return result;
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      for (const node of nodes.values()) {
        if (node.nativeLinked) {
          continue;
        }
        try {
          node.decoded.nativeBinding?.discard();
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      try {
        this.#runtimeAssets.collect();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          [error, ...cleanupErrors],
          `Asset graph "${assetId}" failed and could not be fully cleaned up.`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  async #discoverGraph(
    assetId: AssetId,
    record: AssetRecord,
    nodes: Map<AssetResourceId, GraphNode>,
    graphArtifacts: Map<string, Promise<Artifact>>,
    signal: AbortSignal,
  ): Promise<void> {
    if (
      this.#runtimeAssets.getReady(record.resourceId) !== undefined
      || nodes.has(record.resourceId)
    ) {
      return;
    }

    throwIfAborted(assetId, signal);
    let primaryArtifact: Artifact;
    try {
      primaryArtifact = await this.#acquireArtifact(
        record.primaryArtifact,
        graphArtifacts,
        signal,
      );
    } catch (error) {
      throw stageError(
        assetId,
        AssetLoadStage.acquire,
        record.resourceId,
        error,
      );
    }

    const decoder = this.#decoders.get(record.decoderId);
    if (decoder === undefined) {
      throw new AssetLoadError(
        assetId,
        AssetLoadStage.decode,
        `Decoder "${record.decoderId}" is not registered.`,
      );
    }

    let decoded: DecodedAsset;
    try {
      decoded = await decoder.decode({
        record,
        primaryArtifact,
      }, signal);
    } catch (error) {
      throw stageError(
        assetId,
        AssetLoadStage.decode,
        record.resourceId,
        error,
      );
    }

    let selectedAuxiliaryArtifacts: ReadonlyArray<readonly [string, ArtifactCandidate]>;
    try {
      selectedAuxiliaryArtifacts = record.auxiliaryArtifactSets.map((set) => [
        set.slot,
        decoder.selectAuxiliaryArtifact?.({
          record,
          decoded,
          set,
        }) ?? selectArtifactCandidate(
          set.candidates,
          this.#configuration.artifactVariantPreference ?? [],
        ),
      ]);
    } catch (error) {
      cleanupDecodedAsset(decoded);
      throw stageError(
        assetId,
        AssetLoadStage.decode,
        record.resourceId,
        error,
      );
    }

    const auxiliaryArtifacts = new Map<string, Artifact>();
    try {
      const acquired = await Promise.all(
        selectedAuxiliaryArtifacts.map(
          async ([slot, candidate]): Promise<readonly [string, Artifact]> => [
            slot,
            await this.#acquireArtifact(
              candidate.location,
              graphArtifacts,
              signal,
            ),
          ],
        ),
      );
      for (const [slot, artifact] of acquired) {
        auxiliaryArtifacts.set(slot, artifact);
      }
    } catch (error) {
      cleanupDecodedAsset(decoded);
      throw stageError(
        assetId,
        AssetLoadStage.acquire,
        record.resourceId,
        error,
      );
    }

    let auxiliaryNativeBinding: NativeBinding | undefined;
    try {
      auxiliaryNativeBinding = await decoder.bindAuxiliaryArtifacts?.({
        record,
        decoded,
        auxiliaryArtifacts,
      }, signal);
      throwIfAborted(assetId, signal);
      if (
        decoded.nativeBinding !== undefined
        && auxiliaryNativeBinding !== undefined
      ) {
        throw new Error(
          `Decoder "${decoder.id}" returned more than one native binding.`,
        );
      }
      if (auxiliaryNativeBinding !== undefined) {
        decoded = {
          ...decoded,
          nativeBinding: auxiliaryNativeBinding,
        };
      }
    } catch (error) {
      auxiliaryNativeBinding?.discard();
      cleanupDecodedAsset(decoded);
      throw stageError(
        assetId,
        AssetLoadStage.decode,
        record.resourceId,
        error,
      );
    }

    this.#runtimeAssets.define(record.resourceId, decoded.asset);
    const dependencies = new Set(record.directDependencies);
    const dependencyBindings = new Map<
      DependencyBinding,
      AssetResourceId
    >();
    for (const binding of decoded.dependencyBindings) {
      const dependencyRecord = this.#catalog.resolveCocosUuid(
        binding.cocosUuid,
      );
      if (dependencyRecord === undefined) {
        throw new AssetLoadError(
          assetId,
          AssetLoadStage.link,
          `Cocos dependency UUID "${binding.cocosUuid}" is not in the Catalog.`,
        );
      }
      dependencies.add(dependencyRecord.resourceId);
      dependencyBindings.set(binding, dependencyRecord.resourceId);
    }

    nodes.set(record.resourceId, {
      decoded,
      dependencies,
      dependencyBindings,
      record,
      nativeLinked: false,
    });
    this.#runtimeAssets.setDependencies(
      record.resourceId,
      dependencies,
    );

    for (const dependencyResourceId of dependencies) {
      if (
        this.#runtimeAssets.getReady(dependencyResourceId) !== undefined
      ) {
        continue;
      }
      const dependencyRecord = this.#catalog.resolveResource(
        dependencyResourceId,
      );
      if (dependencyRecord === undefined) {
        throw new AssetLoadError(
          assetId,
          AssetLoadStage.resolve,
          `Dependency resource "${dependencyResourceId}" is not in the Catalog.`,
        );
      }
      await this.#discoverGraph(
        assetId,
        dependencyRecord,
        nodes,
        graphArtifacts,
        signal,
      );
    }
  }

  async #acquireArtifact(
    location: ArtifactLocation,
    graphArtifacts: Map<string, Promise<Artifact>>,
    signal: AbortSignal,
  ): Promise<Artifact> {
    const operationKey = this.#artifactOperationKey(location);
    const graphArtifact = graphArtifacts.get(operationKey);
    if (graphArtifact !== undefined) {
      return graphArtifact;
    }

    const operation = this.#acquireSharedArtifact(location, signal);
    graphArtifacts.set(operationKey, operation);
    return this.#awaitGraphArtifact(
      operationKey,
      operation,
      graphArtifacts,
    );
  }

  async #acquireSharedArtifact(
    location: ArtifactLocation,
    signal: AbortSignal,
  ): Promise<Artifact> {
    const { hash } = location;
    const { integrityPolicy } = this.#configuration;
    if (
      integrityPolicy === AssetIntegrityPolicy.required
      && hash === undefined
    ) {
      throw new AssetIntegrityError(
        `Artifact "${location.key}" requires a SHA-256 hash.`,
        {
          location: location.key,
          sourceId: location.sourceId,
        },
      );
    }
    if (
      hash !== undefined
      && integrityPolicy !== AssetIntegrityPolicy.disabled
    ) {
      validateSha256Hash(hash);
    }

    const operationKey = this.#artifactOperationKey(location);
    const cacheKey = this.#artifactCacheKey(location);
    const cached = this.#artifactCache.get(cacheKey);
    if (cached !== undefined) {
      return adaptArtifactToLocation(cached, location);
    }

    const artifact = await this.#artifactOperations.acquire(
      operationKey,
      signal,
      async (operationSignal) => {
        const source = this.#sources.get(location.sourceId);
        if (source === undefined) {
          throw new Error(
            `Artifact source "${location.sourceId}" is not registered.`,
          );
        }

        const acquired = await source.acquire(
          location,
          operationSignal,
          this.#configuration.onArtifactProgress === undefined
            ? undefined
            : (progress) => {
              this.#configuration.onArtifactProgress?.(location, progress);
            },
        );
        try {
          const cacheable = await this.#verifyArtifactIntegrity(
            location,
            acquired,
            operationSignal,
          );
          if (cacheable && acquired.kind === ArtifactKind.bytes) {
            this.#artifactCache.set(cacheKey, acquired);
          }
          return acquired;
        } catch (error) {
          releaseArtifact(acquired);
          throw error;
        }
      },
    );
    return adaptArtifactToLocation(artifact, location);
  }

  #artifactCacheKey(location: ArtifactLocation): string {
    if (this.#configuration.integrityPolicy !== AssetIntegrityPolicy.disabled) {
      const hashKey = encodeArtifactHashCacheKey(location);
      if (hashKey !== undefined) {
        return hashKey;
      }
    }
    return encodeArtifactLocationCacheKey(location);
  }

  #artifactOperationKey(location: ArtifactLocation): string {
    const { integrityPolicy } = this.#configuration;
    if (
      integrityPolicy !== AssetIntegrityPolicy.disabled
      && integrityPolicy !== AssetIntegrityPolicy.diagnostics
    ) {
      const hashKey = encodeArtifactHashCacheKey(location);
      if (hashKey !== undefined) {
        return hashKey;
      }
    }
    return encodeArtifactLocationCacheKey(location);
  }

  async #verifyArtifactIntegrity(
    location: ArtifactLocation,
    artifact: Artifact,
    signal: AbortSignal,
  ): Promise<boolean> {
    const { hash } = location;
    const { integrityPolicy } = this.#configuration;
    if (
      hash === undefined
      || integrityPolicy === AssetIntegrityPolicy.disabled
    ) {
      return true;
    }

    let actualHash: string | undefined;
    let integrityError: AssetIntegrityError | undefined;
    if (artifact.kind !== ArtifactKind.bytes) {
      integrityError = new AssetIntegrityError(
        'Content hashes can only be verified for byte artifacts.',
        {
          expectedHash: hash,
          location: location.key,
          sourceId: location.sourceId,
        },
      );
    } else {
      throwIfAborted(location.key, signal);
      try {
        actualHash = await calculateSha256Hash(
          artifact.bytes,
          this.#configuration.sha256,
        );
      } catch (cause) {
        const causeMessage = cause instanceof Error
          ? cause.message
          : String(cause);
        integrityError = new AssetIntegrityError(
          `Unable to verify artifact "${location.key}" against ${hash}: `
          + causeMessage,
          {
            byteSize: artifact.bytes.byteLength,
            expectedHash: hash,
            location: location.key,
            sourceId: location.sourceId,
          },
          { cause },
        );
      }
      throwIfAborted(location.key, signal);
      if (integrityError === undefined) {
        if (actualHash === undefined) {
          throw new Error('SHA-256 verification did not produce a result.');
        }
        if (actualHash.toLowerCase() !== hash.toLowerCase()) {
          integrityError = new AssetIntegrityError(
            `Artifact "${location.key}" does not match ${hash}.`,
            {
              actualHash,
              byteSize: artifact.bytes.byteLength,
              expectedHash: hash,
              location: location.key,
              sourceId: location.sourceId,
            },
          );
        }
      }
    }

    if (integrityError === undefined) {
      return true;
    }
    if (integrityPolicy !== AssetIntegrityPolicy.diagnostics) {
      throw integrityError;
    }
    this.#configuration.onIntegrityDiagnostic?.(integrityError);
    return false;
  }

  async #withGraphLock<T>(
    signal: AbortSignal,
    execute: (
      graphArtifacts: Map<string, Promise<Artifact>>,
    ) => Promise<T>,
  ): Promise<T> {
    const graphArtifacts = this.#graphArtifactSession
      ?? new Map<string, Promise<Artifact>>();
    this.#graphArtifactSession = graphArtifacts;
    this.#queuedGraphLoads += 1;

    const predecessor = this.#graphQueue;
    let release!: () => void;
    this.#graphQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await predecessor;
    try {
      if (signal.aborted) {
        throw abortError('managed-graph');
      }
      return await execute(graphArtifacts);
    } finally {
      this.#queuedGraphLoads -= 1;
      if (
        this.#queuedGraphLoads === 0
        && this.#graphArtifactSession === graphArtifacts
      ) {
        this.#graphArtifactSession = undefined;
        releaseGraphArtifacts(graphArtifacts);
      }
      release();
    }
  }

  async #awaitGraphArtifact(
    cacheKey: string,
    artifact: Promise<Artifact>,
    graphArtifacts: Map<string, Promise<Artifact>>,
  ): Promise<Artifact> {
    try {
      return await artifact;
    } catch (error) {
      if (graphArtifacts.get(cacheKey) === artifact) {
        graphArtifacts.delete(cacheKey);
      }
      throw error;
    }
  }

  #remoteOperationKey<TAsset extends CycloAsset>(
    url: string,
    assetType: AssetType<TAsset>,
    format: string | undefined,
  ): {
    resourceId: AssetResourceId;
    recordRevision: string;
    runtimeVariant: string;
  } {
    const typeObject = assetType as object;
    let typeId = this.#remoteAssetTypeIds.get(typeObject);
    if (typeId === undefined) {
      typeId = this.#nextRemoteAssetTypeId;
      this.#nextRemoteAssetTypeId += 1;
      this.#remoteAssetTypeIds.set(typeObject, typeId);
    }
    return {
      resourceId: `remote:${typeId}:${url}`,
      recordRevision: 'remote',
      runtimeVariant: format ?? '',
    };
  }

  #retainRemoteAsset(
    key: string,
    asset: CycloAsset,
    reservation: RemoteAssetReservation | undefined,
  ): () => void {
    const record = this.#remoteAssets.get(key);
    if (record?.asset !== asset || record.destroyed) {
      throw new Error('The remote runtime asset is not published.');
    }
    if (reservation !== undefined && !reservation.released) {
      if (reservation.record !== record || record.reservations === 0) {
        throw new Error('The remote runtime reservation is invalid.');
      }
      reservation.released = true;
      record.reservations -= 1;
    }
    record.count += 1;

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      record.count -= 1;
      if (record.count === 0) {
        this.#disposeRemoteAsset(key, asset);
      }
    };
  }

  #disposeRemoteAsset(
    key: string,
    asset: CycloAsset,
  ): void {
    const record = this.#remoteAssets.get(key);
    if (record === undefined) {
      return;
    }
    if (
      record.asset !== asset
      || record.count !== 0
      || record.reservations !== 0
      || record.destroyed
    ) {
      return;
    }
    record.destroyed = true;
    this.#remoteAssets.delete(key);
    try {
      asset.destroy();
    } finally {
      record.nativeBinding?.release();
    }
  }

  #reserveRemoteAsset(
    key: string,
  ): RemoteAssetReservation | undefined {
    const record = this.#remoteAssets.get(key);
    if (record === undefined || record.destroyed) {
      return undefined;
    }
    record.reservations += 1;
    return {
      record,
      released: false,
    };
  }

  #releaseRemoteReservation(
    reservation: RemoteAssetReservation | undefined,
  ): void {
    if (reservation === undefined || reservation.released) {
      return;
    }
    reservation.released = true;
    reservation.record.reservations -= 1;
  }
}

function collectSignals(options: AssetLoadOptions): readonly AbortSignal[] {
  const signals: AbortSignal[] = [];
  if (options.signal !== undefined) {
    signals.push(options.signal);
  }
  if (options.scope !== undefined) {
    signals.push(options.scope.signal);
  }
  return signals;
}

function adaptArtifactToLocation(
  artifact: Artifact,
  location: ArtifactLocation,
): Artifact {
  return {
    ...artifact,
    format: location.format,
    sourceId: location.sourceId,
  };
}

function releaseGraphArtifacts(
  artifacts: Map<string, Promise<Artifact>>,
): void {
  const pending = Array.from(artifacts.values());
  artifacts.clear();
  for (const artifact of pending) {
    void artifact.then(
      releaseArtifact,
      () => undefined,
    );
  }
}

function uniqueMap<T>(
  values: readonly T[],
  id: (value: T) => string,
  kind: string,
): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const key = id(value);
    if (result.has(key)) {
      throw new Error(`Duplicate ${kind} id "${key}".`);
    }
    result.set(key, value);
  }
  return result;
}

function selectArtifactCandidate<T extends {
  readonly variant?: string;
}>(
  candidates: readonly T[],
  variantPreference: readonly string[],
): T {
  for (const variant of variantPreference) {
    const preferred = candidates.find((value) => value.variant === variant);
    if (preferred !== undefined) {
      return preferred;
    }
  }

  const candidate = candidates.find((value) => value.variant === undefined);
  if (candidate === undefined) {
    throw new Error('No default artifact candidate is available.');
  }
  return candidate;
}

function cleanupDecodedAsset(decoded: DecodedAsset): void {
  decoded.nativeBinding?.discard();
  decoded.asset.destroy();
}

function validateSha256Hash(expected: string): void {
  const prefix = 'sha256:';
  if (!expected.startsWith(prefix)) {
    throw new Error(
      `Unsupported artifact hash "${expected}"; expected sha256:<hex>.`,
    );
  }
  const expectedHex = expected.slice(prefix.length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) {
    throw new Error(`Invalid SHA-256 hash "${expected}".`);
  }
}

async function calculateSha256Hash(
  bytes: Uint8Array,
  sha256: Sha256,
): Promise<string> {
  const digest = await sha256(bytes);
  if (digest.byteLength !== 32) {
    throw new Error(
      `SHA-256 implementation returned ${digest.byteLength} bytes; expected 32.`,
    );
  }
  const actualHex = Array.from(digest, (value) => (
    value.toString(16).padStart(2, '0')
  )).join('');
  return `sha256:${actualHex}`;
}

function stageError(
  assetId: AssetId,
  stage: AssetLoadStage,
  resourceId: AssetResourceId,
  cause: unknown,
): AssetLoadError {
  return cause instanceof AssetLoadError
    ? cause
    : new AssetLoadError(
      assetId,
      stage,
      `Asset resource "${resourceId}" failed during ${stage}.`,
      { cause },
    );
}

function abortError(assetId: AssetId): Error {
  const error = new Error(`Loading asset "${assetId}" was aborted.`);
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(assetId: AssetId, signal: AbortSignal): void {
  if (signal.aborted) {
    throw abortError(assetId);
  }
}

function requireGraphNode(
  nodes: ReadonlyMap<AssetResourceId, GraphNode>,
  resourceId: AssetResourceId,
): GraphNode {
  const node = nodes.get(resourceId);
  if (node === undefined) {
    throw new Error(`Graph node "${resourceId}" does not exist.`);
  }
  return node;
}

function stronglyConnectedComponents(
  nodes: ReadonlyMap<AssetResourceId, GraphNode>,
): ReadonlyArray<readonly AssetResourceId[]> {
  let nextIndex = 0;
  const indices = new Map<AssetResourceId, number>();
  const lowLinks = new Map<AssetResourceId, number>();
  const stack: AssetResourceId[] = [];
  const onStack = new Set<AssetResourceId>();
  const components: AssetResourceId[][] = [];

  const visit = (resourceId: AssetResourceId): void => {
    indices.set(resourceId, nextIndex);
    lowLinks.set(resourceId, nextIndex);
    nextIndex += 1;
    stack.push(resourceId);
    onStack.add(resourceId);

    const node = requireGraphNode(nodes, resourceId);
    for (const dependency of node.dependencies) {
      if (!nodes.has(dependency)) {
        continue;
      }
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(
          resourceId,
          Math.min(
            requireNumber(lowLinks, resourceId),
            requireNumber(lowLinks, dependency),
          ),
        );
      } else if (onStack.has(dependency)) {
        lowLinks.set(
          resourceId,
          Math.min(
            requireNumber(lowLinks, resourceId),
            requireNumber(indices, dependency),
          ),
        );
      }
    }

    if (
      requireNumber(lowLinks, resourceId)
      !== requireNumber(indices, resourceId)
    ) {
      return;
    }

    const component: AssetResourceId[] = [];
    while (stack.length > 0) {
      const member = stack.pop();
      if (member === undefined) {
        break;
      }
      onStack.delete(member);
      component.push(member);
      if (member === resourceId) {
        break;
      }
    }
    components.push(component);
  };

  for (const resourceId of nodes.keys()) {
    if (!indices.has(resourceId)) {
      visit(resourceId);
    }
  }
  return components;
}

function requireNumber(
  values: ReadonlyMap<AssetResourceId, number>,
  resourceId: AssetResourceId,
): number {
  const value = values.get(resourceId);
  if (value === undefined) {
    throw new Error(`Graph index for "${resourceId}" does not exist.`);
  }
  return value;
}
