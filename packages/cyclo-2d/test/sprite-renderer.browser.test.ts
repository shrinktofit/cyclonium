vi.mock(import('cc'), async (importOriginal) => {
  const cc = await importOriginal();
  return {
    ...cc,
    componentEditorTraits: {
      BoundingComponent: {
        Tags: {
          getBoundingBox: Symbol.for('cyclo.componentEditorTraits.BoundingComponent.getBoundingBox'),
        },
      },
    } as typeof import('cc').componentEditorTraits,
  };
});

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Camera, Color, componentEditorTraits, director, gfx, ImageAsset, Material, Node, Rect, Scene, SpriteFrame, Texture2D } from 'cc';
import { Canvas3D } from '@cyclonium/canvas-3d';
import { getCanvas, setupGame } from '@cyclonium/cc-test/runtime';
import { page } from 'vitest/browser';
import { SpriteRenderer } from '../src/sprite-renderer.component.js';
import { readCanvasPngImageData } from '@cyclonium/cc-test/runtime/vitest-canvas-snapshot';

let htmlCanvas: HTMLCanvasElement = undefined!;
const baseTestLayer = 1 << 2;
const customTestLayer = 1 << 3;
const markerTestLayer = 1 << 4;
const cullingPixelsPerUnit = 64;
const cullingCameraHalfSize = 1;
const cullingPixelsPerWorldUnit = 512 / (cullingCameraHalfSize * 2);
const cullingEdgeCases = [
  {
    edge: 'left',
    color: '#ff4f6d',
    height: 48,
    offset: 0.3125,
    visiblePixels: 19,
    width: 192,
  },
  {
    edge: 'right',
    color: '#38d996',
    height: 56,
    offset: -0.25,
    visiblePixels: 31,
    width: 176,
  },
  {
    edge: 'top',
    color: '#54a7ff',
    height: 192,
    offset: -0.1875,
    visiblePixels: 27,
    width: 56,
  },
  {
    edge: 'bottom',
    color: '#ffd166',
    height: 176,
    offset: 0.25,
    visiblePixels: 43,
    width: 40,
  },
] as const;

beforeAll(async () => {
  htmlCanvas = getCanvas()!;

  const width = 512;
  const height = 512;

  await page.viewport(width, height);
  await setupGame({
    canvas: {
      size: { width, height },
      devicePixelRatio: 1,
    },
  });

  await SpriteRenderer.prepare();
});

describe.sequential('SpriteRenderer', () => {
  it('renders a simple rectangle texture', async () => {
    await renderRectangle({
      nodeLayer: baseTestLayer,
    });

    await microTick();
    await expectCanvasToMatchSnapshot('simple-rectangle-texture');
  });

  it('keeps non-rotated sprite frame UV quadrants upright', async () => {
    /// @case
    /// 1. A full-texture SpriteFrame has unique colors in all four quadrants.
    /// 2. The SpriteFrame is assigned to SpriteRenderer and rendered through the normal component path.
    /// @expect
    /// The rendered quad keeps left, right, top, and bottom quadrants in their source positions.
    const node = new Node('upright-sprite-frame-quadrants');
    node.layer = baseTestLayer;
    director.runSceneImmediate(createScene(node, {
      cameraVisibility: baseTestLayer,
    }));

    const renderer = node.addComponent(SpriteRenderer);
    await Promise.resolve();
    renderer.sprite = createQuadrantSpriteFrame();
    renderer.pixelsPerUnit = 64;

    await microTick();

    const canvasImage = await readCanvasPngImageData(htmlCanvas);
    expectCanvasPixelToHaveColor(canvasImage, 'top-left quadrant', 246, 246, '#ff4f6d');
    expectCanvasPixelToHaveColor(canvasImage, 'top-right quadrant', 266, 246, '#ffd166');
    expectCanvasPixelToHaveColor(canvasImage, 'bottom-left quadrant', 246, 266, '#54a7ff');
    expectCanvasPixelToHaveColor(canvasImage, 'bottom-right quadrant', 266, 266, '#72e0a8');
    await expectCanvasToMatchSnapshot('sprite-frame-upright-quadrants');
  });

  it('renders sprite frame atlas rect UVs instead of the full texture', async () => {
    /// @case
    /// 1. Three SpriteFrames share one atlas texture and use a sub-rect, a flipped sub-rect, and a rotated sub-rect.
    /// 2. Each SpriteFrame is assigned to a SpriteRenderer and rendered through the normal component path.
    /// @expect
    /// Rendered quads sample only their SpriteFrame UVs, and bounds use the SpriteFrame rect size.
    const texture = createAtlasTexture();
    const normalFrame = new SpriteFrame('atlas normal frame');
    normalFrame.reset({
      texture,
      rect: new Rect(64, 0, 64, 64),
    });
    const flippedFrame = new SpriteFrame('atlas flipped frame');
    flippedFrame.reset({
      texture,
      rect: new Rect(64, 0, 64, 64),
    });
    flippedFrame.flipUVX = true;
    const rotatedFrame = new SpriteFrame('atlas rotated frame');
    rotatedFrame.reset({
      texture,
      rect: new Rect(0, 0, 64, 32),
      isRotate: true,
    });

    const scene = createScene(undefined, {
      cameraVisibility: baseTestLayer,
    });
    const cases = [
      {
        name: 'normal',
        position: -2,
        sprite: normalFrame,
        size: { x: 1, y: 1 },
      },
      {
        name: 'flipped',
        position: 0,
        sprite: flippedFrame,
        size: { x: 1, y: 1 },
      },
      {
        name: 'rotated',
        position: 2,
        sprite: rotatedFrame,
        size: { x: 1, y: 0.5 },
      },
    ] as const;
    const nodes = cases.map((testCase) => {
      const node = new Node(`atlas-${testCase.name}`);
      node.layer = baseTestLayer;
      node.setPosition(testCase.position, 0, 0);
      scene.addChild(node);
      return { ...testCase, node };
    });

    director.runSceneImmediate(scene);

    for (const { node, size, sprite } of nodes) {
      const renderer = node.addComponent(SpriteRenderer);
      await Promise.resolve();
      renderer.sprite = sprite;
      renderer.pixelsPerUnit = 64;

      expectBounds2DToEqual(renderer.localBounds, {
        center: { x: 0, y: 0 },
        size,
      });
    }

    await microTick();
    await expectCanvasToMatchSnapshot('atlas-rect-uvs');
  });

  it('applies color changes to the rendered sprite', async () => {
    const tint = Color.fromHEX(new Color(), '#72e0a8');
    const { renderer } = await renderRectangle({
      nodeLayer: baseTestLayer,
      textureFillStyle: '#ffffff',
    });

    expectColorToEqual(renderer.color, Color.WHITE);
    await microTick();
    await expectCanvasToMatchSnapshot('color-before');

    renderer.color = tint;
    expectColorToEqual(renderer.color, tint);

    await microTick();
    await expectCanvasToMatchSnapshot('color-after');
  });

  it('updates the rendered sprite texture, size, and empty sprite state', async () => {
    const { renderer, sprite } = await renderRectangle({
      nodeLayer: baseTestLayer,
    });

    expect(renderer.sprite).toBe(sprite);
    await microTick();
    await expectCanvasToMatchSnapshot('sprite-before');

    const replacement = createRectangleSpriteFrame({
      fillStyle: '#54a7ff',
      height: 128,
      width: 64,
    });
    renderer.sprite = replacement;
    expect(renderer.sprite).toBe(replacement);

    await microTick();
    await expectCanvasToMatchSnapshot('sprite-size-after');

    renderer.sprite = undefined;
    expect(renderer.sprite).toBeUndefined();

    await microTick();
    await expectCanvasToMatchSnapshot('sprite-empty-after');
  });

  it('keeps editor bounds visible with and without a sprite', async () => {
    const node = new Node('empty-sprite');
    node.setPosition(2, -3, 0);
    director.runSceneImmediate(createScene(node));

    const renderer = node.addComponent(SpriteRenderer);
    await Promise.resolve();

    const bounds = renderer[componentEditorTraits.BoundingComponent.Tags.getBoundingBox]();

    expect(bounds).toBeDefined();
    expectAABBToEqual(bounds!, {
      center: { x: 2, y: -3, z: 0 },
      halfExtents: { x: 1, y: 1, z: 0 },
    });

    renderer.pixelsPerUnit = 32;
    renderer.sprite = createRectangleSpriteFrame({
      height: 32,
      width: 96,
    });

    const spriteBounds = renderer[componentEditorTraits.BoundingComponent.Tags.getBoundingBox]();

    expect(spriteBounds).toBeDefined();
    expectAABBToEqual(spriteBounds!, {
      center: { x: 2, y: -3, z: 0 },
      halfExtents: { x: 1.5, y: 0.5, z: 0 },
    });

    renderer.sprite = undefined;

    const restoredDefaultBounds = renderer[componentEditorTraits.BoundingComponent.Tags.getBoundingBox]();

    expect(restoredDefaultBounds).toBeDefined();
    expectAABBToEqual(restoredDefaultBounds!, {
      center: { x: 2, y: -3, z: 0 },
      halfExtents: { x: 1, y: 1, z: 0 },
    });
  });

  it('reports local render bounds from sprite size and pixels per unit', async () => {
    const node = new Node('local-bounds');
    node.setPosition(7, -11, 0);
    node.setScale(3, 5, 1);
    node.setRotationFromEuler(0, 0, 37);
    director.runSceneImmediate(createScene(node));

    const renderer = node.addComponent(SpriteRenderer);
    await Promise.resolve();

    const defaultBounds = renderer.localBounds;
    expectBounds2DToEqual(defaultBounds, {
      center: { x: 0, y: 0 },
      size: { x: 2, y: 2 },
    });

    renderer.sprite = createRectangleSpriteFrame({
      height: 512,
      width: 512,
    });
    renderer.pixelsPerUnit = 512;

    expect(renderer.localBounds).toBe(defaultBounds);
    expectBounds2DToEqual(renderer.localBounds, {
      center: { x: 0, y: 0 },
      size: { x: 1, y: 1 },
    });

    renderer.pixelsPerUnit = 1;

    expectBounds2DToEqual(renderer.localBounds, {
      center: { x: 0, y: 0 },
      size: { x: 512, y: 512 },
    });

    renderer.sprite = createRectangleSpriteFrame({
      height: 32,
      width: 120,
    });
    renderer.pixelsPerUnit = 8;

    expectBounds2DToEqual(renderer.localBounds, {
      center: { x: 0, y: 0 },
      size: { x: 15, y: 4 },
    });

    renderer.sprite = undefined;

    expect(renderer.localBounds).toBe(defaultBounds);
    expectBounds2DToEqual(renderer.localBounds, {
      center: { x: 0, y: 0 },
      size: { x: 2, y: 2 },
    });
  });

  it('uses sprite frame pivots as each local render origin', async () => {
    /// @case
    /// 1. Three sprite frames use pivots (0, 0), (1, 1), and (0.3, 0.8).
    /// 2. Each renderer draws and reports bounds with the node origin at its sprite frame pivot.
    /// @expect
    /// Local bounds, editor bounds, and rendered quads all move relative to their marked node origins.
    const pivotCases = [
      {
        fillStyle: '#ffd166',
        name: 'bottom-left',
        pivot: { x: 0, y: 0 },
        position: { x: -4, y: -2 },
        expectedLocalCenter: { x: 1, y: 0.5 },
        expectedWorldCenter: { x: -3, y: -1.5 },
      },
      {
        fillStyle: '#54a7ff',
        name: 'top-right',
        pivot: { x: 1, y: 1 },
        position: { x: 4, y: 2 },
        expectedLocalCenter: { x: -1, y: -0.5 },
        expectedWorldCenter: { x: 3, y: 1.5 },
      },
      {
        fillStyle: '#72e0a8',
        name: 'custom',
        pivot: { x: 0.3, y: 0.8 },
        position: { x: 0, y: 0 },
        expectedLocalCenter: { x: 0.4, y: -0.3 },
        expectedWorldCenter: { x: 0.4, y: -0.3 },
      },
    ] as const;

    const scene = createScene();
    const nodes = pivotCases.map((pivotCase) => {
      const node = new Node(`pivoted-sprite-${pivotCase.name}`);
      node.setPosition(pivotCase.position.x, pivotCase.position.y, 0);
      scene.addChild(node);
      return { ...pivotCase, node };
    });
    director.runSceneImmediate(scene);

    for (const pivotCase of nodes) {
      const renderer = pivotCase.node.addComponent(SpriteRenderer);
      await Promise.resolve();

      renderer.pixelsPerUnit = 64;
      renderer.sprite = createRectangleSpriteFrame({
        fillStyle: pivotCase.fillStyle,
        height: 64,
        pivot: pivotCase.pivot,
        width: 128,
      });

      expectBounds2DToEqual(renderer.localBounds, {
        center: pivotCase.expectedLocalCenter,
        size: { x: 2, y: 1 },
      });

      const bounds = renderer[componentEditorTraits.BoundingComponent.Tags.getBoundingBox]();
      expect(bounds).toBeDefined();
      expectAABBToEqual(bounds!, {
        center: { ...pivotCase.expectedWorldCenter, z: 0 },
        halfExtents: { x: 1, y: 0.5, z: 0 },
      });
    }

    drawWorldPositionMarkers(nodes.map(({ node }) => node));

    await microTick();
    await expectCanvasToMatchSnapshot('sprite-frame-pivots');
  });

  it('updates the rendered sprite size when pixelsPerUnit changes', async () => {
    const { renderer } = await renderRectangle({
      nodeLayer: baseTestLayer,
    });

    expect(renderer.pixelsPerUnit).toBe(64);
    await microTick();
    await expectCanvasToMatchSnapshot('pixels-per-unit-before');

    renderer.pixelsPerUnit = 32;
    expect(renderer.pixelsPerUnit).toBe(32);

    await microTick();
    await expectCanvasToMatchSnapshot('pixels-per-unit-after');
  });

  it('renders a texture when the sprite and camera use the same custom layer', async () => {
    await renderRectangle({
      nodeLayer: customTestLayer,
      cameraVisibility: customTestLayer,
    });

    await microTick();
    await expectCanvasToMatchSnapshot('simple-rectangle-texture-custom-layer');
  });

  it('does not render when the sprite layer is hidden from the camera', async () => {
    await renderRectangle({
      nodeLayer: customTestLayer,
      cameraVisibility: baseTestLayer,
    });

    await microTick();
    await expectCanvasToMatchSnapshot('simple-rectangle-texture-hidden-layer');
  });

  it('keeps partially visible sprite edges from being culled by their model bounds', async () => {
    await renderCullingEdgeRectangles();

    await microTick();
    await expectCanvasToMatchSnapshot('large-rectangles-edge-culling');
  });

  it('updates the model material after changing material at runtime', async () => {
    const { renderer } = await renderRectangle({
      nodeLayer: baseTestLayer,
    });

    await microTick();
    await expectCanvasToMatchSnapshot('material-before');

    // Switching to another effect should replace the old sprite material, so the old texture must stop rendering.
    const material = createBuiltinUnlitMaterial();
    renderer.material = material;
    expect(renderer.material).toBe(material);

    await microTick();
    await expectCanvasToMatchSnapshot('material-after');

    renderer.material = null;
    expect(renderer.material).toBeNull();

    await microTick();
    await expectCanvasToMatchSnapshot('material-reset-after');
  });

  it('hides and restores rendering when the component is disabled and enabled', async () => {
    const { renderer } = await renderRectangle({
      nodeLayer: baseTestLayer,
    });

    await microTick();
    await expectCanvasToMatchSnapshot('enabled-before');

    renderer.enabled = false;
    expect(renderer.enabled).toBe(false);

    await microTick();
    await expectCanvasToMatchSnapshot('enabled-disabled-after');

    renderer.enabled = true;
    expect(renderer.enabled).toBe(true);

    await microTick();
    await expectCanvasToMatchSnapshot('enabled-restored-after');
  });

  it('hides and restores rendering when a parent node is deactivated and activated', async () => {
    const { parentNode } = await renderRectangle({
      nodeLayer: baseTestLayer,
      wrapInParent: true,
    });

    await microTick();
    await expectCanvasToMatchSnapshot('parent-enabled-before');

    parentNode!.active = false;

    await microTick();
    await expectCanvasToMatchSnapshot('parent-disabled-after');

    parentNode!.active = true;

    await microTick();
    await expectCanvasToMatchSnapshot('parent-restored-after');
  });
});

async function renderRectangle(opts: {
  color?: Color;
  nodeLayer?: number;
  cameraVisibility?: number;
  cameraOrthoHeight?: number;
  cameraPosition?: { x?: number; y?: number; z?: number };
  textureFillStyle?: string;
  pixelsPerUnit?: number;
  textureHeight?: number;
  textureWidth?: number;
  wrapInParent?: boolean;
} = {}) {
  const node = new Node('sprite');
  node.setPosition(0, 0, 0);
  if (opts.nodeLayer !== undefined) {
    node.layer = opts.nodeLayer;
  }
  const parentNode = opts.wrapInParent ? new Node('sprite-parent') : undefined;
  if (parentNode) {
    parentNode.addChild(node);
  }
  const cameraVisibility = opts.cameraVisibility ?? node.layer;

  director.runSceneImmediate(createScene(parentNode ?? node, {
    cameraOrthoHeight: opts.cameraOrthoHeight,
    cameraPosition: opts.cameraPosition,
    cameraVisibility,
  }));

  const renderer = node.addComponent(SpriteRenderer);
  const sprite = createRectangleSpriteFrame({
    fillStyle: opts.textureFillStyle,
    height: opts.textureHeight,
    width: opts.textureWidth,
  });
  await Promise.resolve();
  renderer.sprite = sprite;
  renderer.pixelsPerUnit = opts.pixelsPerUnit ?? 64;
  renderer.color = opts.color ?? Color.WHITE;

  tick();
  tick();
  tick();
  return { node, parentNode, renderer, sprite };
}

async function renderCullingEdgeRectangles() {
  const scene = createScene(undefined, {
    cameraOrthoHeight: cullingCameraHalfSize,
    cameraVisibility: baseTestLayer,
  });
  const nodes = cullingEdgeCases.map((edgeCase) => {
    const node = new Node(`sprite-${edgeCase.edge}`);
    node.layer = baseTestLayer;
    const position = getCullingEdgePosition(edgeCase);
    node.setPosition(position.x, position.y, 0);
    scene.addChild(node);
    return { edgeCase, node };
  });

  director.runSceneImmediate(scene);

  for (const { edgeCase, node } of nodes) {
    const renderer = node.addComponent(SpriteRenderer);
    const sprite = createRectangleSpriteFrame({
      fillStyle: edgeCase.color,
      height: edgeCase.height,
      width: edgeCase.width,
    });
    await Promise.resolve();
    renderer.sprite = sprite;
    renderer.pixelsPerUnit = cullingPixelsPerUnit;
    renderer.color = Color.WHITE;
  }

  await microTick();
}

function getCullingEdgePosition(edgeCase: typeof cullingEdgeCases[number]) {
  const halfWidth = edgeCase.width / 2 / cullingPixelsPerUnit;
  const halfHeight = edgeCase.height / 2 / cullingPixelsPerUnit;
  const visibleSize = edgeCase.visiblePixels / cullingPixelsPerWorldUnit;
  switch (edgeCase.edge) {
  case 'left':
    return {
      x: -cullingCameraHalfSize - halfWidth + visibleSize,
      y: edgeCase.offset,
    };
  case 'right':
    return {
      x: cullingCameraHalfSize + halfWidth - visibleSize,
      y: edgeCase.offset,
    };
  case 'top':
    return {
      x: edgeCase.offset,
      y: cullingCameraHalfSize + halfHeight - visibleSize,
    };
  case 'bottom':
    return {
      x: edgeCase.offset,
      y: -cullingCameraHalfSize - halfHeight + visibleSize,
    };
  }
}

function createScene(spriteNode?: Node, opts: {
  cameraOrthoHeight?: number;
  cameraPosition?: { x?: number; y?: number; z?: number };
  cameraVisibility?: number;
  clearFlags?: gfx.ClearFlagBit;
  priority?: number;
} = {}) {
  const scene = new Scene('sprite-renderer');
  scene.addChild(createCamera({
    clearFlags: opts.clearFlags,
    orthoHeight: opts.cameraOrthoHeight,
    position: opts.cameraPosition,
    priority: opts.priority,
    visibility: opts.cameraVisibility,
  }));
  if (spriteNode) {
    scene.addChild(spriteNode);
  }
  return scene;
}

function createCamera(opts: {
  clearFlags?: gfx.ClearFlagBit;
  orthoHeight?: number;
  position?: { x?: number; y?: number; z?: number };
  priority?: number;
  visibility?: number;
} = {}) {
  const cameraNode = new Node('camera');
  cameraNode.setPosition(opts.position?.x ?? 0, opts.position?.y ?? 0, opts.position?.z ?? 10);
  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.ORTHO;
  camera.orthoHeight = opts.orthoHeight ?? 6;
  camera.priority = opts.priority ?? 0;
  camera.visibility = opts.visibility ?? 0xffffffff;
  camera.clearFlags = opts.clearFlags ?? gfx.ClearFlagBit.COLOR;
  camera.clearColor = Color.fromHEX(new Color(), '#20242a');
  return cameraNode;
}

function drawWorldPositionMarkers(nodes: readonly Node[]) {
  const firstNode = nodes[0];
  const scene = firstNode?.scene;
  if (!scene) {
    throw new Error('Can not draw world position markers before the nodes are added to a scene.');
  }

  scene.addChild(createCamera({
    clearFlags: gfx.ClearFlagBit.NONE,
    priority: 1,
    visibility: markerTestLayer,
  }));

  const markerNode = new Node('world-position-markers');
  markerNode.layer = markerTestLayer;
  scene.addChild(markerNode);

  const canvas = new Canvas3D({ node: markerNode });
  canvas.w2.fillStyle = '#ff00cc';
  canvas.w2.strokeStyle = '#ffffff';
  canvas.w2.lineWidth = 0.025;
  for (const node of nodes) {
    if (node.scene !== scene) {
      throw new Error('Can not draw world position markers for nodes from different scenes.');
    }
    const center = node.worldPosition.clone();
    canvas.w2.beginPath();
    canvas.w2.circle(center, 0.08);
    canvas.w2.fill();
    canvas.w2.stroke();
  }
  canvas.commit();
}

function createRectangleTexture(opts: {
  fillStyle?: string;
  height?: number;
  width?: number;
} = {}) {
  const width = opts.width ?? 128;
  const height = opts.height ?? 64;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;

  const context = sourceCanvas.getContext('2d')!;
  context.fillStyle = opts.fillStyle ?? '#ff6b6b';
  context.fillRect(0, 0, width, height);

  const image = new ImageAsset(sourceCanvas);
  const texture = new Texture2D('simple rectangle');
  texture.image = image;
  texture.uploadData(sourceCanvas);
  return texture;
}

function createAtlasTexture() {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = 128;
  sourceCanvas.height = 64;

  const context = sourceCanvas.getContext('2d')!;
  context.fillStyle = '#ffd166';
  context.fillRect(0, 0, 16, 64);
  context.fillStyle = '#ff00cc';
  context.fillRect(16, 0, 16, 64);
  context.fillStyle = '#ff4f6d';
  context.fillRect(32, 0, 32, 64);
  context.fillStyle = '#54a7ff';
  context.fillRect(64, 0, 32, 64);
  context.fillStyle = '#72e0a8';
  context.fillRect(96, 0, 32, 64);

  const image = new ImageAsset(sourceCanvas);
  const texture = new Texture2D('atlas texture');
  texture.image = image;
  texture.uploadData(sourceCanvas);
  return texture;
}

function createRectangleSpriteFrame(opts: {
  fillStyle?: string;
  height?: number;
  pivot?: { x: number; y: number };
  width?: number;
} = {}) {
  const texture = createRectangleTexture(opts);
  const sprite = new SpriteFrame('simple rectangle');
  sprite.reset({ texture });
  if (opts.pivot) {
    sprite.pivot.set(opts.pivot.x, opts.pivot.y);
  }
  return sprite;
}

function createQuadrantSpriteFrame() {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = 64;
  sourceCanvas.height = 64;

  const context = sourceCanvas.getContext('2d')!;
  context.fillStyle = '#ff4f6d';
  // top-left: red
  context.fillRect(0, 0, 32, 32);
  context.fillStyle = '#ffd166';
  // top-right: yellow
  context.fillRect(32, 0, 32, 32);
  context.fillStyle = '#54a7ff';
  // bottom-left: blue
  context.fillRect(0, 32, 32, 32);
  context.fillStyle = '#72e0a8';
  // bottom-right: green
  context.fillRect(32, 32, 32, 32);

  const image = new ImageAsset(sourceCanvas);
  const texture = new Texture2D('quadrant texture');
  texture.image = image;
  texture.uploadData(sourceCanvas);

  const sprite = new SpriteFrame('quadrant sprite');
  sprite.reset({ texture });
  return sprite;
}

function createBuiltinUnlitMaterial() {
  const material = new Material();
  material.reset({
    effectName: 'builtin-unlit',
  });
  return material;
}

function expectColorToEqual(actual: Color, expected: Color) {
  expect([actual.r, actual.g, actual.b, actual.a]).toEqual([expected.r, expected.g, expected.b, expected.a]);
}

function expectCanvasPixelToHaveColor(canvasImage: {
  data: Uint8ClampedArray;
  width: number;
}, label: string, x: number, y: number, expectedHex: string) {
  const iPixel = (y * canvasImage.width + x) * 4;
  const r = canvasImage.data[iPixel];
  const g = canvasImage.data[iPixel + 1];
  const b = canvasImage.data[iPixel + 2];
  const a = canvasImage.data[iPixel + 3];
  const expected = Color.fromHEX(new Color(), expectedHex);
  const tolerance = 4;
  expect(Math.abs(r - expected.r), `${label} red`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(g - expected.g), `${label} green`).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(b - expected.b), `${label} blue`).toBeLessThanOrEqual(tolerance);
  expect(a, `${label} alpha`).toBe(255);
}

function expectBounds2DToEqual(actual: {
  x: number;
  y: number;
  width: number;
  height: number;
}, expected: {
  center: { x: number; y: number };
  size: { x: number; y: number };
}) {
  expect(actual.x).toBeCloseTo(expected.center.x);
  expect(actual.y).toBeCloseTo(expected.center.y);
  expect(actual.width).toBeCloseTo(expected.size.x);
  expect(actual.height).toBeCloseTo(expected.size.y);
}

function expectAABBToEqual(actual: {
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}, expected: {
  center: { x: number; y: number; z: number };
  halfExtents: { x: number; y: number; z: number };
}) {
  expect(actual.center.x).toBeCloseTo(expected.center.x);
  expect(actual.center.y).toBeCloseTo(expected.center.y);
  expect(actual.center.z).toBeCloseTo(expected.center.z);
  expect(actual.halfExtents.x).toBeCloseTo(expected.halfExtents.x);
  expect(actual.halfExtents.y).toBeCloseTo(expected.halfExtents.y);
  expect(actual.halfExtents.z).toBeCloseTo(expected.halfExtents.z);
}

function tick(deltaTime = 1 / 60) {
  director.tick(deltaTime);
}

async function microTick() {
  tick();
  return Promise.resolve();
}

function expectCanvasToMatchSnapshot(snapshotName: string) {
  tick();
  return expect(htmlCanvas).toMatchCanvasSnapshot(snapshotName);
}
