import type {
  AssetType,
  CycloAsset,
} from './public.js';
import type { ArtifactLease } from './artifact-lifetime.js';

export type AssetResourceId = string;
export type CocosUuid = string;
export type ArtifactSourceId = string;
export type AssetDecoderId = string;

export enum ArtifactKind {
  bytes = 'bytes',
  platformFile = 'platform-file',
}

export interface ByteArtifact {
  readonly kind: ArtifactKind.bytes;
  readonly bytes: Uint8Array;
  readonly format: string;
  readonly sourceId: ArtifactSourceId;
  readonly contentType?: string;
}

export interface PlatformFileArtifact {
  readonly kind: ArtifactKind.platformFile;
  readonly path: string;
  readonly lease: ArtifactLease;
  readonly format: string;
  readonly sourceId: ArtifactSourceId;
  readonly contentType?: string;
}

export type Artifact = ByteArtifact | PlatformFileArtifact;

export interface ArtifactAcquisitionProgress {
  readonly loadedBytes: number;
  readonly totalBytes?: number;
}

export enum ArtifactEntryKind {
  binPackV2 = 'bin-pack-v2',
}

export interface ArtifactEntry {
  readonly kind: ArtifactEntryKind;
  readonly index: number;
}

export interface ArtifactLocation {
  readonly sourceId: ArtifactSourceId;
  readonly key: string;
  readonly format: string;
  readonly hash?: string;
  readonly byteSize?: number;
  readonly revision?: string;
  readonly entry?: ArtifactEntry;
  readonly preferredKind?: ArtifactKind;
  readonly redirectBundleName?: string;
}

export interface ArtifactCandidate {
  readonly variant?: string;
  readonly location: ArtifactLocation;
}

export interface AuxiliaryArtifactSet {
  readonly slot: string;
  readonly candidates: readonly ArtifactCandidate[];
}

export interface AssetRecord {
  readonly resourceId: AssetResourceId;
  readonly cocosUuid?: CocosUuid;
  readonly runtimeTypeId: string;
  readonly primaryArtifact: ArtifactLocation;
  readonly auxiliaryArtifactSets: readonly AuxiliaryArtifactSet[];
  readonly directDependencies: readonly AssetResourceId[];
  readonly revision: string;
  readonly decoderId: AssetDecoderId;
}

export interface AssetCatalog {
  readonly revision: string;
  readonly keys: ReadonlyMap<string, readonly AssetResourceId[]>;
  readonly cocosUuids: ReadonlyMap<CocosUuid, AssetResourceId>;
  readonly records: ReadonlyMap<AssetResourceId, AssetRecord>;
}

export interface DependencyBinding {
  readonly cocosUuid: CocosUuid;
  readonly owner: object;
  readonly property: string;
  readonly expectedType?: AssetType<CycloAsset>;
}

export interface NativeBinding {
  readonly value: unknown;
  discard(): void;
  release(): void;
}

export interface DecodedAsset {
  readonly asset: CycloAsset;
  readonly dependencyBindings: readonly DependencyBinding[];
  readonly nativeBinding?: NativeBinding;
}

export interface ResolvedAsset {
  readonly catalogRevision: string;
  readonly record: AssetRecord;
}

export interface OperationKey {
  readonly resourceId: AssetResourceId;
  readonly recordRevision: string;
  readonly runtimeVariant: string;
}
