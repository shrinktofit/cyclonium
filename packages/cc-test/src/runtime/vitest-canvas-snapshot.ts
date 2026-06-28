import { commands } from 'vitest/browser';
import { expect, type MatcherState } from 'vitest';

export function readCanvasPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export async function readCanvasPngImageData(canvas: HTMLCanvasElement): Promise<CanvasImageData> {
  return readPngDataUrlImageData(readCanvasPngDataUrl(canvas));
}

export async function readPngDataUrlImageData(dataUrl: string): Promise<CanvasImageData> {
  const image = await loadImage(dataUrl);
  const imageCanvas = document.createElement('canvas');
  imageCanvas.width = image.width;
  imageCanvas.height = image.height;

  const context = imageCanvas.getContext('2d');
  if (!context) {
    throw new Error('Cannot read image data without a 2D canvas context');
  }
  context.drawImage(image, 0, 0);
  return {
    width: imageCanvas.width,
    height: imageCanvas.height,
    data: context.getImageData(0, 0, imageCanvas.width, imageCanvas.height).data,
  };
}

expect.extend({
  async toMatchCanvasSnapshot(this: MatcherState, received: HTMLCanvasElement, name: string, hint?: string): Promise<CanvasMatcherResult> {
    if (!isCanvas(received)) {
      return {
        pass: false,
        message: () => 'Expected received value to be an HTMLCanvasElement',
      };
    }

    if (!isSnapshotName(name)) {
      return {
        pass: false,
        message: () => `Invalid canvas snapshot name: ${name}`,
      };
    }

    const actualDataUrl = readCanvasPngDataUrl(received);
    const result = await commands.matchCanvasSnapshot(name, actualDataUrl);
    if (!result.pass || !result.expectedDataUrl) {
      return {
        pass: result.pass,
        message: () => hint ? `${hint}: ${result.message}` : result.message,
      };
    }

    const comparison = await comparePngDataUrls(actualDataUrl, result.expectedDataUrl);
    return {
      pass: comparison.pass,
      message: () => {
        const message = `${result.message}. ${comparison.message}`;
        return hint ? `${hint}: ${message}` : message;
      },
    };
  },
});

declare module 'vitest' {
  interface Assertion<T> {
    toMatchCanvasSnapshot(name: string, hint?: string): Promise<T>;
  }
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    matchCanvasSnapshot(name: string, dataUrl: string): Promise<CanvasSnapshotResult>;
  }
}

interface CanvasImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface CanvasSnapshotResult {
  pass: boolean;
  message: string;
  expectedDataUrl?: string;
}

interface CanvasMatcherResult {
  pass: boolean;
  message: () => string;
}

function isCanvas(value: unknown): value is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement;
}

function isSnapshotName(name: string): boolean {
  return /^[a-zA-Z0-9_.-]+(?:[/\\][a-zA-Z0-9_.-]+)*$/.test(name)
    && !name.split(/[/\\]/).some((part) => {
      return part === '.' || part === '..';
    });
}

async function comparePngDataUrls(actualDataUrl: string, expectedDataUrl: string): Promise<{
  pass: boolean;
  message: string;
}> {
  const [actual, expected] = await Promise.all([
    readPngDataUrlImageData(actualDataUrl),
    readPngDataUrlImageData(expectedDataUrl),
  ]);

  if (actual.width !== expected.width || actual.height !== expected.height) {
    return {
      pass: false,
      message: `Expected image dimensions to be ${expected.width}x${expected.height}px, but received ${actual.width}x${actual.height}px`,
    };
  }

  let mismatchedPixels = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    const differs = (
      Math.abs(actual.data[i] - expected.data[i]) > 2
      || Math.abs(actual.data[i + 1] - expected.data[i + 1]) > 2
      || Math.abs(actual.data[i + 2] - expected.data[i + 2]) > 2
      || Math.abs(actual.data[i + 3] - expected.data[i + 3]) > 2
    );
    if (differs) {
      mismatchedPixels++;
    }
  }

  const maxMismatchedPixels = 512;
  return {
    pass: mismatchedPixels <= maxMismatchedPixels,
    message: `Mismatched pixels: ${mismatchedPixels}/${actual.width * actual.height}; allowed: ${maxMismatchedPixels}`,
  };
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.addEventListener('load', () => {
      resolve(image);
    }, { once: true });
    image.addEventListener('error', () => {
      reject(new Error('Failed to load canvas PNG'));
    }, { once: true });
  });
  image.src = src;
  return loaded;
}
