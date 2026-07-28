import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { sha256 } from '@/sha256/index.js';

interface CatalogDocument {
  readonly type: 'cyclo-asset-catalog';
  readonly version: 1;
  readonly keys: readonly unknown[];
  readonly cocosUuids: readonly unknown[];
  readonly records: readonly unknown[];
}

interface InstallHarness {
  readonly assetPipeline: typeof import('@/index.js')['assetPipeline'];
  readonly installAssetPipeline: typeof import('@/index.js')['installAssetPipeline'];
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, '__cycloAssetCatalogPointer');
});

/// @case Asset Catalog installation lifecycle and wire validation.
/// @expect Only a verified, schema-valid Catalog commits the global pipeline.
describe('Asset Catalog installation', () => {
  /// @case
  /// Two callers install with the same configuration while Catalog fetch is
  /// pending, another caller supplies different options, and game code tries
  /// to load through the global facade before installation completes.
  /// @expect
  /// Equal callers receive the same Promise, different options fail
  /// synchronously, global loading is unavailable until the verified Catalog
  /// commits, and both equal callers receive the process-wide facade.
  it('shares one pending install and commits only after verification', async () => {
    const document = emptyCatalog();
    const response = await catalogResponse(document);
    let releaseFetch!: () => void;
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn(async () => {
      await fetchGate;
      return response;
    }));
    const harness = await prepareInstall(document);

    const first = harness.installAssetPipeline();
    const second = harness.installAssetPipeline();

    expect(first).toBe(second);
    expect(() => harness.installAssetPipeline({
      artifactCacheByteBudget: 1,
    })).toThrow('different configuration');
    expect(() => harness.assetPipeline.loadAsset('before-install')).toThrow(
      'not installed',
    );

    releaseFetch();
    await expect(first).resolves.toBe(harness.assetPipeline);
    await expect(second).resolves.toBe(harness.assetPipeline);
    expect(harness.installAssetPipeline()).toBe(first);
    expect(() => harness.installAssetPipeline({
      artifactCacheByteBudget: 1,
    })).toThrow('different configuration');
  });

  /// @case
  /// The first install has no settings pointer, then the pointer and Catalog
  /// become available and the same caller retries.
  /// @expect
  /// The first Promise rejects with a structured settings error, the global
  /// facade remains unavailable, and the retry installs successfully.
  it('allows retry after a settings failure without half-installing', async () => {
    const api = await import('@/index.js');

    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      name: 'AssetPipelineInstallError',
      stage: 'settings',
      cause: expect.any(TypeError),
    });
    expect(() => api.assetPipeline.loadAsset('still-uninstalled')).toThrow(
      'not installed',
    );

    const document = emptyCatalog();
    await configureCatalogFetch(document);
    await expect(api.installAssetPipeline()).resolves.toBe(api.assetPipeline);
  });

  /// @case
  /// Consecutive retryable installs encounter a network failure, a byte
  /// length mismatch, a digest mismatch, and malformed JSON after a valid
  /// settings pointer.
  /// @expect
  /// Each attempt rejects with its precise public stage and preserves the
  /// underlying failure as cause without committing a global pipeline.
  it('reports acquire, integrity, and parse failures by install stage', async () => {
    const api = await import('@/index.js');
    const document = emptyCatalog();
    await setCatalogPointer(document);
    const networkFailure = new Error('network unavailable');
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(networkFailure)));

    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      stage: 'acquire',
      cause: networkFailure,
    });

    const validBytes = encodeCatalog(document);
    await setCatalogPointer(document, {
      byteLength: validBytes.byteLength + 1,
    });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      new Response(toArrayBuffer(validBytes)),
    )));
    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      stage: 'integrity',
      cause: expect.any(Error),
    });

    await setCatalogPointer(document, {
      sha256: `sha256:${'0'.repeat(64)}`,
    });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      new Response(toArrayBuffer(validBytes)),
    )));
    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      stage: 'integrity',
      cause: expect.objectContaining({
        message: expect.stringContaining('Catalog hash is'),
      }),
    });

    const malformedBytes = new TextEncoder().encode('{');
    await setRawCatalogPointer(malformedBytes);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(
      new Response(malformedBytes),
    )));
    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      stage: 'parse',
      cause: expect.any(SyntaxError),
    });
    expect(() => api.assetPipeline.loadAsset('never-installed')).toThrow(
      'not installed',
    );
  });

  /// @case
  /// Catalog settings and documents contain unknown fields at the pointer,
  /// document, key, record, and Artifact location layers.
  /// @expect
  /// The strict schema rejects pointer additions during settings and rejects
  /// every document addition during parse instead of silently accepting a
  /// compiler/runtime protocol mismatch.
  it('rejects unknown wire fields at every major schema layer', async () => {
    const api = await import('@/index.js');
    const document = catalogWithRecord();
    await configureCatalogFetch(document, {
      unexpectedPointerField: true,
    });
    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      stage: 'settings',
    });

    const invalidDocuments = [
      {
        ...document,
        unexpectedCatalogField: true,
      },
      {
        ...document,
        keys: [{
          ...(document.keys[0] as object),
          unexpectedKeyField: true,
        }],
      },
      {
        ...document,
        records: [{
          ...(document.records[0] as object),
          unexpectedRecordField: true,
        }],
      },
      {
        ...document,
        records: [{
          ...(document.records[0] as object),
          primaryArtifact: {
            ...((document.records[0] as {
              readonly primaryArtifact: object;
            }).primaryArtifact),
            unexpectedLocationField: true,
          },
        }],
      },
    ];

    for (const invalidDocument of invalidDocuments) {
      await configureCatalogFetch(invalidDocument);
      await expect(api.installAssetPipeline()).rejects.toMatchObject({
        stage: 'parse',
        cause: expect.objectContaining({
          message: expect.stringContaining('unknown field'),
        }),
      });
    }
  });

  /// @case
  /// A compiler emits duplicate resource IDs for one key and duplicate
  /// dependency IDs in one record.
  /// @expect
  /// Installation rejects both malformed documents during parse rather than
  /// silently normalizing data that should have been deterministic upstream.
  it('rejects duplicate resource locations and dependencies', async () => {
    const api = await import('@/index.js');
    const document = catalogWithRecord();
    const duplicateLocations = {
      ...document,
      keys: [{
        key: 'label',
        resourceIds: ['resource', 'resource'],
      }],
    };
    await configureCatalogFetch(duplicateLocations);
    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      stage: 'parse',
    });

    const record = document.records[0] as Record<string, unknown>;
    const duplicateDependencies = {
      ...document,
      records: [{
        ...record,
        directDependencies: ['resource', 'resource'],
      }],
    };
    await configureCatalogFetch(duplicateDependencies);
    await expect(api.installAssetPipeline()).rejects.toMatchObject({
      stage: 'parse',
    });
  });
});

function emptyCatalog(): CatalogDocument {
  return {
    type: 'cyclo-asset-catalog',
    version: 1,
    keys: [],
    cocosUuids: [],
    records: [],
  };
}

function catalogWithRecord(): CatalogDocument {
  return {
    type: 'cyclo-asset-catalog',
    version: 1,
    keys: [{
      key: 'label',
      resourceIds: ['resource'],
    }],
    cocosUuids: [{
      uuid: 'resource-uuid',
      resourceId: 'resource',
    }],
    records: [{
      resourceId: 'resource',
      cocosUuid: 'resource-uuid',
      runtimeTypeId: 'cc.Asset',
      primaryArtifact: {
        key: '/resource.json',
        format: 'json',
        redirectBundleName: 'cyclo-group',
      },
      auxiliaryArtifactSets: [],
      directDependencies: [],
      decoderId: 'cocos-import',
    }],
  };
}

async function prepareInstall(
  document: unknown,
): Promise<InstallHarness> {
  await setCatalogPointer(document);
  return import('@/index.js');
}

async function configureCatalogFetch(
  document: unknown,
  pointerExtras: Record<string, unknown> = {},
): Promise<void> {
  await setCatalogPointer(document, pointerExtras);
  vi.stubGlobal('fetch', vi.fn(() => catalogResponse(document)));
}

async function setCatalogPointer(
  document: unknown,
  pointerExtras: Record<string, unknown> = {},
): Promise<void> {
  await setRawCatalogPointer(encodeCatalog(document), pointerExtras);
}

async function setRawCatalogPointer(
  bytes: Uint8Array,
  pointerExtras: Record<string, unknown> = {},
): Promise<void> {
  const digest = await sha256(bytes);
  Reflect.set(globalThis, '__cycloAssetCatalogPointer', {
    type: 'cyclo-asset-catalog-pointer',
    version: 1,
    url: '/catalog.json',
    sha256: `sha256:${toHex(digest)}`,
    byteLength: bytes.byteLength,
    ...pointerExtras,
  });
}

function catalogResponse(document: unknown): Promise<Response> {
  const bytes = encodeCatalog(document);
  return Promise.resolve(new Response(toArrayBuffer(bytes), {
    headers: {
      'content-length': `${bytes.byteLength}`,
      'content-type': 'application/json',
    },
  }));
}

function encodeCatalog(document: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(document));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const result = new Uint8Array(bytes.byteLength);
  result.set(bytes);
  return result.buffer;
}

function toHex(bytes: Uint8Array): string {
  let result = '';
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, '0');
  }
  return result;
}
