import '@cyclonium/cc-test/runtime/vitest-canvas-snapshot';
import { expect, it } from 'vitest';

it('should match a canvas snapshot', async () => {
  const canvas = createSplitFillCanvas();

  await expect(canvas).toMatchCanvasSnapshot('split-fill');
});

it('should match a canvas snapshot with a nested path', async () => {
  const canvas = createSplitFillCanvas();

  await expect(canvas).toMatchCanvasSnapshot('nested/a');
});

function createSplitFillCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 4;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Cannot create a 2D canvas context');
  }

  context.fillStyle = '#d73a49';
  context.fillRect(0, 0, 2, 4);
  context.fillStyle = '#2188ff';
  context.fillRect(2, 0, 2, 4);

  return canvas;
}
