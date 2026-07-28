import type {
  CatalogArtifactIndex,
  IndexedAsset,
} from './artifact-index.js';
import {
  createImportArtifact,
  createNativeArtifact,
} from './artifact-path.js';
import { CatalogCompileError } from './catalog-compiler.js';
import { CocosBuilderAbi } from './cocos-builder-abi.js';

export class PreviewArtifactIndex implements CatalogArtifactIndex {
  constructor(abi: CocosBuilderAbi) {
    this.#abi = abi;
  }

  queryAsset(uuid: string): Promise<IndexedAsset | undefined> {
    let cached = this.#cache.get(uuid);
    if (cached === undefined) {
      cached = this.#queryAsset(uuid);
      this.#cache.set(uuid, cached);
    }
    return cached;
  }

  async queryAssetsUnder(directoryUrl: string): Promise<readonly IndexedAsset[]> {
    const infos = await this.#abi.queryAssetsUnder(directoryUrl);
    const assets = await Promise.all(infos.map((info) => this.queryAsset(info.uuid)));
    return assets.filter((asset): asset is IndexedAsset => asset !== undefined);
  }

  readonly #abi: CocosBuilderAbi;
  readonly #cache = new Map<string, Promise<IndexedAsset | undefined>>();

  async #queryAsset(uuid: string): Promise<IndexedAsset | undefined> {
    const info = await this.#abi.queryAsset(uuid);
    if (info === undefined) {
      return undefined;
    }
    if (info.isDirectory) {
      return {
        uuid: info.uuid,
        url: info.url,
        runtimeTypeId: info.type,
        isDirectory: true,
        directDependencies: [],
        nativeArtifacts: [],
      };
    }

    const libraryEntries = Object.entries(info.library)
      .sort(([left], [right]) => left.localeCompare(right));
    const json = libraryEntries.find(([extension]) => extension === '.json');
    const binaryImportCandidates = json === undefined
      ? libraryEntries.filter(([extension]) => (
        extension === '.bin' || extension === '.cconb'
      ))
      : [];
    if (binaryImportCandidates.length > 1) {
      throw new CatalogCompileError(
        `Preview Asset "${info.url}" exposes multiple binary import artifacts: ${binaryImportCandidates
          .map(([extension]) => extension)
          .join(', ')}.`,
      );
    }
    const cconb = binaryImportCandidates[0];
    const primary = json ?? cconb;
    const primaryArtifact = primary === undefined
      ? undefined
      : createImportArtifact(importPreviewUrl(info.uuid, primary[0]));
    const nativeArtifacts = libraryEntries
      .filter((entry) => entry !== primary)
      .map(([libraryKey]) => createNativeArtifact(
        nativePreviewUrl(info.uuid, libraryKey),
        'web-desktop',
      ));

    return {
      uuid: info.uuid,
      url: info.url,
      runtimeTypeId: info.type,
      isDirectory: false,
      directDependencies: await this.#abi.queryDirectAssetDependencies(uuid),
      ...(primaryArtifact === undefined ? {} : { primaryArtifact }),
      nativeArtifacts,
    };
  }
}

export function importPreviewUrl(uuid: string, libraryKey: string): string {
  const extension = libraryKey === '.bin' ? '.cconb' : libraryKey;
  return `/${uuidPrefix(uuid)}/${uuid}${extension}`;
}

export function nativePreviewUrl(uuid: string, libraryKey: string): string {
  if (libraryKey.startsWith('.')) {
    return `/${uuidPrefix(uuid)}/${uuid}${libraryKey}`;
  }
  return `/${uuidPrefix(uuid)}/${uuid}/${encodeURIComponent(libraryKey)}`;
}

function uuidPrefix(uuid: string): string {
  return uuid.split('@')[0].slice(0, 2).toLowerCase();
}
