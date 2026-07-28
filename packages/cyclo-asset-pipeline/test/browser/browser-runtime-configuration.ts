import {
  _decorator,
  Asset,
  EffectAsset,
  ImageAsset,
  Material,
  Prefab,
  SceneAsset,
  SpriteFrame,
  Texture2D,
} from 'cc';

import { createRuntimeConfiguration } from '../../src/composition.js';
import {
  ArtifactEntryKind,
  type AssetCatalog,
  type AssetRecord,
} from '../../src/core/model.js';
import {
  installAssetPipelineWithConfiguration,
} from '../../src/install.js';

export const MANAGED_ASSET_CLASS_ID = 'CycloBrowser.ManagedAsset';
export const MANAGED_JSON_KEY = 'browser-managed-json';
export const MANAGED_CCON_KEY = 'browser-managed-ccon';
export const MANAGED_BINP_ZERO_KEY = 'browser-managed-binp-zero';
export const MANAGED_BINP_ONE_KEY = 'browser-managed-binp-one';
export const MANAGED_MATRIX_KEY = 'browser-managed-matrix';

export const MANAGED_UUIDS = {
  json: '10000000-0000-4000-8000-000000000001',
  ccon: '10000000-0000-4000-8000-000000000002',
  binpZero: '10000000-0000-4000-8000-000000000003',
  binpOne: '10000000-0000-4000-8000-000000000004',
  image: '20000000-0000-4000-8000-000000000001',
  texture: '20000000-0000-4000-8000-000000000002',
  spriteFrame: '20000000-0000-4000-8000-000000000003',
  effect: '20000000-0000-4000-8000-000000000004',
  material: '20000000-0000-4000-8000-000000000005',
  prefab: '20000000-0000-4000-8000-000000000006',
  scene: '20000000-0000-4000-8000-000000000007',
  matrix: '20000000-0000-4000-8000-000000000008',
} as const;

export const managedOnLoadedCalls = new Map<string, number>();

export class BrowserManagedAsset extends Asset {
  marker = '';
  image: ImageAsset | null = null;
  texture: Texture2D | null = null;
  spriteFrame: SpriteFrame | null = null;
  effect: EffectAsset | null = null;
  material: Material | null = null;
  prefab: Prefab | null = null;
  scene: SceneAsset | null = null;

  override onLoaded(): void {
    managedOnLoadedCalls.set(
      this._uuid,
      (managedOnLoadedCalls.get(this._uuid) ?? 0) + 1,
    );
  }
}

const managedPrototype = BrowserManagedAsset.prototype;
_decorator.property(String)(managedPrototype, 'marker');
_decorator.property(ImageAsset)(managedPrototype, 'image');
_decorator.property(Texture2D)(managedPrototype, 'texture');
_decorator.property(SpriteFrame)(managedPrototype, 'spriteFrame');
_decorator.property(EffectAsset)(managedPrototype, 'effect');
_decorator.property(Material)(managedPrototype, 'material');
_decorator.property(Prefab)(managedPrototype, 'prefab');
_decorator.property(SceneAsset)(managedPrototype, 'scene');
_decorator.ccclass(MANAGED_ASSET_CLASS_ID)(BrowserManagedAsset);

const records = [
  createRecord(
    'managed-json',
    MANAGED_JSON_KEY,
    MANAGED_UUIDS.json,
    MANAGED_ASSET_CLASS_ID,
    'managed-json',
    'json',
  ),
  createRecord(
    'managed-ccon',
    MANAGED_CCON_KEY,
    MANAGED_UUIDS.ccon,
    MANAGED_ASSET_CLASS_ID,
    'managed-ccon',
    'cconb',
  ),
  createRecord(
    'managed-binp-zero',
    MANAGED_BINP_ZERO_KEY,
    MANAGED_UUIDS.binpZero,
    MANAGED_ASSET_CLASS_ID,
    'shared-binp',
    'binp',
    0,
  ),
  createRecord(
    'managed-binp-one',
    MANAGED_BINP_ONE_KEY,
    MANAGED_UUIDS.binpOne,
    MANAGED_ASSET_CLASS_ID,
    'shared-binp',
    'binp',
    1,
  ),
  createRecord(
    'managed-image',
    undefined,
    MANAGED_UUIDS.image,
    'cc.ImageAsset',
    'managed-image',
    'json',
  ),
  createRecord(
    'managed-texture',
    undefined,
    MANAGED_UUIDS.texture,
    'cc.Texture2D',
    'managed-texture',
    'json',
  ),
  createRecord(
    'managed-sprite-frame',
    undefined,
    MANAGED_UUIDS.spriteFrame,
    'cc.SpriteFrame',
    'managed-sprite-frame',
    'json',
  ),
  createRecord(
    'managed-effect',
    undefined,
    MANAGED_UUIDS.effect,
    'cc.EffectAsset',
    'managed-effect',
    'json',
  ),
  createRecord(
    'managed-material',
    undefined,
    MANAGED_UUIDS.material,
    'cc.Material',
    'managed-material',
    'json',
  ),
  createRecord(
    'managed-prefab',
    undefined,
    MANAGED_UUIDS.prefab,
    'cc.Prefab',
    'managed-prefab',
    'json',
  ),
  createRecord(
    'managed-scene',
    undefined,
    MANAGED_UUIDS.scene,
    'cc.SceneAsset',
    'managed-scene',
    'json',
  ),
  createRecord(
    'managed-matrix',
    MANAGED_MATRIX_KEY,
    MANAGED_UUIDS.matrix,
    MANAGED_ASSET_CLASS_ID,
    'managed-matrix',
    'json',
  ),
];

const catalogKeys = new Map<string, readonly string[]>();
for (const record of records) {
  if (record.key !== undefined) {
    catalogKeys.set(record.key, [record.asset.resourceId]);
  }
}

const catalog: AssetCatalog = {
  revision: 'browser-managed-v1',
  keys: catalogKeys,
  cocosUuids: new Map(records.map((record) => (
    [record.asset.cocosUuid, record.asset.resourceId] as const
  ))),
  records: new Map(records.map((record) => (
    [record.asset.resourceId, record.asset] as const
  ))),
};

await installAssetPipelineWithConfiguration(createRuntimeConfiguration(
  {
    artifactCacheByteBudget: 0,
  },
  catalog,
));

function createRecord(
  resourceId: string,
  key: string | undefined,
  cocosUuid: string,
  runtimeTypeId: string,
  artifactKey: string,
  format: string,
  entryIndex?: number,
): {
  readonly asset: AssetRecord & {
    readonly cocosUuid: string;
  };
  readonly key: string | undefined;
} {
  return {
    key,
    asset: {
      resourceId,
      cocosUuid,
      runtimeTypeId,
      primaryArtifact: {
        sourceId: 'web-http',
        key: managedArtifactUrl(artifactKey),
        format,
        entry: entryIndex === undefined
          ? undefined
          : {
            kind: ArtifactEntryKind.binPackV2,
            index: entryIndex,
          },
      },
      auxiliaryArtifactSets: [],
      directDependencies: [],
      revision: 'browser-managed-v1',
      decoderId: 'cocos-import',
    },
  };
}

function managedArtifactUrl(key: string): string {
  return `/__cyclo_asset_pipeline__/managed/${encodeURIComponent(key)}`;
}
