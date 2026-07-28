import type { AbortSignal } from '@cyclonium/abort-controller';

import type {
  Artifact,
  ArtifactAcquisitionProgress,
  ArtifactLocation,
  ArtifactCandidate,
  AssetCatalog,
  AssetDecoderId,
  AssetRecord,
  ArtifactSourceId,
  AuxiliaryArtifactSet,
  DecodedAsset,
  NativeBinding,
} from './model.js';
import type {
  AssetIntegrityError,
  AssetIntegrityPolicy,
  AssetType,
  CycloAsset,
} from './public.js';

export interface ArtifactSource {
  readonly id: ArtifactSourceId;

  acquire(
    location: ArtifactLocation,
    signal: AbortSignal,
    reportProgress?: (progress: ArtifactAcquisitionProgress) => void,
  ): Promise<Artifact>;
}

export interface AssetDecodeContext {
  readonly record: AssetRecord;
  readonly primaryArtifact: Artifact;
}

export interface AssetAuxiliaryArtifactSelectionContext {
  readonly record: AssetRecord;
  readonly decoded: DecodedAsset;
  readonly set: AuxiliaryArtifactSet;
}

export interface AssetAuxiliaryArtifactBindingContext {
  readonly record: AssetRecord;
  readonly decoded: DecodedAsset;
  readonly auxiliaryArtifacts: ReadonlyMap<string, Artifact>;
}

export interface AssetDecoder {
  readonly id: AssetDecoderId;

  decode(
    context: AssetDecodeContext,
    signal: AbortSignal,
  ): Promise<DecodedAsset>;

  selectAuxiliaryArtifact?(
    context: AssetAuxiliaryArtifactSelectionContext,
  ): ArtifactCandidate;

  bindAuxiliaryArtifacts?(
    context: AssetAuxiliaryArtifactBindingContext,
    signal: AbortSignal,
  ): Promise<NativeBinding | undefined>;
}

export interface AssetFinalizer {
  finalize(
    decoded: DecodedAsset,
    signal: AbortSignal,
  ): Promise<CycloAsset>;
}

export type Sha256 = (bytes: Uint8Array) => Promise<Uint8Array>;

export interface RemoteAssetRequest<TAsset extends CycloAsset> {
  readonly url: string;
  readonly assetType: AssetType<TAsset>;
  readonly explicitFormat?: string;
}

export interface RemoteAssetInstantiation<TAsset extends CycloAsset> {
  readonly asset: TAsset;
  readonly nativeBinding?: NativeBinding;
}

export interface RemoteAssetLoader {
  supports<TAsset extends CycloAsset>(
    assetType: AssetType<TAsset>,
  ): boolean;

  resolve<TAsset extends CycloAsset>(
    request: RemoteAssetRequest<TAsset>,
  ): ArtifactLocation;

  instantiate<TAsset extends CycloAsset>(
    request: RemoteAssetRequest<TAsset>,
    artifact: Artifact,
    signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<TAsset>>;
}

export interface AssetRuntimeConfiguration {
  readonly catalog: AssetCatalog;
  readonly sources: readonly ArtifactSource[];
  readonly decoders: readonly AssetDecoder[];
  readonly finalizer: AssetFinalizer;
  readonly remoteAssetLoader: RemoteAssetLoader;
  readonly sha256: Sha256;
  readonly integrityPolicy: AssetIntegrityPolicy;
  readonly onIntegrityDiagnostic?: (
    error: AssetIntegrityError,
  ) => void;
  readonly artifactCacheByteBudget: number;
  readonly artifactVariantPreference?: readonly string[];
  readonly onArtifactProgress?: (
    location: ArtifactLocation,
    progress: ArtifactAcquisitionProgress,
  ) => void;
  readonly runtimeVariant?: string;
}
