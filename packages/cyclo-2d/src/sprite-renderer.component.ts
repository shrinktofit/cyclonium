/// <meta "uuid"="1ca96b17-efb6-4805-961e-17c292d0840f"/>

import { CycloComponent } from '@cyclonium/core/framework';
import { designType, editable, executeInEditMode, cycloClass, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { Texture2D, Material, Color, renderer, RenderingSubMesh, gfx, EffectAsset, Vec2, Vec3, componentEditorTraits, geometry, assetManager, type Asset } from 'cc';
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
  get renderType() {
    return this._renderType;
  }

  set renderType(value) {
    this._renderType = value;
    this._constructRenderRecord();
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
    if (this._renderRecord) {
      this._updateModelBoundingShape(this._renderRecord.model);
      this._syncRenderRecordEnabled();
    }
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
    if (this._effectiveMaterial) {
      this._updateMaterialPixelsPerUnit(this._effectiveMaterial);
    }
    if (this._renderRecord) {
      this._updateModelBoundingShape(this._renderRecord.model);
    }
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
      if (this._renderRecord) {
        // nothing
      } else {
        this._destroyRenderRecord();
        this._constructRenderRecord();
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
  private _sprite: Texture2D | undefined = undefined;

  @serializable
  private _pixelsPerUnit = 100;

  @serializable
  private _material: Material | null = null;

  @serializable
  private _sortSettings = new SortSettings();

  private _renderRecord: {
    renderScene: renderer.RenderScene;
    renderingSubMeshes: RenderingSubMesh[];
    model: renderer.scene.Model;
  } | null = null;

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

  private _constructRenderRecord() {
    const renderScene = this._getRenderScene();
    const device = renderScene.root.device;
    const renderingSubMeshes: RenderingSubMesh[] = this._createRenderingSubMeshes(device);
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
      renderingSubMeshes: renderingSubMeshes,
      model: model,
      renderScene,
    };
    if (this._sortSettings.connected) {
      model.priority = this._sortSettings.sortingKey;
    }
  }

  private _createRenderingSubMeshes(device: gfx.Device): RenderingSubMesh[] {
    switch (this._renderType) {
    case SpriteRenderType.simple:
      return this._createRenderingSubMeshesInSimpleRenderType(device);
    default:
      throw new Error('Unsupported render type');
    }
  }

  private _createRenderingSubMeshesInSimpleRenderType(device: gfx.Device): RenderingSubMesh[] {
    const {
      vertexCount,
      positions,
      normals,
      indices,
    } = simpleSpriteQuad;

    const offsetPositionF = 0;
    const stridePositionF = 2;
    const offsetNormalF = offsetPositionF + stridePositionF;
    const strideNormalF = 2;
    const strideF = offsetNormalF + strideNormalF;
    const localVertexBuffer = new Float32Array(vertexCount * strideF);
    let pVerticesF = 0;
    for (let i = 0; i < vertexCount; i++) {
      localVertexBuffer[pVerticesF + offsetPositionF] = positions[i * 2];
      localVertexBuffer[pVerticesF + offsetPositionF + 1] = positions[i * 2 + 1];
      localVertexBuffer[pVerticesF + offsetNormalF] = normals[i * 2];
      localVertexBuffer[pVerticesF + offsetNormalF + 1] = normals[i * 2 + 1];
      pVerticesF += strideF;
    }

    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      localVertexBuffer.byteLength,
      Float32Array.BYTES_PER_ELEMENT * strideF,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(vertexBuffer, localVertexBuffer);
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
          gfx.Format.RGB32F,
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
    return [renderingSubMesh];
  }

  private _updateAllMaterialProperties(material: Material) {
    this._updateMaterialColor(material);
    this._updateMaterialSprite(material);
    this._updateMaterialPixelsPerUnit(material);
  }

  private _updateMaterialColor(material: Material) {
    material.setProperty('mainColor', this.color);
  }

  private _updateMaterialSprite(material: Material) {
    const pixelsPerUnit = this._pixelsPerUnit;
    let mainTexture: Texture2D | null = null;
    const spriteSize = new Vec2();
    if (this.sprite) {
      mainTexture = this.sprite;
      spriteSize.set(this.sprite.width / 2, this.sprite.height / 2);
    } else {
      mainTexture = null;
      spriteSize.set(pixelsPerUnit, pixelsPerUnit);
    }
    material.setProperty('mainTexture', mainTexture);
    material.setProperty('spriteSize', spriteSize);
  }

  private _updateMaterialPixelsPerUnit(material: Material) {
    material.setProperty('pixelsPerUnit', this._pixelsPerUnit);
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
    const halfSize = this._getBoundingHalfSize();
    bounds.min.set(-halfSize.x, -halfSize.y);
    bounds.max.set(halfSize.x, halfSize.y);
    return bounds;
  }

  private _getBoundingHalfSize() {
    if (!this.sprite) {
      return new Vec2(1, 1);
    }

    return new Vec2(
      this.sprite.width / 2 / this.pixelsPerUnit,
      this.sprite.height / 2 / this.pixelsPerUnit,
    );
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
  const positions = new Float32Array([
    -1, -1, // left bottom
    -1, 1, // left top
    1, 1, // right top
    1, -1, // right bottom
  ]);

  const n = Math.sqrt(2);

  const normals = positions.map((position) => n * position);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  return {
    vertexCount: 4,
    positions,
    normals,
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
