import type { AbortSignal } from '@cyclonium/abort-controller';

import type {
  RemoteAssetLoader,
  RemoteAssetInstantiation,
  RemoteAssetRequest,
} from './contracts.js';
import type {
  Artifact,
  ArtifactLocation,
  ArtifactSourceId,
} from './model.js';
import type {
  AssetType,
  CycloAsset,
} from './public.js';

export interface RemoteAssetProvider {
  readonly assetType: AssetType<CycloAsset>;

  resolve(
    request: RemoteAssetRequest<CycloAsset>,
    sourceId: ArtifactSourceId,
  ): ArtifactLocation;

  instantiate(
    request: RemoteAssetRequest<CycloAsset>,
    artifact: Artifact,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<CycloAsset>>;
}

export class RemoteAssetTypeRegistry implements RemoteAssetLoader {
  constructor(
    sourceId: ArtifactSourceId,
    providers: readonly RemoteAssetProvider[],
  ) {
    this.#sourceId = sourceId;
    for (const provider of providers) {
      if (this.#providers.has(provider.assetType)) {
        throw new Error(
          'A remote asset provider is already registered for this AssetType.',
        );
      }
      this.#providers.set(provider.assetType, provider);
    }
  }

  supports<TAsset extends CycloAsset>(
    assetType: AssetType<TAsset>,
  ): boolean {
    return this.#providers.has(assetType);
  }

  resolve<TAsset extends CycloAsset>(
    request: RemoteAssetRequest<TAsset>,
  ): ArtifactLocation {
    return this.#provider(request.assetType).resolve(
      request,
      this.#sourceId,
    );
  }

  instantiate<TAsset extends CycloAsset>(
    request: RemoteAssetRequest<TAsset>,
    artifact: Artifact,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<TAsset>> {
    return this.#provider(request.assetType).instantiate(
      request,
      artifact,
      signal,
    ) as Promise<RemoteAssetInstantiation<TAsset>>;
  }

  readonly #providers = new Map<
    AssetType<CycloAsset>,
    RemoteAssetProvider
  >();

  readonly #sourceId: ArtifactSourceId;

  #provider<TAsset extends CycloAsset>(
    assetType: AssetType<TAsset>,
  ): RemoteAssetProvider {
    const provider = this.#providers.get(assetType);
    if (provider === undefined) {
      throw new Error(
        'No remote asset provider is registered for the requested AssetType.',
      );
    }
    return provider;
  }
}
