import { describe, expect, it } from 'vitest';
import { Downloader } from '../../../src/runtime/downloader.ts';

const transparentPngDataUrl = [
  'data:image/png;base64',
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l1bJ8wAAAABJRU5ErkJggg==',
].join(',');

describe('Downloader.downloadImage', () => {
  it('should resolve an image loaded by the browser', async () => {
    const downloader = new Downloader({
      baseURL: window.location.href,
    });

    const image = await downloader.downloadImage(transparentPngDataUrl);

    expect(image).toBeInstanceOf(HTMLImageElement);
    expect(image.src).toBe(transparentPngDataUrl);
    expect(image.crossOrigin).toBe('anonymous');
    expect(image.complete).toBe(true);
    expect(image.naturalWidth).toBe(1);
    expect(image.naturalHeight).toBe(1);
  });

  it('should reject when the browser fails to load the image', async () => {
    const downloader = new Downloader({
      baseURL: window.location.href,
    });

    await expect(downloader.downloadImage('data:image/png;base64,not-an-image')).rejects.toBeInstanceOf(Event);
  });
});
