import { beforeEach, describe, it } from 'vitest';
import { Color, Vec3 } from 'cc';
import { Canvas3D, Canvas3DLineCap, Canvas3DLineJoin } from '@/canvas-3d.js';
import type { Canvas3DW2 } from '@/canvas-3d.js';
import { color, expectCanvasScreenshot, setupCanvas3DTest } from './helpers.js';

const getNode = setupCanvas3DTest();

describe('Canvas3DW2', () => {
  let canvas: Canvas3D = undefined!;
  let w2: Canvas3DW2 = undefined!;

  beforeEach(() => {
    canvas = new Canvas3D({ node: getNode() });
    w2 = canvas.w2;
    w2.fillColor = color('#f4f4f4');
    w2.strokeColor = color('#f4f4f4');
  });

  it('circle', async () => {
    w2.fillColor = color('#ffdc7a');
    w2.circle(new Vec3(-2.4, 1.3, 0), 1.55);
    w2.fill();
    await expectCanvasScreenshot('circle', canvas);
  });

  it('box2d', async () => {
    w2.fillColor = color('#8fd3ff');
    w2.box(new Vec3(2.2, -1.15, 0), new Vec3(1.45, 0.8, 0));
    w2.fill();
    await expectCanvasScreenshot('box2d', canvas);
  });

  it('stroke-circle-and-box', async () => {
    w2.lineWidth = 0.18;
    w2.strokeColor = color('#96f2d7');
    w2.circle(new Vec3(-2.15, -1.25, 0), 1.35);
    w2.stroke();

    w2.beginPath();
    w2.lineWidth = 0.26;
    w2.strokeColor = color('#ff9fb2');
    w2.box(new Vec3(2.25, 1.35, 0), new Vec3(1.25, 0.75, 0));
    w2.stroke();

    await expectCanvasScreenshot('stroke-circle-and-box', canvas);
  });

  it('line-stroke', async () => {
    w2.lineWidth = 0.16;
    w2.strokeColor = color('#c6a5ff');
    w2.moveTo(new Vec3(-4.4, -2.6, 0));
    w2.lineTo(new Vec3(-2.3, 1.15, 0));
    w2.lineTo(new Vec3(0.4, -0.85, 0));
    w2.lineTo(new Vec3(3.6, 2.3, 0));
    w2.stroke();

    await expectCanvasScreenshot('line-stroke', canvas);
  });

  it('line-width', async () => {
    w2.strokeColor = color('#ffffff');
    w2.lineWidth = 0.1;
    w2.moveTo(new Vec3(-4.2, 1.6, 0));
    w2.lineTo(new Vec3(4.2, 1.6, 0));
    w2.stroke();

    w2.beginPath();
    w2.strokeColor = color('#66d9ef');
    w2.lineWidth = 0.42;
    w2.moveTo(new Vec3(-4.2, -1.6, 0));
    w2.lineTo(new Vec3(4.2, -1.6, 0));
    w2.stroke();

    await expectCanvasScreenshot('line-width', canvas);
  });

  it('line-join', async () => {
    w2.lineWidth = 0.45;
    strokeJoinSample(w2, Canvas3DLineJoin.miter, -2.8, color('#ffb86b'));
    strokeJoinSample(w2, Canvas3DLineJoin.bevel, 0, color('#8be9fd'));
    strokeJoinSample(w2, Canvas3DLineJoin.round, 2.8, color('#bd93f9'));

    await expectCanvasScreenshot('line-join', canvas);
  });

  it('miter-limit', async () => {
    w2.lineWidth = 0.32;
    w2.lineJoin = Canvas3DLineJoin.miter;
    w2.lineCap = Canvas3DLineCap.butt;
    strokeMiterLimitSample(w2, 12, -2.3, color('#f1fa8c'));
    strokeMiterLimitSample(w2, 1.2, 2.3, color('#ff5555'));

    await expectCanvasScreenshot('miter-limit', canvas);
  });

  it('line-cap', async () => {
    w2.lineWidth = 0.5;
    strokeCapSample(w2, Canvas3DLineCap.butt, 2.2, color('#f8f8f2'));
    strokeCapSample(w2, Canvas3DLineCap.round, 0, color('#50fa7b'));
    strokeCapSample(w2, Canvas3DLineCap.square, -2.2, color('#ff79c6'));

    await expectCanvasScreenshot('line-cap', canvas);
  });

  it('line-dash', async () => {
    w2.lineWidth = 0.25;
    w2.lineCap = Canvas3DLineCap.round;
    w2.lineJoin = Canvas3DLineJoin.round;
    w2.lineDash = [0.6, 0.35, 0.2];
    w2.lineDashOffset = 0.24;
    w2.strokeColor = color('#ffdc7a');
    w2.moveTo(new Vec3(-4.4, 1.5, 0));
    w2.lineTo(new Vec3(-1.7, -0.6, 0));
    w2.lineTo(new Vec3(0.9, 1.3, 0));
    w2.lineTo(new Vec3(4.4, -1.1, 0));
    w2.stroke();

    w2.beginPath();
    w2.setLineDash([0.45, 0.25]);
    w2.lineDashOffset = 0.1;
    w2.strokeColor = color('#8fd3ff');
    w2.circle(new Vec3(0, -2.2, 0), 0.9);
    w2.stroke();

    await expectCanvasScreenshot('line-dash', canvas);
  });

  it('w2-command-order', async () => {
    w2.fillStyle = '#ffdc7a';
    w2.rect(-3, -2, 4.7, 4);
    w2.fill();

    w2.strokeStyle = '#ff5555';
    w2.lineWidth = 0.5;
    w2.stroke();

    w2.beginPath();
    w2.fillStyle = '#8fd3ff';
    w2.rect(-0.7, -1.45, 3.2, 2.9);
    w2.fill();

    await expectCanvasScreenshot('w2-command-order', canvas);
  });
});

function strokeJoinSample(w2: Canvas3DW2, lineJoin: Canvas3DLineJoin, x: number, strokeColor: Color): void {
  w2.beginPath();
  w2.lineJoin = lineJoin;
  w2.lineCap = Canvas3DLineCap.butt;
  w2.strokeColor = strokeColor;
  w2.moveTo(new Vec3(x - 1.1, -1.35, 0));
  w2.lineTo(new Vec3(x, 1.35, 0));
  w2.lineTo(new Vec3(x + 1.1, -1.35, 0));
  w2.stroke();
}

function strokeMiterLimitSample(w2: Canvas3DW2, miterLimit: number, x: number, strokeColor: Color): void {
  w2.beginPath();
  w2.miterLimit = miterLimit;
  w2.strokeColor = strokeColor;
  w2.moveTo(new Vec3(x - 1.35, -1.3, 0));
  w2.lineTo(new Vec3(x, 1.35, 0));
  w2.lineTo(new Vec3(x + 0.38, -1.3, 0));
  w2.stroke();
}

function strokeCapSample(w2: Canvas3DW2, lineCap: Canvas3DLineCap, y: number, strokeColor: Color): void {
  w2.beginPath();
  w2.lineCap = lineCap;
  w2.strokeColor = strokeColor;
  w2.moveTo(new Vec3(-2.5, y, 0));
  w2.lineTo(new Vec3(2.5, y, 0));
  w2.stroke();
}
