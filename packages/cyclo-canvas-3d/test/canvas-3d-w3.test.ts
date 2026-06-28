import { beforeEach, describe, it } from 'vitest';
import { Vec2, Vec3 } from 'cc';
import { Canvas3D, Canvas3DLineCap } from '@/canvas-3d.js';
import { expectCanvasScreenshot, setupCanvas3DTest } from './helpers.js';

const getNode = setupCanvas3DTest();

describe('Canvas3DW3', () => {
  let canvas: Canvas3D = undefined!;

  beforeEach(() => {
    canvas = new Canvas3D({ node: getNode() });
  });

  it('w3-line-modes', async () => {
    canvas.w3
      .line({
        from: new Vec3(-4.25, -1.15, 0),
        lineWidth: 0.07,
        mode: 'wireframe',
        strokeColor: '#ffdc7a',
        to: new Vec3(-2.95, 0.95, 0.25),
      })
      .line({
        from: new Vec3(-0.95, -0.2, 0.4),
        lineWidth: 0.18,
        mode: 'solid',
        strokeColor: '#8fd3ff',
        to: new Vec3(0.65, 1.2, 1),
      })
      .line({
        from: new Vec3(2.45, -1.25, -0.2),
        lineWidth: 0.13,
        mode: 'both',
        strokeColor: '#f8f8f2',
        to: new Vec3(4.2, 0.45, 1.1),
      });

    await expectCanvasScreenshot('w3-line-modes', canvas);
  });

  it('w3-line-style', async () => {
    canvas.w3
      .line({
        from: new Vec3(-4.3, 2.1, 0),
        lineCap: Canvas3DLineCap.butt,
        lineWidth: 0.28,
        strokeColor: '#ffdc7a',
        to: new Vec3(4.3, 2.1, 0),
      })
      .line({
        from: new Vec3(-4.3, 0.75, 0.15),
        lineCap: Canvas3DLineCap.square,
        lineWidth: 0.28,
        strokeColor: '#8fd3ff',
        to: new Vec3(4.3, 0.75, 0.15),
      })
      .line({
        from: new Vec3(-4.3, -0.65, 0.3),
        lineCap: Canvas3DLineCap.round,
        lineWidth: 0.28,
        strokeColor: '#bd93f9',
        to: new Vec3(4.3, -0.65, 0.3),
      })
      .line({
        from: new Vec3(-4.3, -2.05, 0.45),
        lineCap: Canvas3DLineCap.round,
        lineDash: [0.55, 0.28, 0.18],
        lineDashOffset: 0.18,
        lineWidth: 0.22,
        strokeColor: '#50fa7b',
        to: new Vec3(4.3, -2.05, 0.45),
      });

    await expectCanvasScreenshot('w3-line-style', canvas);
  });

  it('w3-box-modes', async () => {
    canvas.w3.scope((w3) => {
      w3.translate(-2.85, 0, 0)
        .rotateY(Math.PI / 7)
        .rotateX(Math.PI / 10)
        .box({
          center: new Vec3(0, 0, 0),
          halfExtents: new Vec3(0.48, 0.75, 0.35),
          lineWidth: 0.07,
          mode: 'wireframe',
          strokeColor: '#ffdc7a',
        });
    });

    canvas.w3.scope((w3) => {
      w3.translate(0, 0, 0)
        .rotateY(Math.PI / 4)
        .rotateX(Math.PI / 12)
        .box({
          center: new Vec3(0, 0, 0),
          fillColor: '#8fd3ff',
          halfExtents: new Vec3(0.85, 0.42, 0.62),
          mode: 'solid',
        });
    });

    canvas.w3.scope((w3) => {
      w3.translate(2.85, 0, 0)
        .rotateY(Math.PI / 6)
        .rotateX(Math.PI / 5)
        .box({
          center: new Vec3(0, 0, 0),
          fillColor: '#bd93f9',
          halfExtents: new Vec3(0.58, 0.58, 0.88),
          lineWidth: 0.11,
          mode: 'both',
          strokeColor: '#f8f8f2',
        });
    });

    await expectCanvasScreenshot('w3-box-modes', canvas);
  });

  it('w3-quad-modes', async () => {
    canvas.w3
      .quad({
        center: new Vec3(-2.85, 0, 0),
        halfExtents: new Vec2(0.62, 0.42),
        lineWidth: 0.07,
        mode: 'wireframe',
        normal: new Vec3(0.3, 0.2, 1),
        strokeColor: '#ffdc7a',
      })
      .quad({
        center: new Vec3(0, 0, 0),
        fillColor: '#8fd3ff',
        halfExtents: new Vec2(0.82, 0.36),
        mode: 'solid',
        normal: new Vec3(-0.55, 0.45, 1),
      })
      .quad({
        center: new Vec3(2.85, 0, 0),
        fillColor: '#bd93f9',
        halfExtents: new Vec2(0.5, 0.7),
        lineWidth: 0.09,
        mode: 'both',
        normal: new Vec3(0.35, 0.9, 1),
        strokeColor: '#f8f8f2',
      });

    await expectCanvasScreenshot('w3-quad-modes', canvas);
  });

  it('w3-sphere-modes', async () => {
    canvas.w3
      .sphere({
        center: new Vec3(-2.85, 0, 0),
        lineWidth: 0.06,
        mode: 'wireframe',
        radius: 0.56,
        strokeColor: '#ffdc7a',
      })
      .sphere({
        center: new Vec3(0, 0, 0),
        fillColor: '#8fd3ff',
        mode: 'solid',
        radius: 0.86,
      })
      .sphere({
        center: new Vec3(2.85, 0, 0),
        fillColor: '#bd93f9',
        lineWidth: 0.1,
        mode: 'both',
        radius: 0.7,
        strokeColor: '#f8f8f2',
      });

    await expectCanvasScreenshot('w3-sphere-modes', canvas);
  });

  it('w3-capsule-modes', async () => {
    canvas.w3
      .capsule({
        center: new Vec3(-2.85, -0.05, 0.35),
        height: 1.8,
        lineWidth: 0.06,
        mode: 'wireframe',
        radius: 0.16,
        strokeColor: '#ffdc7a',
        up: new Vec3(0.5, 1.6, 0.35),
      })
      .capsule({
        center: new Vec3(0, -0.05, 0.35),
        fillColor: '#8fd3ff',
        height: 2.3,
        mode: 'solid',
        radius: 0.31,
        up: new Vec3(-0.65, 1.5, 0.8),
      })
      .capsule({
        center: new Vec3(2.85, -0.05, 0.35),
        fillColor: '#bd93f9',
        height: 1.55,
        lineWidth: 0.1,
        mode: 'both',
        radius: 0.22,
        strokeColor: '#f8f8f2',
        up: new Vec3(1.6, 0.95, 0.55),
      });

    await expectCanvasScreenshot('w3-capsule-modes', canvas);
  });

  it('w3-cylinder-modes', async () => {
    canvas.w3
      .cylinder({
        center: new Vec3(-2.85, -0.05, 0.3),
        height: 1.7,
        lineWidth: 0.07,
        mode: 'wireframe',
        radius: 0.28,
        strokeColor: '#ffdc7a',
        up: new Vec3(0.5, 1.4, 0.7),
      })
      .cylinder({
        center: new Vec3(0, -0.05, 0.3),
        fillColor: '#8fd3ff',
        height: 2.05,
        mode: 'solid',
        radius: 0.38,
        up: new Vec3(-0.4, 1.5, 0.5),
      })
      .cylinder({
        center: new Vec3(2.85, -0.05, 0.3),
        fillColor: '#bd93f9',
        height: 1.45,
        lineWidth: 0.09,
        mode: 'both',
        radius: 0.24,
        strokeColor: '#f8f8f2',
        up: new Vec3(1.2, 1, 0.65),
      });

    await expectCanvasScreenshot('w3-cylinder-modes', canvas);
  });

  it('w3-disc-modes', async () => {
    canvas.w3
      .disc({
        center: new Vec3(-2.85, 0, 0.2),
        lineWidth: 0.07,
        mode: 'wireframe',
        normal: new Vec3(0.2, 0.8, 1),
        radius: 0.62,
        strokeColor: '#ffdc7a',
      })
      .disc({
        center: new Vec3(0, 0, 0.2),
        fillColor: '#8fd3ff',
        mode: 'solid',
        normal: new Vec3(-0.55, 0.35, 1),
        radius: 0.82,
      })
      .disc({
        center: new Vec3(2.85, 0, 0.2),
        fillColor: '#bd93f9',
        lineWidth: 0.09,
        mode: 'both',
        normal: new Vec3(0.7, 0.25, 1),
        radius: 0.54,
        strokeColor: '#f8f8f2',
      });

    await expectCanvasScreenshot('w3-disc-modes', canvas);
  });

  it('w3-ring-modes', async () => {
    canvas.w3
      .ring({
        center: new Vec3(-2.85, 0, 0.2),
        innerRadius: 0.18,
        lineWidth: 0.07,
        mode: 'wireframe',
        normal: new Vec3(0.15, 0.55, 1),
        outerRadius: 0.72,
        strokeColor: '#ffdc7a',
      })
      .ring({
        center: new Vec3(0, 0, 0.2),
        fillColor: '#8fd3ff',
        innerRadius: 0.36,
        mode: 'solid',
        normal: new Vec3(-0.65, 0.2, 1),
        outerRadius: 0.84,
      })
      .ring({
        center: new Vec3(2.85, 0, 0.2),
        fillColor: '#bd93f9',
        innerRadius: 0.24,
        lineWidth: 0.09,
        mode: 'both',
        normal: new Vec3(0.45, 0.75, 1),
        outerRadius: 0.66,
        strokeColor: '#f8f8f2',
      });

    await expectCanvasScreenshot('w3-ring-modes', canvas);
  });

  it('w3-disc-segments', async () => {
    canvas.w3
      .disc({
        center: new Vec3(-2.85, 0, 0.2),
        fillColor: '#ffdc7a',
        lineWidth: 0.07,
        mode: 'both',
        normal: new Vec3(0.1, 0.35, 1),
        radius: 0.62,
        segments: 6,
        strokeColor: '#f8f8f2',
      })
      .disc({
        center: new Vec3(0, 0, 0.2),
        fillColor: '#8fd3ff',
        lineWidth: 0.07,
        mode: 'both',
        normal: new Vec3(-0.45, 0.25, 1),
        radius: 0.78,
        segments: 10,
        strokeColor: '#f8f8f2',
      })
      .disc({
        center: new Vec3(2.85, 0, 0.2),
        fillColor: '#bd93f9',
        lineWidth: 0.07,
        mode: 'both',
        normal: new Vec3(0.65, 0.4, 1),
        radius: 0.56,
        segments: 16,
        strokeColor: '#f8f8f2',
      });

    await expectCanvasScreenshot('w3-disc-segments', canvas);
  });

  it('w3-ring-segments', async () => {
    canvas.w3
      .ring({
        center: new Vec3(-2.85, 0, 0.2),
        fillColor: '#8fd3ff',
        innerRadius: 0.18,
        lineWidth: 0.07,
        mode: 'both',
        normal: new Vec3(-0.35, 0.25, 1),
        outerRadius: 0.72,
        segments: 8,
        strokeColor: '#f8f8f2',
      })
      .ring({
        center: new Vec3(0, 0, 0.2),
        fillColor: '#ffdc7a',
        innerRadius: 0.32,
        lineWidth: 0.07,
        mode: 'both',
        normal: new Vec3(0.3, 0.55, 1),
        outerRadius: 0.84,
        segments: 12,
        strokeColor: '#f8f8f2',
      })
      .ring({
        center: new Vec3(2.85, 0, 0.2),
        fillColor: '#ff9fb2',
        innerRadius: 0.22,
        lineWidth: 0.07,
        mode: 'both',
        normal: new Vec3(0.55, 0.2, 1),
        outerRadius: 0.64,
        segments: 18,
        strokeColor: '#f8f8f2',
      });

    await expectCanvasScreenshot('w3-ring-segments', canvas);
  });

  it('w3-sphere-segments', async () => {
    canvas.w3
      .sphere({
        center: new Vec3(-2.85, 0, 0.2),
        fillColor: '#bd93f9',
        latitudeSegments: 4,
        lineWidth: 0.06,
        longitudeSegments: 8,
        mode: 'both',
        radius: 0.58,
        strokeColor: '#f8f8f2',
      })
      .sphere({
        center: new Vec3(0, 0, 0.2),
        fillColor: '#50fa7b',
        latitudeSegments: 6,
        lineWidth: 0.06,
        longitudeSegments: 12,
        mode: 'both',
        radius: 0.74,
        strokeColor: '#f8f8f2',
      })
      .sphere({
        center: new Vec3(2.85, 0, 0.2),
        fillColor: '#8fd3ff',
        latitudeSegments: 8,
        lineWidth: 0.06,
        longitudeSegments: 18,
        mode: 'both',
        radius: 0.62,
        strokeColor: '#f8f8f2',
      });

    await expectCanvasScreenshot('w3-sphere-segments', canvas);
  });

  it('w3-cylinder-segments', async () => {
    canvas.w3
      .cylinder({
        center: new Vec3(-2.85, 0, 0.25),
        fillColor: '#ff9fb2',
        height: 1.3,
        lineWidth: 0.06,
        mode: 'both',
        radialSegments: 7,
        radius: 0.28,
        strokeColor: '#f8f8f2',
        up: new Vec3(0.35, 1.2, 0.55),
      })
      .cylinder({
        center: new Vec3(0, 0, 0.25),
        fillColor: '#ffdc7a',
        height: 1.65,
        lineWidth: 0.06,
        mode: 'both',
        radialSegments: 11,
        radius: 0.36,
        strokeColor: '#f8f8f2',
        up: new Vec3(-0.6, 1.35, 0.3),
      })
      .cylinder({
        center: new Vec3(2.85, 0, 0.25),
        fillColor: '#bd93f9',
        height: 1.15,
        lineWidth: 0.06,
        mode: 'both',
        radialSegments: 16,
        radius: 0.24,
        strokeColor: '#f8f8f2',
        up: new Vec3(0.85, 0.95, 0.7),
      });

    await expectCanvasScreenshot('w3-cylinder-segments', canvas);
  });

  it('w3-capsule-segments', async () => {
    canvas.w3
      .capsule({
        center: new Vec3(-2.85, 0, 0.25),
        capSegments: 3,
        fillColor: '#50fa7b',
        height: 1.75,
        lineWidth: 0.06,
        mode: 'both',
        radialSegments: 8,
        radius: 0.2,
        strokeColor: '#f8f8f2',
        up: new Vec3(0.85, 1.55, 0.45),
      })
      .capsule({
        center: new Vec3(0, 0, 0.25),
        capSegments: 5,
        fillColor: '#8fd3ff',
        height: 2.15,
        lineWidth: 0.06,
        mode: 'both',
        radialSegments: 12,
        radius: 0.3,
        strokeColor: '#f8f8f2',
        up: new Vec3(-0.5, 1.4, 0.8),
      })
      .capsule({
        center: new Vec3(2.85, 0, 0.25),
        capSegments: 7,
        fillColor: '#ffdc7a',
        height: 1.55,
        lineWidth: 0.06,
        mode: 'both',
        radialSegments: 16,
        radius: 0.24,
        strokeColor: '#f8f8f2',
        up: new Vec3(1.2, 1, 0.45),
      });

    await expectCanvasScreenshot('w3-capsule-segments', canvas);
  });

  it('w3-depth-options', async () => {
    canvas.w3.scope((w3) => {
      w3.depthTest()
        .depthWrite()
        .quad({
          center: new Vec3(-1.35, 0, 0.5),
          fillColor: '#ff5555',
          halfExtents: new Vec2(0.72, 0.72),
          mode: 'solid',
          normal: new Vec3(0, 0, 1),
        })
        .quad({
          center: new Vec3(-0.98, 0.2, -0.5),
          fillColor: '#8fd3ff',
          halfExtents: new Vec2(0.72, 0.72),
          mode: 'solid',
          normal: new Vec3(0, 0, 1),
        });
    });

    canvas.w3.scope((w3) => {
      w3.depthTest()
        .depthWrite()
        .quad({
          center: new Vec3(1.05, 0, 0.5),
          fillColor: '#ff5555',
          halfExtents: new Vec2(0.72, 0.72),
          mode: 'solid',
          normal: new Vec3(0, 0, 1),
        })
        .depthTest(false)
        .depthWrite(false)
        .quad({
          center: new Vec3(1.42, 0.2, -0.5),
          fillColor: '#50fa7b',
          halfExtents: new Vec2(0.72, 0.72),
          mode: 'solid',
          normal: new Vec3(0, 0, 1),
        });
    });

    await expectCanvasScreenshot('w3-depth-options', canvas);
  });

  it('w3-scope-isolation', async () => {
    canvas.w3.scope((w3) => {
      w3.color('#ff5555')
        .translate(-3.1, 1.2, 0)
        .rotateZ(Math.PI / 8)
        .box({
          center: new Vec3(0, 0, 0),
          halfExtents: new Vec3(0.55, 0.42, 0.3),
          lineWidth: 0.08,
          mode: 'both',
        });
    });

    canvas.w3.scope((w3) => {
      w3.box({
        center: new Vec3(0, 1.2, 0),
        halfExtents: new Vec3(0.55, 0.42, 0.3),
        lineWidth: 0.08,
        mode: 'wireframe',
      });
    });

    canvas.w3.scope((w3) => {
      w3.color('#50fa7b')
        .translate(3.1, 1.2, 0)
        .save()
        .translate(0, -1.75, 0)
        .color('#ff79c6')
        .sphere({
          center: new Vec3(0, 0, 0),
          mode: 'wireframe',
          radius: 0.42,
        })
        .restore()
        .sphere({
          center: new Vec3(0, 0, 0),
          mode: 'wireframe',
          radius: 0.42,
        });
    });

    canvas.w3.sphere({
      center: new Vec3(0, -1.55, 0),
      lineWidth: 0.08,
      mode: 'wireframe',
      radius: 0.42,
    });

    await expectCanvasScreenshot('w3-scope-isolation', canvas);
  });
});
