import { describe, it } from 'vitest';
import { Vec2, Vec3 } from 'cc';
import { Canvas3D, Canvas3DLineCap, Canvas3DLineJoin } from '@/canvas-3d.js';
import { color, expectCanvasScreenshot, setupCanvas3DTest } from './helpers.js';

const getNode = setupCanvas3DTest();

describe('Canvas3D', () => {
  it('legacy-and-split-entrypoints', async () => {
    const canvas = new Canvas3D({ node: getNode() });

    canvas.lineJoin = Canvas3DLineJoin.round;
    canvas.lineCap = Canvas3DLineCap.round;
    canvas.lineWidth = 0.24;
    canvas.strokeColor = color('#ffdc7a');
    canvas.beginPath()
      .moveTo(new Vec3(-4.3, 1.55, 0))
      .lineTo(new Vec3(-2.7, 2.35, 0))
      .lineTo(new Vec3(-1.1, 1.55, 0))
      .stroke();

    canvas.w2.fillStyle = '#8fd3ff';
    canvas.w2.rect(-3.5, -1.4, 2.2, 1.8);
    canvas.w2.fill();

    canvas.w3.scope((w3) => {
      w3.color('#ff9fb2')
        .translate(1.9, 0.05, 0)
        .rotateY(Math.PI / 5)
        .box({
          center: new Vec3(0, 0, 0),
          halfExtents: new Vec3(0.75, 0.55, 0.45),
          lineWidth: 0.08,
        });
    });

    await expectCanvasScreenshot('legacy-and-split-entrypoints', canvas);
  });

  it('commit-updates-reused-render-resources', async () => {
    const canvas = new Canvas3D({ node: getNode() });

    canvas.w3.quad({
      center: new Vec3(-1.6, 0.25, 0),
      fillColor: '#ffdc7a',
      halfExtents: new Vec2(0.85, 0.65),
      mode: 'solid',
      normal: new Vec3(0.2, 0.25, 1),
    });
    await expectCanvasScreenshot('commit-reuse-first-frame', canvas);

    canvas.w3.sphere({
      center: new Vec3(1.55, -0.35, 0),
      fillColor: '#8fd3ff',
      mode: 'solid',
      radius: 0.72,
    });
    await expectCanvasScreenshot('commit-reuse-second-frame', canvas);
  });
});
