import type {
  IBuildResult,
  Platform,
} from '@cocos/creator-types/editor/packages/builder/@types/public';

import type {
  CatalogArtifactIndex,
  IndexedAsset,
} from './artifact-index.js';
import {
  buildOutputUrl,
  createImportArtifact,
  createNativeArtifact,
} from './artifact-path.js';
import { CatalogCompileError } from './catalog-compiler.js';
import { CocosBuilderAbi } from './cocos-builder-abi.js';

export class BuildResultArtifactIndex implements CatalogArtifactIndex {
  constructor(
    abi: CocosBuilderAbi,
    result: IBuildResult,
    platform: Platform,
  ) {
    this.#abi = abi;
    this.#result = result;
    this.#platform = platform;
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
  readonly #platform: Platform;
  readonly #result: IBuildResult;
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

    const importPathInfos = this.#result.getAssetPathInfo(uuid)
      .filter((pathInfo) => pathInfo.json !== undefined)
      .sort((left, right) => (left.json ?? '').localeCompare(right.json ?? ''));
    const distinctImportPaths = new Set(importPathInfos.map((pathInfo) => pathInfo.json));
    if (distinctImportPaths.size > 1) {
      throw new CatalogCompileError(
        `Build result exposes multiple import artifacts for "${info.url}" (${uuid}); `
        + 'the compiler cannot choose one deterministically.',
      );
    }
    const importPathInfo = importPathInfos[0];
    const primaryArtifact = importPathInfo?.json === undefined
      ? undefined
      : createImportArtifact(
        buildOutputUrl(this.#result.paths.output, importPathInfo.json),
        importPathInfo.groupIndex,
        importPathInfo.redirect,
      );

    const nativeArtifacts = this.#result.getRawAssetPaths(uuid)
      .flatMap((pathInfo) => pathInfo.raw.map((path) => createNativeArtifact(
        buildOutputUrl(this.#result.paths.output, path),
        this.#platform,
        pathInfo.redirect,
      )))
      .sort((left, right) => left.location.key.localeCompare(right.location.key));

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
