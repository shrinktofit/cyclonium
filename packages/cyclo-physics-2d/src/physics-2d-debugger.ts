import { assetManager, EffectAsset, gfx, Material, Node, renderer, Renderer, RenderingSubMesh, Scene } from 'cc';
import { px2Impl } from './px2-impl.js';

class Physics2DDebugRenderer extends Renderer {
  constructor() {
    super();
    const material = new Material('physics-2d-debugger');
    material.reset({
      effectName: 'builtin-unlit',
      states: {
        primitive: gfx.PrimitiveMode.LINE_LIST,
        rasterizerState: {
          lineWidth: 100,
        },
      },
    });
    this._material = material;
    this._loadMaterial();
  }

  protected override onEnable(): void {
    if (this._renderRecord) {
      this._renderRecord.model.enabled = true;
    }
  }

  protected override onDisable(): void {
    if (this._renderRecord) {
      this._renderRecord.model.enabled = false;
    }
  }

  render(world: px2Impl.World) {
    const { vertices, colors } = world.debugRender();
    const vertexCount = vertices.length / 2;
    this._ensureModelCapacity(vertexCount);
    const renderRecord = this._renderRecord;
    if (renderRecord) {
      this._setDrawVertexCount(renderRecord, vertexCount);
      if (vertexCount === 0) {
        return;
      }
      // @ts-expect-error Cocos buffer typings omit the runtime Float32Array update overload.
      renderRecord.vertexBuffer.update(vertices, vertices.byteLength);
      // @ts-expect-error Cocos buffer typings omit the runtime Float32Array update overload.
      renderRecord.colorVertexBuffer.update(colors, colors.byteLength);
    }
  }

  private _material: Material;
  private _materialLoaded = false;
  private _renderRecord: {
    vertexCapacity: number;
    drawInfo: gfx.DrawInfo;
    model: renderer.scene.Model;
    renderingSubMesh: RenderingSubMesh;
    vertexBuffer: gfx.Buffer;
    colorVertexBuffer: gfx.Buffer;
  } | undefined;

  private _ensureModelCapacity(requiredVertexCount: number) {
    if (requiredVertexCount === 0) {
      return;
    }

    const renderRecord = this._renderRecord;
    if (renderRecord) {
      if (renderRecord.vertexCapacity >= requiredVertexCount) {
        return;
      }
      renderRecord.model.scene?.removeModel(renderRecord.model);
      renderRecord.model.destroy();
      renderRecord.vertexBuffer.destroy();
      renderRecord.colorVertexBuffer.destroy();
      this._renderRecord = undefined;
    }

    const renderScene = this._getRenderScene();
    const device = renderScene.root.device;

    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      requiredVertexCount * 2 * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    const colorVertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      requiredVertexCount * 4 * Float32Array.BYTES_PER_ELEMENT,
      4 * Float32Array.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));

    const renderingSubMesh = new RenderingSubMesh(
      [vertexBuffer, colorVertexBuffer],
      [
        new gfx.Attribute(
          gfx.AttributeName.ATTR_POSITION,
          gfx.Format.RG32F,
          false,
          0,
          false,
          undefined,
        ),
        new gfx.Attribute(
          gfx.AttributeName.ATTR_COLOR,
          gfx.Format.RGBA32F,
          false,
          1,
          false,
          undefined,
        ),
      ],
      gfx.PrimitiveMode.LINE_LIST,
      undefined,
      undefined,
    );
    const drawInfo = new gfx.DrawInfo();
    renderingSubMesh.drawInfo = drawInfo;

    const model = new renderer.scene.Model();
    model.node = this.node;
    model.transform = this.node;
    model.initSubModel(0, renderingSubMesh, this._material);
    renderScene.addModel(model);

    this._renderRecord = {
      vertexCapacity: requiredVertexCount,
      drawInfo,
      model,
      renderingSubMesh,
      vertexBuffer,
      colorVertexBuffer,
    };
  }

  private _setDrawVertexCount(renderRecord: NonNullable<Physics2DDebugRenderer['_renderRecord']>, vertexCount: number) {
    renderRecord.drawInfo.vertexCount = vertexCount;
    renderRecord.renderingSubMesh.drawInfo = renderRecord.drawInfo;
    renderRecord.model.subModels[0]?.onGeometryChanged();
  }

  private _loadMaterial() {
    if (this._materialLoaded) {
      return;
    }
    this._materialLoaded = true;
    new Promise<EffectAsset>((resolve, reject) => {
      assetManager.loadAny<EffectAsset>('0352391c-bc3d-4674-bed1-3472beacecc1', (err, effect) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(effect);
      });
    })
      .then((effect) => {
        const material = new Material('physics-2d-debugger');
        material.reset({
          effectAsset: effect,
          states: {
            primitive: gfx.PrimitiveMode.LINE_LIST,
            rasterizerState: {
              lineWidth: 100,
            },
          },
        });
        material.setProperty('z', 1);
        this._material = material;
        if (this._renderRecord) {
          this._renderRecord.model.setSubModelMaterial(0, material);
        }
      })
      .catch((err) => {
        console.error('Failed to load physics-2d-debugger material', err);
      });
  }
}

export class Physics2DDebugger {
  constructor(private _implWorld: px2Impl.World, scene: Scene) {
    const node = this._node = new Node(`physics-2d-debugger`);
    this._node.parent = scene;
    const renderer = node.addComponent(Physics2DDebugRenderer);
    this._renderer = renderer;
  }

  destroy() {
    this._node.destroy();
  }

  render() {
    this._renderer.render(this._implWorld);
  }

  private _node: Node;
  private _renderer: Physics2DDebugRenderer;
}
