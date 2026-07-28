import { readdir } from 'node:fs/promises';
import {
  basename,
  extname,
  join,
  relative,
} from 'node:path';

import type {
  IBundleConfig,
  Platform,
} from '@cocos/creator-types/editor/packages/builder/@types/public';

import type {
  CatalogArtifactIndex,
  IndexedAsset,
  IndexedArtifactLocation,
  IndexedNativeArtifact,
} from './artifact-index.js';
import { createNativeArtifact } from './artifact-path.js';
import { CatalogCompileError } from './catalog-compiler.js';
import { CocosBuilderAbi } from './cocos-builder-abi.js';

export interface BundleConfigSource {
  readonly config: IBundleConfig;
  readonly directory: string;
}

interface BundleArtifactData {
  readonly source: BundleConfigSource;
  readonly files: readonly string[];
  readonly uuids: readonly string[];
  readonly uuidSet: ReadonlySet<string>;
  readonly packs: ReadonlyMap<string, readonly string[]>;
  readonly extensions: ReadonlyMap<string, ReadonlySet<string>>;
  readonly importVersions: ReadonlyMap<string, string>;
  readonly nativeVersions: ReadonlyMap<string, string>;
  readonly redirects: ReadonlyMap<string, string>;
}

export class BundleConfigArtifactIndex implements CatalogArtifactIndex {
  static async create(
    abi: CocosBuilderAbi,
    sources: readonly BundleConfigSource[],
    publicRoot: string,
    platform: Platform,
  ): Promise<BundleConfigArtifactIndex> {
    const bundles = await Promise.all(sources.map(async (source) => processBundle(
      abi,
      source,
      await listFiles(source.directory),
    )));
    return new BundleConfigArtifactIndex(abi, bundles, publicRoot, platform);
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

  private constructor(
    abi: CocosBuilderAbi,
    bundles: readonly BundleArtifactData[],
    publicRoot: string,
    platform: Platform,
  ) {
    this.#abi = abi;
    this.#bundles = bundles;
    this.#publicRoot = publicRoot;
    this.#platform = platform;
  }

  readonly #abi: CocosBuilderAbi;
  readonly #bundles: readonly BundleArtifactData[];
  readonly #platform: Platform;
  readonly #publicRoot: string;
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
    const declaringBundle = this.#bundles.find((bundle) => bundle.uuidSet.has(uuid));
    if (declaringBundle === undefined) {
      throw new CatalogCompileError(
        `Built Cocos Bundle configs do not contain "${info.url}" (${uuid}).`,
      );
    }
    const redirectBundleName = declaringBundle.redirects.get(uuid);
    const physicalBundle = redirectBundleName === undefined
      ? declaringBundle
      : this.#bundles.find((bundle) => bundle.source.config.name === redirectBundleName);
    if (physicalBundle === undefined) {
      throw new CatalogCompileError(
        `Asset "${uuid}" redirects to missing Cocos Bundle "${redirectBundleName}".`,
      );
    }
    return {
      uuid: info.uuid,
      url: info.url,
      runtimeTypeId: info.type,
      isDirectory: false,
      directDependencies: await this.#abi.queryDirectAssetDependencies(uuid),
      primaryArtifact: this.#importArtifact(physicalBundle, uuid, redirectBundleName),
      nativeArtifacts: this.#nativeArtifacts(physicalBundle, uuid, redirectBundleName),
    };
  }

  #importArtifact(
    bundle: BundleArtifactData,
    uuid: string,
    redirectBundleName: string | undefined,
  ): IndexedArtifactLocation {
    const packEntry = [...bundle.packs]
      .find(([, packedUuids]) => packedUuids.includes(uuid));
    const artifactUuid = packEntry?.[0] ?? uuid;
    const cconbUuids = bundle.extensions.get('.cconb');
    const isCconbPack = packEntry !== undefined
      && packEntry[1].length > 0
      && cconbUuids?.has(packEntry[1][0]) === true;
    if (packEntry !== undefined && !isCconbPack) {
      throw new CatalogCompileError(
        `Cocos Bundle "${bundle.source.config.name}" contains unsupported JSON pack "${packEntry[0]}".`,
      );
    }
    const isStandaloneCconb = packEntry === undefined
      && cconbUuids?.has(uuid) === true;
    const extension = isCconbPack || isStandaloneCconb ? '.bin' : '.json';
    const version = bundle.importVersions.get(artifactUuid);
    const expectedNames = physicalArtifactNames(
      artifactUuid,
      this.#abi.compressUuid(artifactUuid),
      version,
      extension,
    );
    const file = findUniqueFile(
      bundle,
      (candidate) => expectedNames.has(basename(candidate))
        && candidate.replace(/\\/gu, '/').includes(`/${bundle.source.config.importBase}/`),
      `import artifact ${[...expectedNames].join(' or ')}`,
    );
    return {
      key: this.#publicUrl(file),
      format: extension === '.bin' ? 'cconb' : 'json',
      ...(packEntry === undefined
        ? {}
        : {
          entry: {
            kind: 'bin-pack-v2' as const,
            index: packEntry[1].indexOf(uuid),
          },
        }),
      ...(redirectBundleName === undefined ? {} : { redirectBundleName }),
    };
  }

  #nativeArtifacts(
    bundle: BundleArtifactData,
    uuid: string,
    redirectBundleName: string | undefined,
  ): readonly IndexedNativeArtifact[] {
    const version = bundle.nativeVersions.get(uuid);
    const versionedUuids = physicalArtifactStems(
      uuid,
      this.#abi.compressUuid(uuid),
      version,
    );
    const artifacts: IndexedNativeArtifact[] = [];
    for (const [extension, uuids] of bundle.extensions) {
      if (extension === '.cconb' || !uuids.has(uuid)) {
        continue;
      }
      const matchingFiles = bundle.files.filter((file) => {
        const normalized = file.replace(/\\/gu, '/');
        if (!normalized.includes(`/${bundle.source.config.nativeBase}/`)) {
          return false;
        }
        if (extension === '.ttf') {
          return [...versionedUuids].some((versionedUuid) => (
            normalized.includes(`/${versionedUuid}/`)
          )) && extname(file) === extension;
        }
        return [...versionedUuids].some((versionedUuid) => (
          basename(file) === `${versionedUuid}${extension}`
        ));
      });
      if (matchingFiles.length === 0) {
        throw new CatalogCompileError(
          `Cocos Bundle "${bundle.source.config.name}" is missing native artifact `
          + `for ${uuid} (${extension}).`,
        );
      }
      for (const file of matchingFiles.sort()) {
        artifacts.push(createNativeArtifact(
          this.#publicUrl(file),
          this.#platform,
          redirectBundleName,
        ));
      }
    }
    return artifacts;
  }

  #publicUrl(file: string): string {
    const relativePath = relative(this.#publicRoot, file).replace(/\\/gu, '/');
    if (relativePath.startsWith('../') || relativePath === '..') {
      throw new CatalogCompileError(
        `Content artifact "${file}" is outside "${this.#publicRoot}".`,
      );
    }
    return relativePath;
  }
}

function physicalArtifactNames(
  uuid: string,
  compressedUuid: string,
  version: string | undefined,
  extension: string,
): ReadonlySet<string> {
  return new Set([...physicalArtifactStems(uuid, compressedUuid, version)].map(
    (stem) => `${stem}${extension}`,
  ));
}

function physicalArtifactStems(
  uuid: string,
  compressedUuid: string,
  version: string | undefined,
): ReadonlySet<string> {
  const suffix = version === undefined ? '' : `.${version}`;
  return new Set([`${compressedUuid}${suffix}`, `${uuid}${suffix}`]);
}

function processBundle(
  abi: CocosBuilderAbi,
  source: BundleConfigSource,
  files: readonly string[],
): BundleArtifactData {
  const uuids = source.config.uuids.map((uuid) => abi.decompressUuid(uuid));
  const readUuid = (reference: string | number): string => {
    if (typeof reference === 'number') {
      const uuid = uuids[reference];
      if (uuid === undefined) {
        throw new CatalogCompileError(
          `Cocos Bundle "${source.config.name}" contains invalid UUID index ${reference}.`,
        );
      }
      return uuid;
    }
    return abi.decompressUuid(reference);
  };
  const packs = new Map<string, readonly string[]>();
  for (const [packUuid, references] of Object.entries(source.config.packs)) {
    packs.set(abi.decompressUuid(packUuid), references.map(readUuid));
  }
  const extensions = new Map<string, ReadonlySet<string>>();
  for (const [extension, references] of Object.entries(source.config.extensionMap)) {
    extensions.set(extension.toLowerCase(), new Set(references.map(readUuid)));
  }
  return {
    source,
    files,
    uuids,
    uuidSet: new Set(uuids),
    packs,
    extensions,
    importVersions: readVersions(source.config.versions.import, readUuid),
    nativeVersions: readVersions(source.config.versions.native, readUuid),
    redirects: readRedirects(source.config, readUuid),
  };
}

function readVersions(
  entries: Array<string | number>,
  readUuid: (reference: string | number) => string,
): ReadonlyMap<string, string> {
  if (entries.length % 2 !== 0) {
    throw new CatalogCompileError('Cocos Bundle version entries must be UUID/version pairs.');
  }
  const versions = new Map<string, string>();
  for (let index = 0; index < entries.length; index += 2) {
    const version = entries[index + 1];
    if (typeof version !== 'string') {
      throw new CatalogCompileError('Cocos Bundle version value is not a string.');
    }
    versions.set(readUuid(entries[index]), version);
  }
  return versions;
}

function readRedirects(
  config: IBundleConfig,
  readUuid: (reference: string | number) => string,
): ReadonlyMap<string, string> {
  if (config.redirect.length % 2 !== 0) {
    throw new CatalogCompileError('Cocos Bundle redirect entries must be UUID/bundle pairs.');
  }
  const redirects = new Map<string, string>();
  for (let index = 0; index < config.redirect.length; index += 2) {
    const bundleReference = config.redirect[index + 1];
    const bundleName = typeof bundleReference === 'number'
      ? config.deps[bundleReference]
      : bundleReference;
    if (typeof bundleName !== 'string') {
      throw new CatalogCompileError('Cocos Bundle redirect points to an invalid dependency.');
    }
    redirects.set(readUuid(config.redirect[index]), bundleName);
  }
  return redirects;
}

async function listFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry): Promise<readonly string[]> => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat().sort();
}

function findUniqueFile(
  bundle: BundleArtifactData,
  predicate: (file: string) => boolean,
  description: string,
): string {
  const matches = bundle.files.filter(predicate);
  if (matches.length !== 1) {
    throw new CatalogCompileError(
      `Cocos Bundle "${bundle.source.config.name}" expected one ${description}, `
      + `found ${matches.length}.`,
    );
  }
  return matches[0];
}
