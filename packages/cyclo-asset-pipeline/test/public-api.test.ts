import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  AssetIntegrityError,
  AssetMergeMode,
  AssetPipeline,
  AssetPipelineInstallError,
  AssetPipelineInstallStage,
  AssetScope,
  AssetLoadCancelledError,
  AssetLoadError,
  AssetLoadStage,
  CycloAsset,
  installAssetPipeline,
  type AssetCollectionHandle,
  type AssetHandle,
} from '@/index.js';

class TestTexture extends CycloAsset {}

function assertAssetPipelineTypes(pipeline: AssetPipeline): void {
  const managedHandle = pipeline.loadAsset<TestTexture>('texture-address');
  const remoteHandle = pipeline.loadRemoteAsset(
    'https://example.com/texture.png',
    TestTexture,
  );
  const collectionHandle = pipeline.loadAssets<TestTexture>(
    ['texture-label', 'ui-label'],
    AssetMergeMode.intersection,
  );
  const installation = installAssetPipeline();

  expectTypeOf(managedHandle).toEqualTypeOf<AssetHandle<TestTexture>>();
  expectTypeOf(remoteHandle).toEqualTypeOf<AssetHandle<TestTexture>>();
  expectTypeOf(collectionHandle).toEqualTypeOf<
    AssetCollectionHandle<TestTexture>
  >();
  expectTypeOf(installation).toEqualTypeOf<Promise<AssetPipeline>>();

  // @ts-expect-error Operation identity is intentionally package-internal.
  const operationId: unknown = managedHandle.operationId;
  void operationId;
}

function assertAssetPipelineCannotBeConstructed(): void {
  // @ts-expect-error AssetPipeline construction is package-internal.
  new AssetPipeline();
}

void assertAssetPipelineTypes;
void assertAssetPipelineCannotBeConstructed;

describe('AssetPipeline public contract', () => {
  it('constructs scopes independently from a pipeline', () => {
    /// @case
    /// A caller creates a lifetime scope before choosing or constructing an
    /// asset pipeline.
    /// @expect
    /// The scope has no pipeline dependency and disposal aborts its lifecycle
    /// signal exactly once.
    const scope = new AssetScope();

    expect(scope.disposed).toBe(false);
    expect(scope.signal.aborted).toBe(false);

    scope.dispose();
    scope.dispose();

    expect(scope.disposed).toBe(true);
    expect(scope.signal.aborted).toBe(true);
  });

  it('forwards native Error options through public errors', () => {
    /// @case
    /// A caller constructs each public pipeline Error with a native cause and,
    /// for integrity failures, additional structured diagnostic details.
    /// @expect
    /// Every Error exposes the original cause through the native Error
    /// constructor contract without losing its pipeline-specific fields.
    const cause = new Error('root failure');
    const integrityError = new AssetIntegrityError(
      'integrity failure',
      {
        location: 'https://example.com/asset.bin',
        sourceId: 'web-http',
      },
      { cause },
    );
    const loadError = new AssetLoadError(
      'asset-address',
      AssetLoadStage.decode,
      'decode failure',
      { cause },
    );
    const cancelledError = new AssetLoadCancelledError(
      'asset-address',
      { cause },
    );
    const installError = new AssetPipelineInstallError(
      AssetPipelineInstallStage.parse,
      'parse failure',
      { cause },
    );

    expect(integrityError.cause).toBe(cause);
    expect(integrityError.location).toBe(
      'https://example.com/asset.bin',
    );
    expect(loadError.cause).toBe(cause);
    expect(loadError.stage).toBe(AssetLoadStage.decode);
    expect(cancelledError.cause).toBe(cause);
    expect(cancelledError.name).toBe('AbortError');
    expect(installError.cause).toBe(cause);
    expect(installError.stage).toBe(AssetPipelineInstallStage.parse);
  });
});
