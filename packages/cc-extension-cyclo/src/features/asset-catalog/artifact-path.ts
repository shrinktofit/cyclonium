import { extname, isAbsolute, relative } from 'node:path';

import {
  NativeArtifactVariant,
  type IndexedArtifactLocation,
  type IndexedNativeArtifact,
} from './artifact-index.js';
import { CatalogCompileError } from './catalog-compiler.js';

const PLATFORM_FILE_FORMATS = new Set([
  'jpeg',
  'jpg',
  'mp3',
  'png',
  'ttf',
  'webp',
]);

export function createNativeArtifact(
  key: string,
  platform: string,
  redirectBundleName?: string,
): IndexedNativeArtifact {
  const format = fileFormat(key);
  const variant = nativeVariant(key, format);
  return {
    ...(variant === undefined
      ? {}
      : { variant }),
    location: {
      key,
      format,
      ...(platformUsesFileArtifacts(platform) && PLATFORM_FILE_FORMATS.has(format)
        ? { preferredKind: 'platform-file' as const }
        : {}),
      ...(redirectBundleName === undefined ? {} : { redirectBundleName }),
    },
  };
}

export function createImportArtifact(
  key: string,
  groupIndex?: number,
  redirectBundleName?: string,
): IndexedArtifactLocation {
  const extension = fileFormat(key);
  if (groupIndex !== undefined && extension === 'json') {
    throw new CatalogCompileError(
      `Unsupported Cocos packed JSON artifact "${key}" at group index ${groupIndex}. `
      + 'Cyclo technical Bundles must use compressionType "none".',
    );
  }
  if (groupIndex !== undefined && extension !== 'bin' && extension !== 'cconb') {
    throw new CatalogCompileError(
      `Unsupported packed import artifact "${key}".`,
    );
  }
  return {
    key,
    format: extension === 'bin' ? 'cconb' : extension,
    ...(groupIndex === undefined
      ? {}
      : { entry: { kind: 'bin-pack-v2' as const, index: groupIndex } }),
    ...(redirectBundleName === undefined ? {} : { redirectBundleName }),
  };
}

export function buildOutputUrl(outputRoot: string, artifactPath: string): string {
  const normalizedPath = artifactPath.replace(/\\/gu, '/');
  if (!isAbsolute(artifactPath)) {
    if (!/^(?:assets|remote|subpackages)\//u.test(normalizedPath)) {
      throw new CatalogCompileError(
        `IBuildResult returned non-canonical relative artifact path "${artifactPath}".`,
      );
    }
    return normalizedPath;
  }
  const relativePath = relative(outputRoot, artifactPath).replace(/\\/gu, '/');
  if (relativePath.startsWith('../') || relativePath === '..') {
    throw new CatalogCompileError(
      `Build artifact "${artifactPath}" is outside build output "${outputRoot}".`,
    );
  }
  return relativePath;
}

export function fileFormat(path: string): string {
  const extension = extname(path).toLowerCase().slice(1);
  if (extension.length === 0) {
    throw new CatalogCompileError(`Artifact "${path}" has no physical format extension.`);
  }
  return extension;
}

function nativeVariant(path: string, format: string): NativeArtifactVariant | undefined {
  switch (format) {
  case 'astc':
    return NativeArtifactVariant.astc;
  case 'pvr':
    return NativeArtifactVariant.pvr;
  case 'webp':
    return NativeArtifactVariant.webp;
  case 'pkm': {
    const normalized = path.toLowerCase();
    if (/(?:^|[._-])etc1(?:[._-]|$)/u.test(normalized)) {
      return NativeArtifactVariant.pkmEtc1;
    }
    if (/(?:^|[._-])etc2(?:[._-]|$)/u.test(normalized)) {
      return NativeArtifactVariant.pkmEtc2;
    }
    throw new CatalogCompileError(
      `PKM artifact "${path}" does not identify ETC1 or ETC2; refusing to guess.`,
    );
  }
  default:
    return undefined;
  }
}

function platformUsesFileArtifacts(platform: string): boolean {
  return platform === 'wechatgame'
    || platform === 'wechatprogram'
    || platform === 'alipay-mini-game'
    || platform === 'bytedance-mini-game';
}
