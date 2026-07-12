/// <meta "uuid"="1ca96b17-efb6-4805-961e-17c292d0840f"/>

import { CycloComponent } from '@cyclonium/core/framework';
import { designType, editable, executeInEditMode, cycloClass, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { Material, Color, renderer, RenderingSubMesh, gfx, EffectAsset, Vec3, componentEditorTraits, geometry, assetManager, type Asset } from 'cc';
import { assert, markEnum } from '@cyclonium/core/utils';
import { logger } from '@cyclonium/core/log';
import { Bounds2D } from '@cyclonium/core/math/bounds-2d';
import { Sprite } from './sprite.js';
import { SortableRenderer } from './sortable.js';
import { SortSettings } from './sort-settings.js';

const ENABLE_RENDERING: boolean = true;

export enum SpriteRenderType {
  simple = 'simple',
}
markEnum(SpriteRenderType);

interface RenderRecord {
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMeshes: RenderingSubMesh[];
  readonly vertexBuffer: gfx.Buffer;
  readonly localVertexBuffer: Float32Array;
  readonly model: renderer.scene.Model;
  dirty: number;
}

enum RenderRecordDirtyFlag {
  // Render type changes can alter submesh/model structure, so they require a full record rebuild.
  renderType = 1 << 0,
  // Bounds changes keep the same simple quad topology and only rewrite vertex data.
  bounds = 1 << 1,
}

interface SpriteRenderMesh {
  readonly renderingSubMeshes: RenderingSubMesh[];
  readonly vertexBuffer: gfx.Buffer;
  readonly localVertexBuffer: Float32Array;
}

const loadDefaultEffect = (() => {
  let defaultEffect: EffectAsset | Promise<EffectAsset | undefined> | undefined;
  return () => {
    if (defaultEffect instanceof Promise) {
      return defaultEffect;
    }
    if (!defaultEffect) {
      defaultEffect = (async () => {
        const loadedEffect = await loadAsset<EffectAsset>('230b4535-10a9-475d-843a-05cbf87b2227');
        defaultEffect = loadedEffect;
        return loadedEffect;
      })().catch((error) => {
        logger.error('Failed to load default effect', error);
        return undefined;
      });
    }
    return defaultEffect;
  };
})();

@cycloClass('cyclo.SpriteRenderer')
@executeInEditMode
export class SpriteRenderer extends CycloComponent implements SortableRenderer {
  static async prepare() {
    const effect = await loadDefaultEffect();
    if (!effect) {
      throw new Error('Failed to load default sprite renderer effect');
    }
  }

  @editable
  @serializable
  @designType(SpriteRenderType)
  @idem
  get renderType() {
    return this._renderType;
  }

  set renderType(value) {
    this._renderType = value;
    this._markRenderRecordDirty(RenderRecordDirtyFlag.renderType);
  }

  @editable
  get color() {
    return this._color;
  }

  set color(value) {
    this._color.set(value);
    if (this._effectiveMaterial) {
      this._updateMaterialColor(this._effectiveMaterial);
    }
  }

  @editable(Sprite)
  get sprite() {
    return this._sprite;
  }

  set sprite(value) {
    this._sprite = value;
    if (this._effectiveMaterial) {
      this._updateMaterialSprite(this._effectiveMaterial);
    }
    this._markRenderRecordDirty(RenderRecordDirtyFlag.bounds);
  }

  @editable
  @serializable
  debugShowNormals = false;

  @editable
  get sortSettings() {
    return this._sortSettings;
  }

  get [SortableRenderer.Tags.sortSettings]() {
    return this._sortSettings;
  }

  @editable
  get pixelsPerUnit() {
    return this._pixelsPerUnit;
  }

  set pixelsPerUnit(value) {
    this._pixelsPerUnit = value;
    this._markRenderRecordDirty(RenderRecordDirtyFlag.bounds);
  }

  @editable(Material)
  @idem
  get material() {
    return this._material;
  }

  set material(value) {
    this._material = value;
    if (value) {
      this._setEffectiveMaterial(value);
      return;
    }
    this._effectiveMaterial = undefined;
    void this._initializeEffectiveMaterial();
  }

  /**
   * The renderer's quad bounds in node-local space. The returned object should be treated as readonly.
   * When no sprite is assigned, this returns the default placeholder quad bounds from -1..1 on both axes.
   */
  get localBounds(): Bounds2D {
    return this._updateLocalBounds(this._localBounds ??= new Bounds2D());
  }

  setSortingKey(sortingKey: number) {
    if (this._renderRecord) {
      this._renderRecord.model.priority = sortingKey;
    }
  }

  [componentEditorTraits.BoundingComponent.Tags.getBoundingBox]() {
    const localBounds = this.localBounds;
    const bounds = geometry.AABB.fromPoints(
      new geometry.AABB(),
      vec2ToVec3(localBounds.min),
      vec2ToVec3(localBounds.max),
    );
    bounds.transform(this.node.worldMatrix, null, null, null, bounds);
    return bounds;
  }

  protected override onAwake(): void {
    const material = this._getMaterial();
    void material;
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this._destroyRenderRecord();
  }

  protected override onEnabled(): void {
    this._sortSettings.connect(this);
    this._syncRenderRecordEnabled();
  }

  protected override onDisabled(): void {
    this._sortSettings.disconnect();
    if (this._renderRecord) {
      this._renderRecord.model.priority = 0;
    }
    this._syncRenderRecordEnabled();
  }

  protected override onUpdate(): void {
    if (!ENABLE_RENDERING) {
      return;
    }

    switch (this.renderType) {
    case SpriteRenderType.simple:
      if (!this._renderRecord || (this._renderRecord.dirty & RenderRecordDirtyFlag.renderType) !== 0) {
        this._reconstructRenderRecord();
      } else if ((this._renderRecord.dirty & RenderRecordDirtyFlag.bounds) !== 0) {
        this._updateRenderRecordBounds(this._renderRecord);
      }
      break;
    default:
      this._destroyRenderRecord();
      break;
    }
  }

  @serializable
  private _renderType = SpriteRenderType.simple;

  @serializable
  private readonly _color = new Color(Color.WHITE);

  @serializable
  private _sprite: Sprite | undefined = undefined;

  @serializable
  private _pixelsPerUnit = 100;

  @serializable
  private _material: Material | null = null;

  @serializable
  private _sortSettings = new SortSettings();

  private _renderRecord: RenderRecord | null = null;

  private _effectiveMaterial: Material | undefined;

  private _localBounds: Bounds2D | undefined;

  private _getMaterial() {
    if (this._effectiveMaterial) {
      return this._effectiveMaterial;
    }
    return this._initializeEffectiveMaterial();
  }

  private _initializeEffectiveMaterial() {
    assert(!this._effectiveMaterial);

    if (this._material) {
      return this._setEffectiveMaterial(this._material);
    }

    const defaultEffect = loadDefaultEffect();
    if (defaultEffect instanceof EffectAsset) {
      return this._createDefaultEffectMaterialAndSetAsEffective(defaultEffect);
    }

    const material = new Material();
    material.reset({
      effectName: 'builtin-unlit',
    });
    void defaultEffect.then((effect) => {
      if (!effect) {
        return;
      }
      if (this._effectiveMaterial !== material) {
        return;
      }
      this._createDefaultEffectMaterialAndSetAsEffective(effect);
      material.destroy();
    });
    return this._setEffectiveMaterial(material);
  }

  private _createDefaultEffectMaterialAndSetAsEffective(effect: EffectAsset) {
    const material = new Material();
    material.reset({
      effectAsset: effect,
    });
    return this._setEffectiveMaterial(material);
  }

  private _setEffectiveMaterial(material: Material) {
    this._effectiveMaterial = material;
    this._updateAllMaterialProperties(material);
    const renderRecord = this._renderRecord;
    if (renderRecord) {
      renderRecord.model.subModels.forEach((_, subModelIndex) => {
        renderRecord.model.setSubModelMaterial(subModelIndex, material);
      });
    }
    return material;
  }

  private _destroyRenderRecord() {
    if (!this._renderRecord) {
      return;
    }
    const {
      renderScene,
      renderingSubMeshes,
      model,
    } = this._renderRecord;
    this._renderRecord = null;
    renderScene.removeModel(model);
    renderingSubMeshes.forEach((subMesh) => {
      subMesh.destroy();
    });
    model.destroy();
  }

  private _reconstructRenderRecord() {
    this._destroyRenderRecord();

    switch (this._renderType) {
    case SpriteRenderType.simple:
      break;
    default:
      return;
    }

    const renderScene = this._getRenderScene();
    const device = renderScene.root.device;
    const {
      renderingSubMeshes,
      vertexBuffer,
      localVertexBuffer,
    } = this._createRenderingSubMeshes(device);
    const model = new renderer.scene.Model();
    model.node = this.node;
    model.transform = this.node;
    this._updateModelBoundingShape(model);
    const material = this._getMaterial();
    renderingSubMeshes.forEach((subMesh, iSubModel) => {
      model.initSubModel(iSubModel, subMesh, material);
    });
    model.visFlags = this.node.layer;
    model.enabled = this._shouldRenderRecordBeEnabled();
    renderScene.addModel(model);
    this._renderRecord = {
      dirty: 0,
      renderingSubMeshes: renderingSubMeshes,
      vertexBuffer,
      localVertexBuffer,
      model: model,
      renderScene,
    };
    if (this._sortSettings.connected) {
      model.priority = this._sortSettings.sortingKey;
    }
  }

  private _markRenderRecordDirty(flag: RenderRecordDirtyFlag) {
    if (this._renderRecord) {
      this._renderRecord.dirty |= flag;
    }
  }

  private _updateRenderRecordBounds(renderRecord: RenderRecord) {
    this._updateSimpleRenderVertexBuffer(renderRecord.vertexBuffer, renderRecord.localVertexBuffer);
    this._updateModelBoundingShape(renderRecord.model);
    this._syncRenderRecordEnabled();
    renderRecord.dirty &= ~RenderRecordDirtyFlag.bounds;
  }

  private _createRenderingSubMeshes(device: gfx.Device): SpriteRenderMesh {
    switch (this._renderType) {
    case SpriteRenderType.simple:
      return this._createRenderingSubMeshesInSimpleRenderType(device);
    default:
      throw new Error('Unsupported render type');
    }
  }

  private _createRenderingSubMeshesInSimpleRenderType(device: gfx.Device): SpriteRenderMesh {
    const {
      indices,
    } = simpleSpriteQuad;
    const localVertexBuffer = new Float32Array(simpleSpriteQuad.vertexCount * simpleSpriteQuad.strideF);
    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      localVertexBuffer.byteLength,
      Float32Array.BYTES_PER_ELEMENT * simpleSpriteQuad.strideF,
      gfx.BufferFlagBit.NONE,
    ));
    this._updateSimpleRenderVertexBuffer(vertexBuffer, localVertexBuffer);
    const indexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.INDEX,
      gfx.MemoryUsageBit.DEVICE,
      indices.byteLength,
      indices.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(indexBuffer, indices);
    const renderingSubMesh = new RenderingSubMesh(
      [vertexBuffer],
      [
        new gfx.Attribute(
          gfx.AttributeName.ATTR_POSITION,
          gfx.Format.RG32F,
          false,
          undefined,
          false,
          undefined,
        ),
        new gfx.Attribute(
          gfx.AttributeName.ATTR_NORMAL,
          gfx.Format.RG32F,
          false,
          undefined,
          false,
          undefined,
        ),
        new gfx.Attribute(
          gfx.AttributeName.ATTR_TEX_COORD,
          gfx.Format.RG32F,
          false,
          undefined,
          false,
          undefined,
        ),
      ],
      gfx.PrimitiveMode.TRIANGLE_LIST,
      indexBuffer,
      null,
      true,
    );
    return {
      renderingSubMeshes: [renderingSubMesh],
      vertexBuffer,
      localVertexBuffer,
    };
  }

  private _updateSimpleRenderVertexBuffer(vertexBuffer: gfx.Buffer, localVertexBuffer: Float32Array) {
    const {
      offsetNormalF,
      offsetPositionF,
      offsetTexCoordF,
      normals,
      strideF,
      texCoords,
      uvVertexIndices,
      vertexCount,
    } = simpleSpriteQuad;
    const localBounds = this.localBounds;
    const spriteUV = this.sprite?.uv ?? texCoords;

    localVertexBuffer[offsetPositionF] = localBounds.xMin;
    localVertexBuffer[offsetPositionF + 1] = localBounds.yMin;
    localVertexBuffer[strideF + offsetPositionF] = localBounds.xMin;
    localVertexBuffer[strideF + offsetPositionF + 1] = localBounds.yMax;
    localVertexBuffer[2 * strideF + offsetPositionF] = localBounds.xMax;
    localVertexBuffer[2 * strideF + offsetPositionF + 1] = localBounds.yMax;
    localVertexBuffer[3 * strideF + offsetPositionF] = localBounds.xMax;
    localVertexBuffer[3 * strideF + offsetPositionF + 1] = localBounds.yMin;

    for (let iVertex = 0; iVertex < vertexCount; iVertex++) {
      const pVerticesF = iVertex * strideF;
      const pVectorF = iVertex * 2;
      const pUVF = uvVertexIndices[iVertex] * 2;
      localVertexBuffer[pVerticesF + offsetNormalF] = normals[pVectorF];
      localVertexBuffer[pVerticesF + offsetNormalF + 1] = normals[pVectorF + 1];
      localVertexBuffer[pVerticesF + offsetTexCoordF] = spriteUV[pUVF];
      localVertexBuffer[pVerticesF + offsetTexCoordF + 1] = spriteUV[pUVF + 1];
    }

    updateGfxBuffer(vertexBuffer, localVertexBuffer);
  }

  private _updateAllMaterialProperties(material: Material) {
    this._updateMaterialColor(material);
    this._updateMaterialSprite(material);
  }

  private _updateMaterialColor(material: Material) {
    material.setProperty('mainColor', this.color);
  }

  private _updateMaterialSprite(material: Material) {
    material.setProperty('mainTexture', this.sprite?.texture ?? null);
  }

  private _updateModelBoundingShape(model: renderer.scene.Model) {
    const localBounds = this.localBounds;
    model.createBoundingShape(
      new Vec3(localBounds.xMin, localBounds.yMin, 0),
      new Vec3(localBounds.xMax, localBounds.yMax, 0),
    );
    model.updateWorldBound();
  }

  private _updateLocalBounds(bounds: Bounds2D) {
    if (!this.sprite) {
      bounds.min.set(-1, -1);
      bounds.max.set(1, 1);
      return bounds;
    }

    const width = this.sprite.rect.width / this.pixelsPerUnit;
    const height = this.sprite.rect.height / this.pixelsPerUnit;
    const pivot = this.sprite.pivot;
    bounds.min.set(-pivot.x * width, -pivot.y * height);
    bounds.max.set((1 - pivot.x) * width, (1 - pivot.y) * height);
    return bounds;
  }

  private _syncRenderRecordEnabled() {
    if (this._renderRecord) {
      this._renderRecord.model.enabled = this._shouldRenderRecordBeEnabled();
    }
  }

  private _shouldRenderRecordBeEnabled() {
    return this.enabledInHierarchy && !!this.sprite;
  }
}

const simpleSpriteQuad = (() => {
  const offsetPositionF = 0;
  const stridePositionF = 2;
  const offsetNormalF = offsetPositionF + stridePositionF;
  const strideNormalF = 2;
  const offsetTexCoordF = offsetNormalF + strideNormalF;
  const strideTexCoordF = 2;
  const strideF = offsetTexCoordF + strideTexCoordF;
  const positions = new Float32Array([
    -1, -1, // left bottom
    -1, 1, // left top
    1, 1, // right top
    1, -1, // right bottom
  ]);

  const n = Math.sqrt(2);

  const normals = positions.map((position) => n * position);
  const texCoords = new Float32Array([
    0, 0, // left bottom
    0, 1, // left top
    1, 1, // right top
    1, 0, // right bottom
  ]);
  // Cocos SpriteFrame.uv is ordered as left-bottom, right-bottom, left-top, right-top.
  const uvVertexIndices = new Uint8Array([0, 2, 3, 1]);
  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  return {
    offsetNormalF,
    offsetPositionF,
    offsetTexCoordF,
    strideF,
    vertexCount: 4,
    normals,
    texCoords,
    uvVertexIndices,
    indices,
  };
})();

function loadAsset<TAsset extends Asset = Asset>(uuid: string) {
  return new Promise<TAsset>((resolve, reject) => {
    assetManager.loadAny<TAsset>(uuid, (error, asset) => {
      if (error) {
        reject(error);
      } else {
        resolve(asset);
      }
    });
  });
}

function updateGfxBuffer(buffer: gfx.Buffer, source: gfx.BufferSource | ArrayBufferView) {
  // The `gfx.BufferSource` type does not contains ArrayBufferView, whereas in actual this works as expected.
  buffer.update(source as gfx.BufferSource);
}

function vec2ToVec3(input: { x: number; y: number }) {
  return new Vec3(input.x, input.y, 0);
}
