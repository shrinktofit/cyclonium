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
import { Camera, Color, componentEditorTraits, director, gfx, ImageAsset, Material, Node, Scene, Texture2D } from 'cc';
import { SpriteRenderer } from '../src/sprite-renderer.component.js';
import { getCanvas, setupGame } from '@cyclonium/cc-test/runtime';
import { page } from 'vitest/browser';
import '@cyclonium/cc-test/runtime/vitest-canvas-snapshot';

let htmlCanvas: HTMLCanvasElement = undefined!;
const baseTestLayer = 1 << 2;
const customTestLayer = 1 << 3;
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
    const { renderer, texture } = await renderRectangle({
      nodeLayer: baseTestLayer,
    });

    expect(renderer.sprite).toBe(texture);
    await microTick();
    await expectCanvasToMatchSnapshot('sprite-before');

    const replacement = createRectangleTexture({
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
    renderer.sprite = createRectangleTexture({
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

    renderer.sprite = createRectangleTexture({
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

    renderer.sprite = createRectangleTexture({
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
  const texture = createRectangleTexture({
    fillStyle: opts.textureFillStyle,
    height: opts.textureHeight,
    width: opts.textureWidth,
  });
  await Promise.resolve();
  renderer.sprite = texture;
  renderer.pixelsPerUnit = opts.pixelsPerUnit ?? 64;
  renderer.color = opts.color ?? Color.WHITE;

  tick();
  tick();
  tick();
  return { node, parentNode, renderer, texture };
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
    const texture = createRectangleTexture({
      fillStyle: edgeCase.color,
      height: edgeCase.height,
      width: edgeCase.width,
    });
    await Promise.resolve();
    renderer.sprite = texture;
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
} = {}) {
  const scene = new Scene('sprite-renderer');
  scene.addChild(createCamera({
    orthoHeight: opts.cameraOrthoHeight,
    position: opts.cameraPosition,
    visibility: opts.cameraVisibility,
  }));
  if (spriteNode) {
    scene.addChild(spriteNode);
  }
  return scene;
}

function createCamera(opts: {
  orthoHeight?: number;
  position?: { x?: number; y?: number; z?: number };
  visibility?: number;
} = {}) {
  const cameraNode = new Node('camera');
  cameraNode.setPosition(opts.position?.x ?? 0, opts.position?.y ?? 0, opts.position?.z ?? 10);
  const camera = cameraNode.addComponent(Camera);
  camera.projection = Camera.ProjectionType.ORTHO;
  camera.orthoHeight = opts.orthoHeight ?? 6;
  camera.visibility = opts.visibility ?? 0xffffffff;
  camera.clearFlags = gfx.ClearFlagBit.COLOR;
  camera.clearColor = Color.fromHEX(new Color(), '#20242a');
  return cameraNode;
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
