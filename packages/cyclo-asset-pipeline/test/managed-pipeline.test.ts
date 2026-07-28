import {
  AbortController,
  type AbortSignal,
} from '@cyclonium/abort-controller';
import { Asset } from 'cc';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { AssetPipeline } from '@/asset-pipeline.js';
import type {
  ArtifactSource,
  AssetDecodeContext,
  AssetDecoder,
  AssetFinalizer,
  AssetRuntimeConfiguration,
  RemoteAssetInstantiation,
  RemoteAssetLoader,
  RemoteAssetRequest,
  Sha256,
} from '@/core/contracts.js';
import {
  ArtifactEntryKind,
  ArtifactKind,
  type Artifact,
  type ArtifactLocation,
  type AssetCatalog,
  type AssetRecord,
  type DecodedAsset,
} from '@/core/model.js';
import {
  AssetMergeMode,
  AssetIntegrityError,
  AssetIntegrityPolicy,
  AssetLoadStage,
  LoadHandleState,
  type AssetType,
  type CycloAsset,
} from '@/core/public.js';
import { AssetScope } from '@/index.js';
import { sha256 } from '@/sha256/index.js';

const SOURCE_ID = 'test-source';
const DECODER_ID = 'test-decoder';

interface AssetSpec {
  readonly aliases?: readonly string[];
  readonly artifactKey?: string;
  readonly auxiliaryCandidates?: ReadonlyArray<{
    readonly key: string;
    readonly variant?: string;
  }>;
  readonly entryIndex?: number;
  readonly key?: string;
  readonly uuid?: string;
  readonly dependencies?: readonly string[];
  readonly dependencyUuids?: readonly string[];
  readonly hash?: string;
  readonly resourceId: string;
}

interface PendingAcquire {
  readonly onAbort: () => void;
  readonly resolve: () => void;
  readonly signal: AbortSignal;
}

class TestAsset extends Asset {
  constructor(
    readonly resourceId: string,
    destructionOrder: string[],
  ) {
    super();
    this.#destructionOrder = destructionOrder;
  }

  readonly links: Array<TestAsset | undefined> = [];
  destructionCount = 0;
  finalizationCount = 0;

  override destroy(): boolean {
    this.destructionCount += 1;
    this.#destructionOrder.push(this.resourceId);
    return super.destroy();
  }

  readonly #destructionOrder: string[];
}

class TestArtifactSource implements ArtifactSource {
  readonly acquireCounts = new Map<string, number>();
  readonly abortedKeys: string[] = [];
  readonly delayedKeys = new Set<string>();
  readonly id = SOURCE_ID;
  readonly payloads = new Map<string, Uint8Array>();

  acquire(
    location: ArtifactLocation,
    signal: AbortSignal,
  ): Promise<{
    readonly kind: ArtifactKind.bytes;
    readonly bytes: Uint8Array;
    readonly format: string;
    readonly sourceId: string;
  }> {
    this.acquireCounts.set(
      location.key,
      (this.acquireCounts.get(location.key) ?? 0) + 1,
    );

    if (!this.delayedKeys.has(location.key)) {
      return Promise.resolve(this.#artifact(location));
    }

    return new Promise((resolve, reject) => {
      const pending: PendingAcquire = {
        onAbort: () => {
          this.abortedKeys.push(location.key);
          reject(abortError(location.key));
        },
        resolve: () => {
          resolve(this.#artifact(location));
        },
        signal,
      };
      const entries = this.#pending.get(location.key) ?? [];
      entries.push(pending);
      this.#pending.set(location.key, entries);
      signal.addEventListener('abort', pending.onAbort, {
        once: true,
      });
    });
  }

  resolve(key: string): void {
    const pending = this.#pending.get(key) ?? [];
    this.#pending.delete(key);
    for (const entry of pending) {
      entry.signal.removeEventListener('abort', entry.onAbort);
      entry.resolve();
    }
  }

  readonly #pending = new Map<string, PendingAcquire[]>();

  #artifact(location: ArtifactLocation): {
    readonly kind: ArtifactKind.bytes;
    readonly bytes: Uint8Array;
    readonly format: string;
    readonly sourceId: string;
  } {
    return {
      kind: ArtifactKind.bytes,
      bytes: this.payloads.get(location.key) ?? new Uint8Array([1, 2]),
      format: location.format,
      sourceId: this.id,
    };
  }
}

class TestDecoder implements AssetDecoder {
  readonly decodeCounts = new Map<string, number>();
  readonly decodedAssets = new Map<string, TestAsset[]>();
  readonly dependencyUuids = new Map<string, readonly string[]>();
  readonly destructionOrder: string[] = [];
  readonly id = DECODER_ID;

  decode(
    context: AssetDecodeContext,
    _signal: AbortSignal,
  ): Promise<DecodedAsset> {
    const { resourceId } = context.record;
    this.decodeCounts.set(
      resourceId,
      (this.decodeCounts.get(resourceId) ?? 0) + 1,
    );

    const asset = new TestAsset(resourceId, this.destructionOrder);
    const assets = this.decodedAssets.get(resourceId) ?? [];
    assets.push(asset);
    this.decodedAssets.set(resourceId, assets);

    return Promise.resolve({
      asset,
      dependencyBindings: (
        this.dependencyUuids.get(resourceId) ?? []
      ).map((cocosUuid, index) => ({
        cocosUuid,
        owner: asset.links,
        property: `${index}`,
      })),
    });
  }

  latest(resourceId: string): TestAsset {
    const assets = this.decodedAssets.get(resourceId);
    const asset = assets?.at(-1);
    if (asset === undefined) {
      throw new Error(`Asset "${resourceId}" was not decoded.`);
    }
    return asset;
  }
}

class TestFinalizer implements AssetFinalizer {
  readonly replacementAssets: TestAsset[] = [];
  readonly replacementResourceIds = new Set<string>();

  finalize(
    decoded: DecodedAsset,
    _signal: AbortSignal,
  ): Promise<CycloAsset> {
    const asset = decoded.asset as TestAsset;
    asset.finalizationCount += 1;
    if (this.replacementResourceIds.has(asset.resourceId)) {
      const replacement = new TestAsset(
        `${asset.resourceId}-replacement`,
        [],
      );
      this.replacementAssets.push(replacement);
      return Promise.resolve(replacement);
    }
    return Promise.resolve(asset);
  }
}

class UnsupportedRemoteAssetLoader implements RemoteAssetLoader {
  supports<TAsset extends CycloAsset>(
    _assetType: AssetType<TAsset>,
  ): boolean {
    return false;
  }

  resolve<TAsset extends CycloAsset>(
    _request: RemoteAssetRequest<TAsset>,
  ): ArtifactLocation {
    throw new Error('Remote loading is not part of this test.');
  }

  instantiate<TAsset extends CycloAsset>(
    _request: RemoteAssetRequest<TAsset>,
    _artifact: Artifact,
    _signal: AbortSignal,
  ): Promise<RemoteAssetInstantiation<TAsset>> {
    return Promise.reject(new Error('Remote loading is not part of this test.'));
  }
}

interface TestHarness {
  readonly decoder: TestDecoder;
  readonly finalizer: TestFinalizer;
  readonly pipeline: AssetPipeline;
  readonly source: TestArtifactSource;
}

beforeEach(() => {
  vi.resetModules();
});

describe('managed AssetPipeline', () => {
  /// @case
  /// Catalog labels overlap three resources, the first requested key is
  /// missing, and callers use single-key, use-first, union, and intersection.
  /// @expect
  /// Catalog order is stable, duplicates are removed, use-first skips the
  /// missing key, intersection keeps only shared resources, and loadAsset
  /// selects the first location.
  it('loads ordered Catalog locations with all merge modes', async () => {
    const harness = await createHarness([
      {
        aliases: ['warm', 'shared'],
        key: 'first-address',
        resourceId: 'first-resource',
      },
      {
        aliases: ['warm', 'cool', 'shared'],
        key: 'second-address',
        resourceId: 'second-resource',
      },
      {
        aliases: ['cool'],
        key: 'third-address',
        resourceId: 'third-resource',
      },
    ]);

    const first = harness.pipeline.loadAsset<TestAsset>('warm');
    await expect(first.ready).resolves.toMatchObject({
      resourceId: 'first-resource',
    });
    first.release();

    const single = harness.pipeline.loadAssets<TestAsset>('warm');
    await expect(single.ready).resolves.toHaveLength(2);
    expect(single.values?.map((asset) => asset.resourceId)).toEqual([
      'first-resource',
      'second-resource',
    ]);
    single.release();

    const useFirst = harness.pipeline.loadAssets<TestAsset>(
      ['missing', 'cool'],
      AssetMergeMode.useFirst,
    );
    expect((await useFirst.ready).map((asset) => asset.resourceId)).toEqual([
      'second-resource',
      'third-resource',
    ]);
    useFirst.release();

    const union = harness.pipeline.loadAssets<TestAsset>(
      ['warm', 'cool'],
      AssetMergeMode.union,
    );
    expect((await union.ready).map((asset) => asset.resourceId)).toEqual([
      'first-resource',
      'second-resource',
      'third-resource',
    ]);
    union.release();

    const intersection = harness.pipeline.loadAssets<TestAsset>(
      ['warm', 'cool'],
      AssetMergeMode.intersection,
    );
    expect(
      (await intersection.ready).map((asset) => asset.resourceId),
    ).toEqual(['second-resource']);
    intersection.release();
  });

  /// @case
  /// JavaScript calls the array overload with a merge-mode value that is
  /// outside the public enum.
  /// @expect
  /// The call throws a clear TypeError synchronously instead of producing an
  /// undefined resource selection that fails later in loading.
  it('rejects an unknown merge mode at the public call boundary', async () => {
    const harness = await createHarness([{
      key: 'asset-address',
      resourceId: 'asset-resource',
    }]);

    expect(() => harness.pipeline.loadAssets(
      ['asset-address'],
      'invalid-mode' as AssetMergeMode,
    )).toThrow(TypeError);
  });

  /// @case
  /// A label selects two assets and the second asset violates Finalize while
  /// the first asset has already reached Ready.
  /// @expect
  /// The collection rejects as a unit and releases the successful member so
  /// neither runtime asset remains retained by the failed collection.
  it('releases every collection lease when one member fails', async () => {
    const harness = await createHarness([
      {
        aliases: ['failing-label'],
        resourceId: 'successful-resource',
      },
      {
        aliases: ['failing-label'],
        resourceId: 'failing-resource',
      },
    ]);
    harness.finalizer.replacementResourceIds.add('failing-resource');

    const collection = harness.pipeline.loadAssets<TestAsset>('failing-label');

    await expect(collection.ready).rejects.toMatchObject({
      stage: AssetLoadStage.publish,
    });
    expect(collection.state).toBe(LoadHandleState.failed);
    expect(
      harness.decoder.latest('successful-resource').destructionCount,
    ).toBe(1);
    expect(
      harness.decoder.latest('failing-resource').destructionCount,
    ).toBe(1);
  });

  /// @case
  /// A standalone Handle and a scoped collection share one delayed Asset
  /// Operation, then the collection Scope is disposed before acquisition.
  /// @expect
  /// The collection is cancelled and releases only its own lease, while the
  /// standalone consumer keeps the shared operation alive and receives the
  /// asset after acquisition completes.
  it('cancels only the collection consumer through its Scope', async () => {
    const harness = await createHarness([{
      aliases: ['delayed-label'],
      key: 'delayed-address',
      resourceId: 'delayed-resource',
    }]);
    harness.source.delayedKeys.add('delayed-resource');
    const standalone = harness.pipeline.loadAsset<TestAsset>('delayed-address');
    const scope = new AssetScope();
    const collection = harness.pipeline.loadAssets<TestAsset>(
      'delayed-label',
      { scope },
    );

    scope.dispose();
    await expect(collection.ready).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(collection.state).toBe(LoadHandleState.cancelled);
    expect(harness.source.abortedKeys).toEqual([]);

    harness.source.resolve('delayed-resource');
    await expect(standalone.ready).resolves.toMatchObject({
      resourceId: 'delayed-resource',
    });
    standalone.release();
  });

  /// @case
  /// A scoped collection has already reached Ready when its owning Scope is
  /// disposed.
  /// @expect
  /// Disposal clears the collection values, transitions it to Cancelled, and
  /// releases the collection consumer lease so its unshared Asset is destroyed.
  it('releases a ready collection when its Scope is disposed', async () => {
    const harness = await createHarness([{
      aliases: ['ready-label'],
      resourceId: 'ready-resource',
    }]);
    const scope = new AssetScope();
    const collection = harness.pipeline.loadAssets<TestAsset>(
      'ready-label',
      { scope },
    );
    const [asset] = await collection.ready;

    expect(collection.state).toBe(LoadHandleState.ready);
    expect(collection.values).toEqual([asset]);

    scope.dispose();

    expect(collection.state).toBe(LoadHandleState.cancelled);
    expect(collection.values).toBeUndefined();
    expect(asset?.destructionCount).toBe(1);
  });

  it('uses a public address and a hidden Cocos UUID for one resource', async () => {
    /// @case
    /// A resource is public under an address, its GUID is omitted from public
    /// Catalog keys, and another managed asset references that hidden GUID.
    /// @expect
    /// Address loading and internal UUID linking reuse one runtime asset, while
    /// trying to load the hidden GUID as a public key fails at Resolve.
    const harness = await createHarness([
      {
        key: 'texture-address',
        resourceId: 'texture-resource',
        uuid: 'texture-hidden-uuid',
      },
      {
        dependencyUuids: ['texture-hidden-uuid'],
        key: 'prefab-address',
        resourceId: 'prefab-resource',
      },
    ]);

    const textureHandle = harness.pipeline.loadAsset<TestAsset>(
      'texture-address',
    );
    const texture = await textureHandle.ready;
    const prefabHandle = harness.pipeline.loadAsset<TestAsset>(
      'prefab-address',
    );
    const prefab = await prefabHandle.ready;
    const hiddenGuidHandle = harness.pipeline.loadAsset<TestAsset>(
      'texture-hidden-uuid',
    );

    await expect(hiddenGuidHandle.ready).rejects.toMatchObject({
      stage: 'resolve',
    });
    expect(prefab.links[0]).toBe(texture);
    expect(harness.decoder.decodeCounts.get('texture-resource')).toBe(1);

    textureHandle.release();
    prefabHandle.release();
    hiddenGuidHandle.release();
  });

  it('merges concurrent consumers into one acquire and decode', async () => {
    /// @case
    /// Two consumers request the same Catalog key while its artifact is still
    /// being acquired.
    /// @expect
    /// Both handles receive the same runtime asset from one Source acquire and
    /// one Decoder invocation.
    const harness = await createHarness([
      {
        key: 'shared-address',
        resourceId: 'shared-resource',
      },
    ]);
    harness.source.delayedKeys.add('shared-resource');

    const first = harness.pipeline.loadAsset<TestAsset>('shared-address');
    const second = harness.pipeline.loadAsset<TestAsset>('shared-address');

    await vi.waitFor(() => {
      expect(harness.source.acquireCounts.get('shared-resource')).toBe(1);
    });
    harness.source.resolve('shared-resource');

    await expect(first.ready).resolves.toBe(await second.ready);
    expect(harness.decoder.decodeCounts.get('shared-resource')).toBe(1);

    first.release();
    second.release();
  });

  it('keeps a constructing graph rooted while another handle releases', async () => {
    /// @case
    /// A root shell has been decoded and is waiting for a delayed dependency
    /// while an unrelated Ready handle releases and triggers graph collection.
    /// @expect
    /// The construction root keeps the new graph reachable until delivery, so
    /// neither the root shell nor its dependency is destroyed mid-load.
    const harness = await createHarness([
      {
        key: 'existing-address',
        resourceId: 'existing-resource',
      },
      {
        dependencies: ['dependency-resource'],
        key: 'root-address',
        resourceId: 'root-resource',
      },
      {
        resourceId: 'dependency-resource',
      },
    ]);
    harness.source.delayedKeys.add('dependency-resource');

    const existingHandle = harness.pipeline.loadAsset<TestAsset>(
      'existing-address',
    );
    await existingHandle.ready;
    const rootHandle = harness.pipeline.loadAsset<TestAsset>('root-address');

    await vi.waitFor(() => {
      expect(
        harness.source.acquireCounts.get('dependency-resource'),
      ).toBe(1);
    });
    existingHandle.release();

    const constructingRoot = harness.decoder.decodedAssets
      .get('root-resource')?.[0];
    expect(constructingRoot?.destructionCount).toBe(0);

    harness.source.resolve('dependency-resource');
    const root = await rootHandle.ready;

    expect(root).toBe(constructingRoot);
    expect(root.destructionCount).toBe(0);
    rootHandle.release();
  });

  it('hands a Ready asset from its old consumer to a new consumer atomically', async () => {
    /// @case
    /// A second load joins a Ready runtime asset, then the original Handle
    /// releases in the microtask gap before the second Handle is delivered.
    /// @expect
    /// The pending caller reservation prevents collection, so the second
    /// Handle receives the same live Asset without another acquire or decode.
    const harness = await createHarness([{
      key: 'handoff-address',
      resourceId: 'handoff-resource',
    }]);
    const originalHandle = harness.pipeline.loadAsset<TestAsset>(
      'handoff-address',
    );
    const original = await originalHandle.ready;

    const nextHandle = harness.pipeline.loadAsset<TestAsset>(
      'handoff-address',
    );
    queueMicrotask(() => {
      originalHandle.release();
    });
    const next = await nextHandle.ready;

    expect(next).toBe(original);
    expect(next.destructionCount).toBe(0);
    expect(harness.source.acquireCounts.get('handoff-resource')).toBe(1);
    expect(harness.decoder.decodeCounts.get('handoff-resource')).toBe(1);

    nextHandle.release();
  });

  it('cancels one consumer without aborting a shared operation', async () => {
    /// @case
    /// Two consumers share an in-flight load and only the first consumer
    /// aborts its signal before acquisition completes.
    /// @expect
    /// The first handle is cancelled, the underlying Source remains alive, and
    /// the second handle completes normally.
    const harness = await createHarness([
      {
        key: 'shared-address',
        resourceId: 'shared-resource',
      },
    ]);
    harness.source.delayedKeys.add('shared-resource');
    const firstController = new AbortController();

    const first = harness.pipeline.loadAsset<TestAsset>('shared-address', {
      signal: firstController.signal,
    });
    const second = harness.pipeline.loadAsset<TestAsset>('shared-address');
    const firstReady = first.ready;
    firstController.abort();

    await expect(firstReady).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(harness.source.abortedKeys).toEqual([]);

    harness.source.resolve('shared-resource');
    await expect(second.ready).resolves.toBeInstanceOf(TestAsset);
    expect(second.state).toBe(LoadHandleState.ready);

    second.release();
  });

  it('reports a shared failure using each caller Catalog key', async () => {
    /// @case
    /// Two public aliases concurrently load one canonical resource whose
    /// Artifact fails hash validation after both Handles join the operation.
    /// @expect
    /// The work and root cause are shared, but each structured error identifies
    /// the Catalog key used by its own Handle.
    const harness = await createHarness([{
      aliases: ['alias-b'],
      hash: `sha256:${'00'.repeat(32)}`,
      key: 'alias-a',
      resourceId: 'failing-alias-resource',
    }]);
    harness.source.delayedKeys.add('failing-alias-resource');

    const first = harness.pipeline.loadAsset<TestAsset>('alias-a');
    const second = harness.pipeline.loadAsset<TestAsset>('alias-b');
    await vi.waitFor(() => {
      expect(
        harness.source.acquireCounts.get('failing-alias-resource'),
      ).toBe(1);
    });
    harness.source.resolve('failing-alias-resource');

    await expect(first.ready).rejects.toMatchObject({
      assetId: 'alias-a',
      stage: 'acquire',
    });
    await expect(second.ready).rejects.toMatchObject({
      assetId: 'alias-b',
      stage: 'acquire',
    });
    first.release();
    second.release();
  });

  it('aborts the underlying work after its final consumer cancels', async () => {
    /// @case
    /// Every consumer of one in-flight managed load cancels before its Source
    /// finishes.
    /// @expect
    /// The shared operation aborts exactly once when the last consumer leaves,
    /// and neither handle receives an asset.
    const harness = await createHarness([
      {
        key: 'cancel-address',
        resourceId: 'cancel-resource',
      },
    ]);
    harness.source.delayedKeys.add('cancel-resource');
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = harness.pipeline.loadAsset<TestAsset>('cancel-address', {
      signal: firstController.signal,
    });
    const second = harness.pipeline.loadAsset<TestAsset>('cancel-address', {
      signal: secondController.signal,
    });
    const firstReady = first.ready;
    const secondReady = second.ready;

    await vi.waitFor(() => {
      expect(harness.source.acquireCounts.get('cancel-resource')).toBe(1);
    });
    firstController.abort();
    expect(harness.source.abortedKeys).toEqual([]);
    secondController.abort();

    await expect(firstReady).rejects.toMatchObject({
      name: 'AbortError',
    });
    await expect(secondReady).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(harness.source.abortedKeys).toEqual(['cancel-resource']);
    expect(harness.decoder.decodeCounts.get('cancel-resource')).toBeUndefined();
  });

  it('decodes a diamond dependency only once', async () => {
    /// @case
    /// A root depends on two branches and both branches depend on the same
    /// leaf resource.
    /// @expect
    /// Graph discovery acquires and decodes every resource exactly once,
    /// including the shared leaf.
    const harness = await createHarness([
      {
        dependencies: ['left-resource', 'right-resource'],
        key: 'diamond-address',
        resourceId: 'root-resource',
      },
      {
        dependencies: ['leaf-resource'],
        resourceId: 'left-resource',
      },
      {
        dependencies: ['leaf-resource'],
        resourceId: 'right-resource',
      },
      {
        resourceId: 'leaf-resource',
      },
    ]);

    const handle = harness.pipeline.loadAsset<TestAsset>('diamond-address');
    await handle.ready;

    for (
      const resourceId
      of ['root-resource', 'left-resource', 'right-resource', 'leaf-resource']
    ) {
      expect(harness.source.acquireCounts.get(resourceId)).toBe(1);
      expect(harness.decoder.decodeCounts.get(resourceId)).toBe(1);
    }

    handle.release();
  });

  it('destroys dependents before their dependencies', async () => {
    /// @case
    /// A root runtime Asset depends on one child and its final consumer
    /// releases the root.
    /// @expect
    /// Destruction follows ownership direction: the dependent root is
    /// destroyed before the dependency it references.
    const harness = await createHarness([
      {
        key: 'parent-address',
        resourceId: 'parent',
        dependencies: ['child'],
      },
      {
        resourceId: 'child',
      },
    ]);

    await loadAndRelease(harness.pipeline, 'parent-address');

    expect(harness.decoder.destructionOrder).toEqual([
      'parent',
      'child',
    ]);
  });

  it('links a cycle and destroys the component after its last handle releases', async () => {
    /// @case
    /// Two assets reference one another by hidden Cocos UUID, forming one
    /// strongly connected dependency component.
    /// @expect
    /// Both shells are linked and finalized once, and releasing the final root
    /// destroys every asset in the cycle without leaking either member.
    const harness = await createHarness([
      {
        dependencyUuids: ['b-uuid'],
        key: 'cycle-address',
        resourceId: 'a-resource',
        uuid: 'a-uuid',
      },
      {
        dependencyUuids: ['a-uuid'],
        resourceId: 'b-resource',
        uuid: 'b-uuid',
      },
    ]);

    const handle = harness.pipeline.loadAsset<TestAsset>('cycle-address');
    const assetA = await handle.ready;
    const assetB = assetA.links[0];

    expect(assetB).toBeInstanceOf(TestAsset);
    expect(assetB?.links[0]).toBe(assetA);
    expect(assetA.finalizationCount).toBe(1);
    expect(assetB?.finalizationCount).toBe(1);
    expect(assetA.destructionCount).toBe(0);
    expect(assetB?.destructionCount).toBe(0);

    handle.release();

    expect(assetA.destructionCount).toBe(1);
    expect(assetB?.destructionCount).toBe(1);
  });

  it('does not publish an Asset when Finalize returns a different instance', async () => {
    /// @case
    /// An internal Finalizer violates its contract by returning an Asset other
    /// than the decoded runtime shell.
    /// @expect
    /// Publish fails explicitly and both the graph shell and unexpected result
    /// are destroyed instead of entering the Ready runtime cache.
    const harness = await createHarness([{
      key: 'publish-failure-address',
      resourceId: 'publish-failure-resource',
    }]);
    harness.finalizer.replacementResourceIds.add(
      'publish-failure-resource',
    );

    const handle = harness.pipeline.loadAsset<TestAsset>(
      'publish-failure-address',
    );

    await expect(handle.ready).rejects.toMatchObject({
      stage: 'publish',
    });
    expect(
      harness.decoder.latest('publish-failure-resource').destructionCount,
    ).toBe(1);
    expect(harness.finalizer.replacementAssets[0]?.destructionCount).toBe(1);
    handle.release();
  });

  it('does not publish or cache an artifact with a mismatched hash', async () => {
    /// @case
    /// A Source returns bytes that do not match the Catalog record's SHA-256
    /// content hash, and the caller retries the same asset.
    /// @expect
    /// Both loads fail during Acquire, Decoder never runs, and the retry calls
    /// the Source again instead of observing a published asset or cache hit.
    const harness = await createHarness([
      {
        hash: `sha256:${'0'.repeat(64)}`,
        key: 'corrupt-address',
        resourceId: 'corrupt-resource',
      },
    ]);

    const first = harness.pipeline.loadAsset<TestAsset>('corrupt-address');
    await expect(first.ready).rejects.toMatchObject({
      stage: 'acquire',
    });
    const second = harness.pipeline.loadAsset<TestAsset>('corrupt-address');
    await expect(second.ready).rejects.toMatchObject({
      stage: 'acquire',
    });

    expect(harness.source.acquireCounts.get('corrupt-resource')).toBe(2);
    expect(
      harness.decoder.decodeCounts.get('corrupt-resource'),
    ).toBeUndefined();
  });

  it('reports diagnostics mismatches without merging or caching corrupt artifacts', async () => {
    /// @case
    /// Two Catalog locations declare the same expected SHA-256 but return
    /// corrupt bytes while integrity runs in diagnostics mode. One location
    /// is loaded again after its first Asset is released.
    /// @expect
    /// Both locations acquire and decode independently, every mismatch is
    /// reported without rejecting the Handles, and mismatched bytes are not
    /// retained in the content-hash Artifact cache.
    const diagnostics: AssetIntegrityError[] = [];
    const expectedHash = `sha256:${'0'.repeat(64)}`;
    const harness = await createHarness([
      {
        artifactKey: 'diagnostic-a.bin',
        hash: expectedHash,
        key: 'diagnostic-a',
        resourceId: 'diagnostic-resource-a',
      },
      {
        artifactKey: 'diagnostic-b.bin',
        hash: expectedHash,
        key: 'diagnostic-b',
        resourceId: 'diagnostic-resource-b',
      },
    ], 1024, [], sha256, AssetIntegrityPolicy.diagnostics, (error) => {
      diagnostics.push(error);
    });

    const firstA = harness.pipeline.loadAsset<TestAsset>('diagnostic-a');
    const firstB = harness.pipeline.loadAsset<TestAsset>('diagnostic-b');
    await expect(Promise.all([firstA.ready, firstB.ready])).resolves.toHaveLength(2);

    expect(harness.source.acquireCounts.get('diagnostic-a.bin')).toBe(1);
    expect(harness.source.acquireCounts.get('diagnostic-b.bin')).toBe(1);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]).toMatchObject({
      expectedHash,
      sourceId: SOURCE_ID,
    });
    expect(diagnostics[0]?.actualHash).toMatch(/^sha256:[0-9a-f]{64}$/);

    firstA.release();
    firstB.release();
    await loadAndRelease(harness.pipeline, 'diagnostic-a');

    expect(harness.source.acquireCounts.get('diagnostic-a.bin')).toBe(2);
    expect(diagnostics).toHaveLength(3);
  });

  it('reports diagnostics verifier failures without rejecting the Asset load', async () => {
    /// @case
    /// The configured SHA-256 implementation fails while diagnostics integrity
    /// policy is checking an otherwise loadable Artifact.
    /// @expect
    /// The failure is delivered as a structured integrity diagnostic, Decode
    /// continues, and the verifier failure remains available as its cause.
    const diagnostics: AssetIntegrityError[] = [];
    const verifierFailure = new Error('SHA-256 service unavailable.');
    const harness = await createHarness(
      [{
        hash: `sha256:${'0'.repeat(64)}`,
        key: 'diagnostic-verifier-address',
        resourceId: 'diagnostic-verifier-resource',
      }],
      0,
      [],
      () => Promise.reject(verifierFailure),
      AssetIntegrityPolicy.diagnostics,
      (error) => {
        diagnostics.push(error);
      },
    );

    await loadAndRelease(harness.pipeline, 'diagnostic-verifier-address');

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      cause: verifierFailure,
      expectedHash: `sha256:${'0'.repeat(64)}`,
      location: 'diagnostic-verifier-resource',
      sourceId: SOURCE_ID,
    });
    expect(
      harness.decoder.decodeCounts.get('diagnostic-verifier-resource'),
    ).toBe(1);
  });

  it('skips integrity computation when integrity is disabled', async () => {
    /// @case
    /// A Catalog record contains malformed integrity metadata while the
    /// installed pipeline explicitly disables integrity checking.
    /// @expect
    /// Loading succeeds without invoking SHA-256 or interpreting the disabled
    /// metadata.
    const implementation = vi.fn<Sha256>(() => Promise.resolve(
      new Uint8Array(32),
    ));
    const harness = await createHarness([{
      hash: 'sha256:not-a-digest',
      key: 'unchecked-address',
      resourceId: 'unchecked-resource',
    }], 0, [], implementation, AssetIntegrityPolicy.disabled);

    await loadAndRelease(harness.pipeline, 'unchecked-address');

    expect(implementation).not.toHaveBeenCalled();
    expect(harness.decoder.decodeCounts.get('unchecked-resource')).toBe(1);
  });

  it('requires integrity metadata before acquiring required artifacts', async () => {
    /// @case
    /// A Catalog record has no content hash while the installed pipeline
    /// requires integrity for every Artifact.
    /// @expect
    /// Acquire fails before contacting the Source and no runtime Asset is
    /// decoded.
    const harness = await createHarness([{
      key: 'missing-integrity-address',
      resourceId: 'missing-integrity-resource',
    }], 0, [], sha256, AssetIntegrityPolicy.required);

    const handle = harness.pipeline.loadAsset<TestAsset>(
      'missing-integrity-address',
    );

    await expect(handle.ready).rejects.toMatchObject({
      stage: 'acquire',
      cause: expect.objectContaining({
        message: expect.stringContaining('requires a SHA-256 hash'),
      }),
    });
    expect(
      harness.source.acquireCounts.get('missing-integrity-resource'),
    ).toBeUndefined();
    expect(
      harness.decoder.decodeCounts.get('missing-integrity-resource'),
    ).toBeUndefined();
    handle.release();
  });

  it('awaits an injected SHA-256 implementation and accepts uppercase hex', async () => {
    /// @case
    /// A Catalog record contains an uppercase SHA-256 digest and the injected
    /// platform implementation settles asynchronously.
    /// @expect
    /// Decode starts only after the digest resolves, and the matching artifact
    /// is published through the normal managed loading path.
    let digestSettled = false;
    const asynchronousSha256: Sha256 = async (bytes) => {
      await Promise.resolve();
      const digest = await sha256(bytes);
      digestSettled = true;
      return digest;
    };
    const harness = await createHarness([{
      hash: 'sha256:A12871FEE210FB8619291EAEA194581CBD2531E4B23759D225F6806923F63222',
      key: 'uppercase-hash-address',
      resourceId: 'uppercase-hash-resource',
    }], 0, [], asynchronousSha256);

    const handle = harness.pipeline.loadAsset<TestAsset>(
      'uppercase-hash-address',
    );
    const asset = await handle.ready;

    expect(digestSettled).toBe(true);
    expect(asset).toBeInstanceOf(TestAsset);
    expect(
      harness.decoder.decodeCounts.get('uppercase-hash-resource'),
    ).toBe(1);
    handle.release();
  });

  it('rejects malformed hashes before invoking the platform implementation', async () => {
    /// @case
    /// A Catalog record uses the SHA-256 prefix but does not provide exactly
    /// 64 hexadecimal characters.
    /// @expect
    /// Acquire fails as invalid metadata, the SHA implementation is never
    /// called, and no runtime Asset is decoded.
    const implementation = vi.fn<Sha256>(() => Promise.resolve(
      new Uint8Array(32),
    ));
    const harness = await createHarness([{
      hash: 'sha256:not-a-digest',
      key: 'invalid-hash-address',
      resourceId: 'invalid-hash-resource',
    }], 0, [], implementation);

    const handle = harness.pipeline.loadAsset<TestAsset>(
      'invalid-hash-address',
    );

    await expect(handle.ready).rejects.toMatchObject({
      stage: 'acquire',
      cause: expect.objectContaining({
        message: expect.stringContaining('Invalid SHA-256 hash'),
      }),
    });
    expect(implementation).not.toHaveBeenCalled();
    expect(
      harness.decoder.decodeCounts.get('invalid-hash-resource'),
    ).toBeUndefined();
    handle.release();
  });

  it('rejects a platform SHA-256 result with the wrong digest length', async () => {
    /// @case
    /// A platform SHA-256 implementation violates its contract by returning
    /// a 31-byte digest for otherwise valid Catalog metadata.
    /// @expect
    /// Acquire fails explicitly before comparison and the artifact never
    /// reaches Decode or the Ready cache.
    const harness = await createHarness([{
      hash: `sha256:${'0'.repeat(64)}`,
      key: 'short-digest-address',
      resourceId: 'short-digest-resource',
    }], 0, [], () => Promise.resolve(new Uint8Array(31)));

    const handle = harness.pipeline.loadAsset<TestAsset>(
      'short-digest-address',
    );

    await expect(handle.ready).rejects.toMatchObject({
      stage: 'acquire',
      cause: expect.objectContaining({
        message: expect.stringContaining('returned 31 bytes'),
      }),
    });
    expect(
      harness.decoder.decodeCounts.get('short-digest-resource'),
    ).toBeUndefined();
    handle.release();
  });

  it('evicts least-recently-used artifacts to remain within its byte budget', async () => {
    /// @case
    /// A three-byte Artifact cache loads two distinct two-byte assets, then
    /// revisits the newest asset before requesting the oldest one again.
    /// @expect
    /// The newest artifact is served without another Source call, while the
    /// least-recently-used artifact was evicted and must be acquired again.
    const harness = await createHarness([
      {
        key: 'first-address',
        resourceId: 'first-resource',
      },
      {
        key: 'second-address',
        resourceId: 'second-resource',
      },
    ], 3);

    await loadAndRelease(harness.pipeline, 'first-address');
    await loadAndRelease(harness.pipeline, 'second-address');
    await loadAndRelease(harness.pipeline, 'second-address');
    await loadAndRelease(harness.pipeline, 'first-address');

    expect(harness.source.acquireCounts.get('first-resource')).toBe(2);
    expect(harness.source.acquireCounts.get('second-resource')).toBe(1);
  });

  it('acquires a shared BINP artifact once with a zero-byte cache budget', async () => {
    /// @case
    /// A root asset and its dependency occupy different entries of the same
    /// BINP-v2 artifact while persistent Artifact retention is disabled.
    /// @expect
    /// The graph keeps the in-use package artifact for the duration of this
    /// load and calls the Source only once.
    const harness = await createHarness([
      {
        key: 'packed-root-address',
        resourceId: 'packed-root',
        artifactKey: 'shared.bin',
        entryIndex: 0,
        dependencies: ['packed-dependency'],
      },
      {
        resourceId: 'packed-dependency',
        artifactKey: 'shared.bin',
        entryIndex: 1,
      },
    ]);

    await loadAndRelease(harness.pipeline, 'packed-root-address');

    expect(harness.source.acquireCounts.get('shared.bin')).toBe(1);
    expect(harness.decoder.decodeCounts.get('packed-root')).toBe(1);
    expect(harness.decoder.decodeCounts.get('packed-dependency')).toBe(1);
  });

  it('shares a BINP artifact across concurrent top-level entry loads', async () => {
    /// @case
    /// Two concurrent public loads select different entries of the same
    /// BINP-v2 artifact while the persistent Artifact budget is zero.
    /// @expect
    /// The queued graph operations share one acquisition session and the
    /// underlying Source is called once.
    const harness = await createHarness([
      {
        key: 'entry-zero-address',
        resourceId: 'entry-zero',
        artifactKey: 'concurrent.bin',
        entryIndex: 0,
      },
      {
        key: 'entry-one-address',
        resourceId: 'entry-one',
        artifactKey: 'concurrent.bin',
        entryIndex: 1,
      },
    ]);

    const entryZero = harness.pipeline.loadAsset<TestAsset>(
      'entry-zero-address',
    );
    const entryOne = harness.pipeline.loadAsset<TestAsset>(
      'entry-one-address',
    );
    await Promise.all([entryZero.ready, entryOne.ready]);

    expect(harness.source.acquireCounts.get('concurrent.bin')).toBe(1);

    entryZero.release();
    entryOne.release();
  });

  it('selects the first available platform artifact variant', async () => {
    /// @case
    /// A managed Asset offers a default native artifact and a mini-game
    /// specific variant, while the runtime prefers that platform.
    /// @expect
    /// Acquire reads only the preferred variant and does not fetch the
    /// fallback artifact.
    const harness = await createHarness([
      {
        key: 'variant-address',
        resourceId: 'variant-resource',
        auxiliaryCandidates: [
          { key: 'fallback-native' },
          { key: 'wechat-native', variant: 'wechat' },
        ],
      },
    ], 0, ['wechat']);

    await loadAndRelease(harness.pipeline, 'variant-address');

    expect(harness.source.acquireCounts.get('wechat-native')).toBe(1);
    expect(
      harness.source.acquireCounts.get('fallback-native'),
    ).toBeUndefined();
  });
});

async function createHarness(
  specs: readonly AssetSpec[],
  artifactCacheByteBudget = 0,
  artifactVariantPreference: readonly string[] = [],
  sha256Implementation: Sha256 = sha256,
  integrityPolicy = AssetIntegrityPolicy.whenPresent,
  onIntegrityDiagnostic?: (error: AssetIntegrityError) => void,
): Promise<TestHarness> {
  const source = new TestArtifactSource();
  const decoder = new TestDecoder();
  const finalizer = new TestFinalizer();
  const records = new Map<string, AssetRecord>();
  const keys = new Map<string, readonly string[]>();
  const cocosUuids = new Map<string, string>();

  for (const spec of specs) {
    const primaryArtifact: ArtifactLocation = {
      sourceId: source.id,
      key: spec.artifactKey ?? spec.resourceId,
      format: 'test',
      hash: spec.hash,
      revision: '1',
      entry: spec.entryIndex === undefined
        ? undefined
        : {
          kind: ArtifactEntryKind.binPackV2,
          index: spec.entryIndex,
        },
    };
    records.set(spec.resourceId, {
      resourceId: spec.resourceId,
      cocosUuid: spec.uuid,
      runtimeTypeId: 'TestAsset',
      primaryArtifact,
      auxiliaryArtifactSets: spec.auxiliaryCandidates === undefined
        ? []
        : [{
          slot: 'native',
          candidates: spec.auxiliaryCandidates.map((candidate) => ({
            variant: candidate.variant,
            location: {
              sourceId: source.id,
              key: candidate.key,
              format: 'test',
              revision: '1',
            },
          })),
        }],
      directDependencies: spec.dependencies ?? [],
      revision: '1',
      decoderId: decoder.id,
    });
    if (spec.key !== undefined) {
      addCatalogKey(keys, spec.key, spec.resourceId);
    }
    for (const alias of spec.aliases ?? []) {
      addCatalogKey(keys, alias, spec.resourceId);
    }
    if (spec.uuid !== undefined) {
      cocosUuids.set(spec.uuid, spec.resourceId);
    }
    if (spec.dependencyUuids !== undefined) {
      decoder.dependencyUuids.set(spec.resourceId, spec.dependencyUuids);
    }
  }

  const catalog: AssetCatalog = {
    revision: 'test',
    keys,
    cocosUuids,
    records,
  };
  const configuration: AssetRuntimeConfiguration = {
    catalog,
    sources: [source],
    decoders: [decoder],
    finalizer,
    remoteAssetLoader: new UnsupportedRemoteAssetLoader(),
    sha256: sha256Implementation,
    integrityPolicy,
    onIntegrityDiagnostic,
    artifactCacheByteBudget,
    artifactVariantPreference,
  };
  const { installAssetPipelineWithConfiguration } = await import('@/install.js');

  return {
    decoder,
    finalizer,
    pipeline: await installAssetPipelineWithConfiguration(configuration),
    source,
  };
}

function addCatalogKey(
  keys: Map<string, readonly string[]>,
  key: string,
  resourceId: string,
): void {
  const existing = keys.get(key) ?? [];
  keys.set(key, [...existing, resourceId]);
}

async function loadAndRelease(
  pipeline: AssetPipeline,
  assetId: string,
): Promise<void> {
  const handle = pipeline.loadAsset<TestAsset>(assetId);
  await handle.ready;
  handle.release();
}

function abortError(key: string): Error {
  const error = new Error(`Acquire "${key}" was aborted.`);
  error.name = 'AbortError';
  return error;
}
