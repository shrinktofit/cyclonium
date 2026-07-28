export const ASSET_CATALOG_SCHEMA_VERSION = 1 as const;

export interface AssetCatalogPointer {
  readonly type: 'cyclo-asset-catalog-pointer';
  readonly version: typeof ASSET_CATALOG_SCHEMA_VERSION;
  readonly url: string;
  readonly sha256: string;
  readonly byteLength: number;
}

export interface SerializedAssetCatalog {
  readonly type: 'cyclo-asset-catalog';
  readonly version: typeof ASSET_CATALOG_SCHEMA_VERSION;
  readonly keys: readonly SerializedCatalogKey[];
  readonly cocosUuids: readonly SerializedCocosUuid[];
  readonly records: readonly SerializedAssetRecord[];
}

export interface SerializedCatalogKey {
  readonly key: string;
  readonly resourceIds: readonly string[];
}

export interface SerializedCocosUuid {
  readonly uuid: string;
  readonly resourceId: string;
}

export interface SerializedAssetRecord {
  readonly resourceId: string;
  readonly cocosUuid?: string;
  readonly runtimeTypeId: string;
  readonly primaryArtifact: SerializedArtifactLocation;
  readonly auxiliaryArtifactSets: readonly SerializedAuxiliaryArtifactSet[];
  readonly directDependencies: readonly string[];
  readonly decoderId: string;
}

export interface SerializedAuxiliaryArtifactSet {
  readonly slot: string;
  readonly candidates: readonly SerializedArtifactCandidate[];
}

export interface SerializedArtifactCandidate {
  readonly variant?: string;
  readonly location: SerializedArtifactLocation;
}

export interface SerializedArtifactLocation {
  readonly key: string;
  readonly format: string;
  readonly byteSize?: number;
  readonly entry?: SerializedArtifactEntry;
  readonly preferredKind?: 'bytes' | 'platform-file';
  readonly redirectBundleName?: string;
}

export interface SerializedArtifactEntry {
  readonly kind: 'bin-pack-v2';
  readonly index: number;
}
