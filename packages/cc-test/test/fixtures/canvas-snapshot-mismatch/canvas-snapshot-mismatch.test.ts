import '@cyclonium/cc-test/runtime/vitest-canvas-snapshot';
import { expect, it } from 'vitest';

it('should fail when a canvas snapshot has mismatched pixels', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 40;
  canvas.height = 40;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Cannot create a 2D canvas context');
  }

  context.fillStyle = '#2188ff';
  context.fillRect(0, 0, 40, 40);

  await expect(expect(canvas).toMatchCanvasSnapshot('split-fill')).rejects.toThrow('Mismatched pixels: 800/1600');
});
