import '@cyclonium/cc-test/runtime/vitest-canvas-snapshot';
import { expect, it } from 'vitest';

it('should fail when a canvas snapshot is missing', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Cannot create a 2D canvas context');
  }

  context.fillStyle = '#d73a49';
  context.fillRect(0, 0, 4, 4);

  await expect(expect(canvas).toMatchCanvasSnapshot('missing-snapshot')).rejects.toThrow('Canvas snapshot does not exist');
});
