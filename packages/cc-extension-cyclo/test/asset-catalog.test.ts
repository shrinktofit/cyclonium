import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';

import {
  AssetGroupDelivery,
  AssetGroupEntryKind,
  getAssetGroupStorageName,
  getAssetPipelineAuthoringPaths,
  type AssetPipelineAuthoringData,
} from '../src/features/asset-groups/authoring/index.js';
import { FileSystemAuthoringAssetPersistence } from '../src/features/asset-groups/authoring-persistence.js';
import type {
  CatalogArtifactIndex,
  IndexedAsset,
} from '../src/features/asset-catalog/artifact-index.js';
import {
  buildOutputUrl,
  createImportArtifact,
  createNativeArtifact,
} from '../src/features/asset-catalog/artifact-path.js';
import {
  CatalogCompileError,
  compileAssetCatalog,
  createCatalogPointer,
} from '../src/features/asset-catalog/catalog-compiler.js';
import { BundleConfigArtifactIndex } from '../src/features/asset-catalog/bundle-config-artifact-index.js';
import {
  importPreviewUrl,
  nativePreviewUrl,
  PreviewArtifactIndex,
} from '../src/features/asset-catalog/preview-artifact-index.js';
import type { CocosBuilderAbi } from '../src/features/asset-catalog/cocos-builder-abi.js';
import { synchronizeTechnicalBundleAnchors } from '../src/features/asset-catalog/technical-bundle-anchors.js';
import { createTechnicalBundleOptions } from '../src/features/asset-catalog/technical-bundles.js';
import {
  servePreviewCatalogFile,
  type CatalogRouteResponse,
} from '../src/features/asset-catalog/preview-catalog-route.js';
import { acquireAssetCatalog } from '../../cyclo-asset-pipeline/src/catalog-document.js';
import type { ArtifactSource } from '../../cyclo-asset-pipeline/src/core/contracts.js';
import { ArtifactKind } from '../../cyclo-asset-pipeline/src/core/model.js';

/// @case
/// Catalog authoring is compiled through the platform-neutral artifact index.
/// @expect
/// Ordered keys, internal UUID dependencies, deterministic bytes, and unsupported formats follow the Cyclo wire contract.
describe('Cyclo Asset Catalog compiler', () => {
  /// @case
  /// Compile a real extension Catalog and hand its pointer and exact bytes to
  /// the runtime's strict Catalog installer parser.
  /// @expect
  /// The compiler output is accepted without test-side reshaping and retains
  /// the authored key, UUID index, and runtime record.
  it('emits the exact wire protocol consumed by the runtime', async () => {
    const indexed = asset('texture', 'db://assets/textures/hero.png', [], 'cc.Texture2D');
    const compiled = await compileAssetCatalog(
      singleAssetAuthoring(indexed),
      new FakeArtifactIndex(new Map([[indexed.uuid, indexed]])),
    );
    const pointer = createCatalogPointer(compiled, 'assets/cyclo/catalog.json');
    const source: ArtifactSource = {
      id: 'compiler-runtime-contract',
      acquire: () => Promise.resolve({
        kind: ArtifactKind.bytes,
        bytes: compiled.bytes,
        format: 'json',
        sourceId: 'compiler-runtime-contract',
      }),
    };

    const catalog = await acquireAssetCatalog(
      pointer,
      source,
      (bytes) => Promise.resolve(new Uint8Array(createHash('sha256').update(bytes).digest())),
    );

    expect(catalog.keys.get(indexed.url)).toEqual([indexed.uuid]);
    expect(catalog.cocosUuids.get(indexed.uuid)).toBe(indexed.uuid);
    expect(catalog.records.get(indexed.uuid)).toMatchObject({
      resourceId: indexed.uuid,
      runtimeTypeId: indexed.runtimeTypeId,
      decoderId: 'cocos-import',
    });
  });

  /// @case
  /// 1. Expand a Group root to a typed runtime asset.
  /// 2. Synchronize its technical Bundle Anchor and create the Cocos Bundle options.
  /// @expect
  /// The Anchor serializes the resource reference and the Bundle selects only the Anchor UUID from its own root.
  it('collects Group roots through a typed UniversalAsset Anchor', async () => {
    const projectPath = await mkdtemp(join(tmpdir(), 'cyclo-bundle-anchor-'));
    const indexed = asset('texture', 'db://assets/textures/hero.png', [], 'cc.Texture2D');
    const authoring = singleAssetAuthoring(indexed);
    const index = new FakeArtifactIndex(new Map([[indexed.uuid, indexed]]));
    const paths = getAssetPipelineAuthoringPaths(projectPath);
    const group = authoring.groups[0];
    expect(group).toBeDefined();
    const anchorUuid = 'technical-anchor-uuid';
    const anchors = await synchronizeTechnicalBundleAnchors(
      projectPath,
      authoring,
      index,
      {
        queryAsset: () => Promise.resolve({
          name: 'Anchor',
          uuid: anchorUuid,
          url: `${paths.bundleRootsAssetDbUrl}/Single Group/Anchor.asset`,
          type: 'cyclo.AssetGroupAnchor',
          isDirectory: false,
          library: {},
        }),
      } as CocosBuilderAbi,
      new FileSystemAuthoringAssetPersistence(),
    );

    const source = await readFile(join(
      paths.bundleRootsDirectory,
      getAssetGroupStorageName(group?.name ?? ''),
      'Anchor.asset',
    ), 'utf8');
    expect(JSON.parse(source)).toEqual([expect.objectContaining({
      __type__: 'cyclo.AssetGroupAnchor',
      rootAssets: [{
        __uuid__: indexed.uuid,
        __expectedType__: indexed.runtimeTypeId,
      }],
    })]);

    const bundles = createTechnicalBundleOptions(authoring, anchors, []);
    expect(bundles[0]).toMatchObject({
      root: `${paths.bundleRootsAssetDbUrl}/Single Group`,
      bundleFilterConfig: [{
        range: 'include',
        type: 'asset',
        assets: [anchorUuid],
      }],
    });
  });

  /// @case
  /// 1. Add a directory entry and an explicit child entry.
  /// 2. Keep GUID exposure disabled while the root depends on an unlisted asset.
  /// 3. Compile the same authoring data twice.
  /// @expect
  /// Directory addresses are derived, the explicit child wins, dependency UUIDs stay internal, and canonical bytes remain identical.
  it('compiles ordered address and label locations with internal UUID dependencies', async () => {
    const assets = new Map<string, IndexedAsset>([
      ['folder', directory('folder', 'db://assets/ui')],
      ['a', asset('a', 'db://assets/ui/a.png', ['dependency'])],
      ['b', asset('b', 'db://assets/ui/nested/b.prefab')],
      ['dependency', asset('dependency', 'db://assets/shared/material.mtl')],
    ]);
    const index = new FakeArtifactIndex(assets);
    const authoring: AssetPipelineAuthoringData = {
      schemaVersion: 1,
      groupOrder: ['group'],
      labels: ['directory-label', 'explicit-label'],
      groups: [{
        schemaVersion: 1,
        id: 'group',
        name: 'UI',
        includeInBuild: true,
        includeAddressInCatalog: true,
        includeGuidsInCatalog: false,
        includeLabelsInCatalog: true,
        delivery: AssetGroupDelivery.local,
        entries: [{
          id: 'directory-entry',
          kind: AssetGroupEntryKind.directory,
          assetUuid: 'folder',
          assetUrl: 'db://assets/ui',
          address: 'ui',
          labels: ['directory-label'],
        }, {
          id: 'explicit-entry',
          kind: AssetGroupEntryKind.asset,
          assetUuid: 'b',
          assetUrl: 'db://assets/ui/nested/b.prefab',
          address: 'special/b',
          labels: ['explicit-label'],
        }],
      }],
    };

    const first = await compileAssetCatalog(authoring, index);
    const second = await compileAssetCatalog(authoring, index);

    expect(first.bytes).toEqual(second.bytes);
    expect(first.revision).toBe(second.revision);
    expect(first.catalog.keys).toEqual([
      { key: 'ui/a.png', resourceIds: ['a'] },
      { key: 'directory-label', resourceIds: ['a'] },
      { key: 'special/b', resourceIds: ['b'] },
      { key: 'explicit-label', resourceIds: ['b'] },
    ]);
    expect(first.catalog.keys).not.toContainEqual({
      key: 'dependency',
      resourceIds: ['dependency'],
    });
    expect(first.catalog.cocosUuids).toContainEqual({
      uuid: 'dependency',
      resourceId: 'dependency',
    });
    expect(first.catalog.records.find((record) => record.resourceId === 'a'))
      .toMatchObject({ directDependencies: ['dependency'] });
  });

  /// @case
  /// IBuildResult reports a JSON artifact with a pack group index.
  /// @expect
  /// The compiler rejects the unsupported Cocos JSON pack instead of emitting a catalog that must fail at runtime.
  it('rejects packed JSON artifacts', () => {
    expect(() => createImportArtifact('/assets/cyclo/import/pack.json', 2))
      .toThrow(CatalogCompileError);
  });

  /// @case
  /// A Cocos native artifact is emitted as a plain .pkm without ETC subtype metadata.
  /// @expect
  /// Catalog compilation fails rather than guessing ETC1 or ETC2.
  it('rejects ambiguous PKM texture candidates', () => {
    expect(() => createNativeArtifact('/assets/cyclo/native/texture.pkm', 'wechatgame'))
      .toThrow(/does not identify ETC1 or ETC2/u);
  });

  /// @case
  /// A WeChat build indexes a TTF native artifact.
  /// @expect
  /// The Catalog requests a PlatformFileArtifact so the minigame font decoder can call loadFont(path).
  it('uses platform files for minigame TTF artifacts', () => {
    expect(createNativeArtifact('/assets/cyclo/native/font.ttf', 'wechatgame'))
      .toMatchObject({ location: { preferredKind: 'platform-file' } });
  });

  /// @case
  /// One resource exposes two ordinary native files without distinct runtime variants.
  /// @expect
  /// Catalog compilation fails before runtime installation would reject the duplicate fallback.
  it('rejects duplicate native candidate variants', async () => {
    const indexed = asset('duplicate-native', 'db://assets/image.png');
    const index = new FakeArtifactIndex(new Map([[
      indexed.uuid,
      {
        ...indexed,
        nativeArtifacts: [
          createNativeArtifact('assets/native/image.png', 'web-mobile'),
          createNativeArtifact('assets/native/image.jpg', 'web-mobile'),
        ],
      },
    ]]));

    await expect(compileAssetCatalog(singleAssetAuthoring(indexed), index))
      .rejects.toThrow(/multiple native candidates for variant "<fallback>"/u);
  });

  /// @case
  /// IBuildResult reports normal-build artifacts under the output assets directory.
  /// @expect
  /// Catalog keys use Cocos's package-relative assets path for both Fetch and minigame file APIs.
  it('emits package-relative normal-build artifact keys', () => {
    const outputRoot = join(tmpdir(), 'cyclo-normal-build');
    const absoluteArtifact = join(outputRoot, 'assets', 'cyclo-ui', 'import', 'asset.json');

    expect(buildOutputUrl(outputRoot, absoluteArtifact))
      .toBe('assets/cyclo-ui/import/asset.json');
    expect(buildOutputUrl(outputRoot, 'assets/cyclo-ui/native/image.png'))
      .toBe('assets/cyclo-ui/native/image.png');
  });

  /// @case
  /// Bundle config stores a compressed UUID while the built import artifact keeps the canonical UUID filename.
  /// @expect
  /// Content Build indexes the canonical physical filename instead of requiring Cocos's compressed spelling.
  it('accepts canonical UUID filenames from built Bundle output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cyclo-built-bundle-'));
    const bundleDirectory = join(root, 'cyclo-test');
    const importDirectory = join(bundleDirectory, 'import', '35');
    const uuid = '3513b86e-7009-43c7-8222-9226326d53e0';
    const compressedUuid = '35E7hucAlDx4IikiYybVPg';
    await mkdir(importDirectory, { recursive: true });
    await writeFile(join(importDirectory, `${uuid}.json`), '{}');

    const abi = {
      compressUuid: () => compressedUuid,
      decompressUuid: (value: string) => value === compressedUuid ? uuid : value,
      queryAsset: () => Promise.resolve({
        name: 'AnchorTarget',
        uuid,
        url: 'db://assets/AnchorTarget.txt',
        type: 'cc.TextAsset',
        isDirectory: false,
        library: {},
      }),
      queryDirectAssetDependencies: () => Promise.resolve([]),
    } as unknown as CocosBuilderAbi;
    const index = await BundleConfigArtifactIndex.create(abi, [{
      directory: bundleDirectory,
      config: {
        importBase: 'import',
        nativeBase: 'native',
        name: 'cyclo-test',
        deps: [],
        uuids: [compressedUuid],
        paths: {},
        scenes: {},
        packs: {},
        versions: { import: [], native: [] },
        redirect: [],
        debug: false,
        extensionMap: {},
        hasPreloadScript: false,
        dependencyRelationships: {},
        types: [],
      },
    }], root, 'web-mobile');

    await expect(index.queryAsset(uuid)).resolves.toMatchObject({
      primaryArtifact: {
        key: `cyclo-test/import/35/${uuid}.json`,
        format: 'json',
      },
    });
  });
});

/// @case
/// Preview Catalog locations target Vortex's existing UUID-library server routes.
/// @expect
/// JSON, CCONB, extension-native, and named-native keys produce route-compatible URLs without another artifact server.
describe('Cyclo preview artifact URLs', () => {
  /// @case
  /// Generate preview locations for every supported AssetInfo.library key shape.
  /// @expect
  /// URLs match Vortex uuid-library-route's direct-extension and named-file patterns.
  it('uses existing UUID library routes', () => {
    const uuid = 'ab123456-1234-1234-1234-123456789abc';
    expect(importPreviewUrl(uuid, '.json')).toBe(`/${uuid.slice(0, 2)}/${uuid}.json`);
    expect(importPreviewUrl(uuid, '.bin')).toBe(`/${uuid.slice(0, 2)}/${uuid}.cconb`);
    expect(nativePreviewUrl(uuid, '.png')).toBe(`/${uuid.slice(0, 2)}/${uuid}.png`);
    expect(nativePreviewUrl(uuid, 'font file.ttf'))
      .toBe(`/${uuid.slice(0, 2)}/${uuid}/font%20file.ttf`);
  });

  /// @case
  /// AssetDB reports a .bin CCONB import artifact and a .png native artifact for one resource.
  /// @expect
  /// The binary import remains the primary artifact and the PNG remains a native candidate.
  it('selects CCONB imports independently of native library entries', async () => {
    const uuid = 'cd123456-1234-1234-1234-123456789abc';
    const index = new PreviewArtifactIndex(fakePreviewAbi(uuid, {
      '.bin': 'unused-library-path',
      '.png': 'unused-native-path',
    }));

    await expect(index.queryAsset(uuid)).resolves.toMatchObject({
      primaryArtifact: {
        key: `/${uuid.slice(0, 2)}/${uuid}.cconb`,
        format: 'cconb',
      },
      nativeArtifacts: [{
        location: {
          key: `/${uuid.slice(0, 2)}/${uuid}.png`,
          format: 'png',
        },
      }],
    });
  });

  /// @case
  /// AssetDB unexpectedly reports both .bin and .cconb as binary import candidates.
  /// @expect
  /// Preview Catalog generation rejects the ambiguous resource instead of choosing by key order.
  it('rejects multiple binary import candidates', async () => {
    const uuid = 'ef123456-1234-1234-1234-123456789abc';
    const index = new PreviewArtifactIndex(fakePreviewAbi(uuid, {
      '.bin': 'unused-bin-path',
      '.cconb': 'unused-cconb-path',
      '.png': 'unused-native-path',
    }));

    await expect(index.queryAsset(uuid)).rejects.toThrow(
      /multiple binary import artifacts/u,
    );
  });
});

/// @case
/// The extension server exposes only content-addressed Catalog files from its temp directory.
/// @expect
/// Invalid paths are rejected, missing revisions fall through, and existing exact revisions are sent.
describe('Cyclo preview Catalog route', () => {
  /// @case
  /// Request traversal text, an absent valid revision, and a present valid revision.
  /// @expect
  /// Traversal receives 400, absence calls next, and the exact existing file is served.
  it('serves only exact content-addressed Catalog filenames', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cyclo-catalog-route-'));
    const revision = 'a'.repeat(64);
    const fileName = `catalog.${revision}.json`;
    const file = join(directory, fileName);
    await writeFile(file, '{}');
    const response = new FakeCatalogRouteResponse();
    const next = vi.fn();

    await servePreviewCatalogFile(directory, '../catalog.json', response, next);
    expect(response.statusCode).toBe(400);
    expect(response.sentBody).toBe('Invalid Cyclo Asset Catalog revision.');
    expect(next).not.toHaveBeenCalled();

    response.reset();
    await servePreviewCatalogFile(
      directory,
      `catalog.${'b'.repeat(64)}.json`,
      response,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
    expect(response.sentFile).toBeUndefined();

    next.mockClear();
    await servePreviewCatalogFile(directory, fileName, response, next);
    expect(response.sentFile).toBe(file);
    expect(next).not.toHaveBeenCalled();
  });
});

class FakeArtifactIndex implements CatalogArtifactIndex {
  constructor(assets: ReadonlyMap<string, IndexedAsset>) {
    this.#assets = assets;
  }

  queryAsset(uuid: string): Promise<IndexedAsset | undefined> {
    return Promise.resolve(this.#assets.get(uuid));
  }

  queryAssetsUnder(directoryUrl: string): Promise<readonly IndexedAsset[]> {
    const prefix = `${directoryUrl}/`;
    return Promise.resolve([...this.#assets.values()].filter((candidate) => (
      candidate.url.startsWith(prefix)
    )));
  }

  readonly #assets: ReadonlyMap<string, IndexedAsset>;
}

function fakePreviewAbi(
  uuid: string,
  library: Readonly<Record<string, string>>,
): CocosBuilderAbi {
  return {
    queryAsset: () => Promise.resolve({
      name: 'preview-asset',
      uuid,
      url: `db://assets/${uuid}`,
      type: 'cc.Asset',
      isDirectory: false,
      library,
    }),
    queryDirectAssetDependencies: () => Promise.resolve([]),
  } as unknown as CocosBuilderAbi;
}

function directory(uuid: string, url: string): IndexedAsset {
  return {
    uuid,
    url,
    runtimeTypeId: 'cc.Asset',
    isDirectory: true,
    directDependencies: [],
    nativeArtifacts: [],
  };
}

function asset(
  uuid: string,
  url: string,
  directDependencies: readonly string[] = [],
  runtimeTypeId = 'cc.Asset',
): IndexedAsset {
  return {
    uuid,
    url,
    runtimeTypeId,
    isDirectory: false,
    directDependencies,
    primaryArtifact: {
      key: `/assets/cyclo/import/${uuid}.json`,
      format: 'json',
    },
    nativeArtifacts: [],
  };
}

function singleAssetAuthoring(indexed: IndexedAsset): AssetPipelineAuthoringData {
  return {
    schemaVersion: 1,
    groupOrder: ['single-group'],
    labels: [],
    groups: [{
      schemaVersion: 1,
      id: 'single-group',
      name: 'Single Group',
      includeInBuild: true,
      includeAddressInCatalog: true,
      includeGuidsInCatalog: false,
      includeLabelsInCatalog: false,
      delivery: AssetGroupDelivery.local,
      entries: [{
        id: 'single-entry',
        kind: AssetGroupEntryKind.asset,
        assetUuid: indexed.uuid,
        assetUrl: indexed.url,
        address: indexed.url,
        labels: [],
      }],
    }],
  };
}

class FakeCatalogRouteResponse implements CatalogRouteResponse {
  statusCode: number | undefined;
  sentBody: string | undefined;
  sentFile: string | undefined;

  status(code: number): CatalogRouteResponse {
    this.statusCode = code;
    return this;
  }

  send(body: string): void {
    this.sentBody = body;
  }

  sendFile(file: string): void {
    this.sentFile = file;
  }

  reset(): void {
    this.statusCode = undefined;
    this.sentBody = undefined;
    this.sentFile = undefined;
  }
}
