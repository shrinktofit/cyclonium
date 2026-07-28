import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import type { IBundleConfig } from '@cocos/creator-types/editor/packages/builder/@types/public';

import type { BundleConfigSource } from './bundle-config-artifact-index.js';
import { CatalogCompileError } from './catalog-compiler.js';

const CONFIG_FILE_PATTERN = /^(?:cc\.)?config(?:\.[a-z0-9]+)?\.json$/u;

export async function readBuiltBundleConfigs(
  outputDirectory: string,
  expectedBundleNames: readonly string[],
): Promise<readonly BundleConfigSource[]> {
  const configFiles = (await listFiles(outputDirectory))
    .filter((file) => CONFIG_FILE_PATTERN.test(basename(file)));
  const configs = await Promise.all(configFiles.map(async (file) => {
    let document: unknown;
    try {
      document = JSON.parse(await readFile(file, 'utf8')) as unknown;
    } catch (error) {
      throw new CatalogCompileError(
        `Failed to parse built Cocos Bundle config "${file}".`,
        { cause: error },
      );
    }
    return {
      file,
      config: parseBundleConfig(document, file),
    };
  }));
  return expectedBundleNames.map((name) => {
    const matches = configs.filter(({ config }) => config.name === name);
    if (matches.length !== 1) {
      throw new CatalogCompileError(
        `Expected one built config for Cocos Bundle "${name}", found ${matches.length}.`,
      );
    }
    return {
      config: matches[0].config,
      directory: dirname(matches[0].file),
    };
  });
}

export function parseBundleConfig(value: unknown, file: string): IBundleConfig {
  if (
    !isRecord(value)
    || typeof value.importBase !== 'string'
    || typeof value.nativeBase !== 'string'
    || typeof value.name !== 'string'
    || !isStringArray(value.deps)
    || !isStringArray(value.uuids)
    || !isReferenceMap(value.packs)
    || !isRecord(value.versions)
    || !isReferenceArray(value.versions.import)
    || !isReferenceArray(value.versions.native)
    || !isReferenceArray(value.redirect)
    || typeof value.debug !== 'boolean'
    || !isReferenceMap(value.extensionMap)
  ) {
    throw new CatalogCompileError(
      `Built Cocos Bundle config "${file}" has an unsupported schema.`,
    );
  }
  return value as unknown as IBundleConfig;
}

async function listFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry): Promise<readonly string[]> => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return files.flat();
}

function isReferenceMap(value: unknown): boolean {
  return isRecord(value)
    && Object.values(value).every(isReferenceArray);
}

function isReferenceArray(value: unknown): value is Array<string | number> {
  return Array.isArray(value)
    && value.every((entry) => typeof entry === 'string' || typeof entry === 'number');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
