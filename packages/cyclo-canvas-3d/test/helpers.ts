import { beforeAll, beforeEach, expect } from 'vitest';
import { Camera, Color, director, Node, Scene } from 'cc';
import type { Canvas3D } from '@/canvas-3d.js';
import 'vitest/browser';
import { getCanvas, setupGame } from '@cyclonium/cc-test/runtime';
import '@cyclonium/cc-test/runtime/vitest-canvas-snapshot';

const defaultTickDeltaTime = 1 / 60;

let setupGamePromise: Promise<void> | undefined = undefined;

export function setupCanvas3DTest(): () => Node {
  let node: Node = undefined!;

  beforeAll(async () => {
    setupGamePromise ??= setupGame({
      canvas: {
        size: { width: 256, height: 256 },
        devicePixelRatio: 2,
      },
    });
    await setupGamePromise;
  });

  beforeEach(() => {
    const scene = new Scene('test');

    const cameraNode = new Node('camera');
    cameraNode.setPosition(0, 0, 10);
    const camera = cameraNode.addComponent(Camera);
    camera.projection = Camera.ProjectionType.ORTHO;
    camera.orthoHeight = 12;
    camera.clearColor = Color.fromHEX(new Color(), '#333333');
    scene.addChild(cameraNode);

    node = new Node();
    scene.addChild(node);
    director.runSceneImmediate(scene);
  });

  return () => {
    return node;
  };
}

export async function expectCanvasScreenshot(name: string, canvas: Canvas3D): Promise<void> {
  canvas.commit();
  director.tick(defaultTickDeltaTime);
  await expect(getCanvas()).toMatchCanvasSnapshot(name);
}

export function color(hex: string): Color {
  return Color.fromHEX(new Color(), hex);
}
