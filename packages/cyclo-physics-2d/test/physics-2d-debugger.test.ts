import { describe, expect, it, vi } from 'vitest';
import type { px2Impl } from '@/px2-impl.js';

interface DebugRenderFrame {
  vertices: Float32Array;
  colors: Float32Array;
}

interface DebugInputAssembler {
  vertexCount: number;
}

interface DebugSubModel {
  inputAssembler: DebugInputAssembler;
}

interface DebugModel {
  node?: { name: string };
  subModels: DebugSubModel[];
}

interface DebugRenderScene {
  models: DebugModel[];
}

interface DebugScene {
  renderScene: DebugRenderScene;
  destroy(): void;
}

vi.mock('cc', () => {
  class FakeBuffer {
    public destroyed = false;

    constructor(
      public readonly size: number,
      public readonly stride: number,
    ) {}

    update(_data: Float32Array, _size: number) {}

    destroy() {
      this.destroyed = true;
    }
  }

  class FakeDevice {
    createBuffer(info: { size: number; stride: number }) {
      return new FakeBuffer(info.size, info.stride);
    }
  }

  class FakeRenderScene implements DebugRenderScene {
    public readonly models: FakeModel[] = [];
    public readonly root = { device: new FakeDevice() };

    addModel(model: FakeModel) {
      model.scene = this;
      this.models.push(model);
    }

    removeModel(model: FakeModel) {
      const index = this.models.indexOf(model);
      if (index >= 0) {
        this.models.splice(index, 1);
      }
      model.scene = undefined;
    }
  }

  class FakeNode {
    public scene: FakeScene | undefined;
    private _parent: FakeNode | FakeScene | undefined;

    constructor(public readonly name = '') {}

    set parent(parent: FakeNode | FakeScene | undefined) {
      this._parent = parent;
      this.scene = parent instanceof FakeScene ? parent : parent?.scene;
    }

    get parent() {
      return this._parent;
    }

    addComponent<T extends FakeRenderer>(ComponentCtor: new () => T) {
      const component = new ComponentCtor();
      component.node = this;
      return component;
    }

    destroy() {}
  }

  class FakeScene extends FakeNode implements DebugScene {
    public readonly renderScene = new FakeRenderScene();

    constructor(name: string) {
      super(name);
      this.scene = this;
    }
  }

  class FakeRenderer {
    public node: FakeNode = undefined!;

    protected _getRenderScene() {
      return this.node.scene!.renderScene;
    }
  }

  class FakeMaterial {
    constructor(public readonly name: string) {}

    reset(_info: unknown) {}

    setProperty(_name: string, _value: unknown) {}
  }

  class FakeBufferInfo {
    constructor(
      public readonly _usage: unknown,
      public readonly _memoryUsage: unknown,
      public readonly size: number,
      public readonly stride: number,
      public readonly _flags: unknown,
    ) {}
  }

  class FakeAttribute {
    constructor(
      public readonly name: string,
      public readonly format: string,
      public readonly isNormalized: boolean,
      public readonly stream: number,
      public readonly isInstanced: boolean,
      public readonly location: number | undefined,
    ) {}
  }

  class FakeDrawInfo {
    constructor(public vertexCount = 0) {}
  }

  class FakeRenderingSubMesh {
    public drawInfo: FakeDrawInfo | undefined;

    constructor(public readonly vertexBuffers: FakeBuffer[]) {}
  }

  class FakeSubModel implements DebugSubModel {
    public readonly inputAssembler: DebugInputAssembler;

    constructor(private readonly subMesh: FakeRenderingSubMesh) {
      const vertexBuffer = subMesh.vertexBuffers[0]!;
      this.inputAssembler = {
        vertexCount: subMesh.drawInfo?.vertexCount ?? vertexBuffer.size / vertexBuffer.stride,
      };
    }

    onGeometryChanged() {
      if (this.subMesh.drawInfo) {
        this.inputAssembler.vertexCount = this.subMesh.drawInfo.vertexCount;
      }
    }
  }

  class FakeModel implements DebugModel {
    public node?: FakeNode;
    public transform?: FakeNode;
    public scene?: FakeRenderScene;
    public enabled = true;
    public readonly subModels: FakeSubModel[] = [];

    initSubModel(index: number, subMesh: FakeRenderingSubMesh, _material: FakeMaterial) {
      this.subModels[index] = new FakeSubModel(subMesh);
    }

    setSubModelMaterial(_index: number, _material: FakeMaterial) {}

    destroy() {}
  }

  return {
    assetManager: {
      loadAny(_uuid: string, callback: (err: Error | null, effect?: unknown) => void) {
        callback(null, {});
      },
    },
    EffectAsset: class {},
    gfx: {
      Attribute: FakeAttribute,
      AttributeName: {
        ATTR_POSITION: 'position',
        ATTR_COLOR: 'color',
      },
      BufferFlagBit: {
        NONE: 0,
      },
      BufferInfo: FakeBufferInfo,
      BufferUsageBit: {
        VERTEX: 1,
      },
      DrawInfo: FakeDrawInfo,
      Format: {
        RG32F: 'rg32f',
        RGBA32F: 'rgba32f',
      },
      MemoryUsageBit: {
        DEVICE: 1,
      },
      PrimitiveMode: {
        LINE_LIST: 1,
      },
    },
    Material: FakeMaterial,
    Node: FakeNode,
    renderer: {
      scene: {
        Model: FakeModel,
      },
    },
    Renderer: FakeRenderer,
    RenderingSubMesh: FakeRenderingSubMesh,
    Scene: FakeScene,
  };
});

function createDebugRenderWorld(frames: DebugRenderFrame[]) {
  let frameIndex = 0;
  return {
    debugRender() {
      const frame = frames[Math.min(frameIndex, frames.length - 1)]!;
      frameIndex += 1;
      return frame;
    },
  } as px2Impl.World;
}

function createFrame(vertexCount: number) {
  return {
    vertices: new Float32Array(vertexCount * 2),
    colors: new Float32Array(vertexCount * 4),
  };
}

function getDebugModel(scene: DebugScene) {
  const model = scene.renderScene.models.find((item) => item.node?.name === 'physics-2d-debugger');
  if (!model) {
    throw new Error('Physics2DDebugger did not create a render model.');
  }
  return model;
}

function getDebugDrawVertexCount(scene: DebugScene) {
  const subModel = getDebugModel(scene).subModels[0];
  if (!subModel) {
    throw new Error('Physics2DDebugger render model did not create a sub model.');
  }
  return subModel.inputAssembler.vertexCount;
}

describe('Physics2DDebugger', () => {
  it('should shrink the render draw count when debug geometry shrinks', async () => {
    /// @case
    /// 1. A debug world first returns two line segments.
    /// 2. The next frames return one line segment and then no vertices.
    /// @expect
    /// The render model draws only the current frame's vertices, so stale buffer tail data is not submitted.
    const [{ Physics2DDebugger }, { Scene }] = await Promise.all([
      import('@/physics-2d-debugger.js'),
      import('cc'),
    ]);
    const scene = new Scene('debugger-test-scene') as DebugScene;
    const world = createDebugRenderWorld([
      createFrame(4),
      createFrame(2),
      createFrame(0),
    ]);
    const physicsDebugger = new Physics2DDebugger(world, scene as never);

    physicsDebugger.render();
    expect(getDebugDrawVertexCount(scene)).toBe(4);

    physicsDebugger.render();
    expect(getDebugDrawVertexCount(scene)).toBe(2);

    physicsDebugger.render();
    expect(getDebugDrawVertexCount(scene)).toBe(0);

    physicsDebugger.destroy();
    scene.destroy();
  });
});
