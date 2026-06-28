import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { BrowserCommandContext } from 'vitest/node';

export interface CanvasSnapshotResult {
  pass: boolean;
  message: string;
  expectedDataUrl?: string;
}

export const canvasSnapshotCommands = {
  async matchCanvasSnapshot(context: BrowserCommandContext, name: string, dataUrl: string): Promise<CanvasSnapshotResult> {
    const snapshotPath = getCanvasSnapshotPath(context, name);
    const actualPng = decodePngDataUrl(dataUrl);
    const updateSnapshot = context.project.config.snapshotOptions.updateSnapshot;

    if (!existsSync(snapshotPath)) {
      if (updateSnapshot === 'none') {
        return {
          pass: false,
          message: `Canvas snapshot does not exist: ${snapshotPath}`,
        };
      }

      await writePng(snapshotPath, actualPng);
      return {
        pass: true,
        message: `Canvas snapshot written: ${snapshotPath}`,
      };
    }

    if (updateSnapshot === 'all') {
      await writePng(snapshotPath, actualPng);
      return {
        pass: true,
        message: `Canvas snapshot updated: ${snapshotPath}`,
      };
    }

    const expectedPng = await readFile(snapshotPath);
    return {
      pass: true,
      message: `Canvas snapshot loaded: ${snapshotPath}`,
      expectedDataUrl: encodePngDataUrl(expectedPng),
    };
  },
};

function getCanvasSnapshotPath(context: BrowserCommandContext, name: string): string {
  if (!context.testPath) {
    throw new Error('Cannot infer canvas snapshot path outside of a test file');
  }
  if (!isSnapshotName(name)) {
    throw new Error(`Invalid canvas snapshot name: ${name}`);
  }

  return join(
    dirname(context.testPath),
    '__screenshots__',
    basename(context.testPath),
    `${name}.canvas.png`,
  );
}

function isSnapshotName(name: string): boolean {
  return /^[a-zA-Z0-9_.-]+(?:[/\\][a-zA-Z0-9_.-]+)*$/.test(name)
    && !name.split(/[/\\]/).some((part) => {
      return part === '.' || part === '..';
    });
}

function decodePngDataUrl(dataUrl: string): Buffer {
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) {
    throw new Error('Canvas snapshot must be a PNG data URL');
  }

  return Buffer.from(dataUrl.slice(prefix.length), 'base64');
}

function encodePngDataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function writePng(filepath: string, png: Buffer): Promise<void> {
  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, png);
}
