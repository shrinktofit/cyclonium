export interface CatalogArtifactIndex {
  queryAsset(uuid: string): Promise<IndexedAsset | undefined>;
  queryAssetsUnder(directoryUrl: string): Promise<readonly IndexedAsset[]>;
}

export interface IndexedAsset {
  readonly uuid: string;
  readonly url: string;
  readonly runtimeTypeId: string;
  readonly isDirectory: boolean;
  readonly directDependencies: readonly string[];
  readonly primaryArtifact?: IndexedArtifactLocation;
  readonly nativeArtifacts: readonly IndexedNativeArtifact[];
}

export interface IndexedNativeArtifact {
  readonly variant?: NativeArtifactVariant;
  readonly location: IndexedArtifactLocation;
}

export enum NativeArtifactVariant {
  astc = 'astc',
  pvr = 'pvr',
  pkmEtc1 = 'pkm-etc1',
  pkmEtc2 = 'pkm-etc2',
  webp = 'webp',
}

export interface IndexedArtifactLocation {
  readonly key: string;
  readonly format: string;
  readonly byteSize?: number;
  readonly entry?: IndexedArtifactEntry;
  readonly preferredKind?: 'bytes' | 'platform-file';
  readonly redirectBundleName?: string;
}

export interface IndexedArtifactEntry {
  readonly kind: 'bin-pack-v2';
  readonly index: number;
}
