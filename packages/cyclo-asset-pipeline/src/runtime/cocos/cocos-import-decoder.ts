import type { AbortSignal } from '@cyclonium/abort-controller';

import {
  ArtifactEntryKind,
  ArtifactKind,
  type Artifact,
  type ArtifactCandidate,
  type DecodedAsset,
  type NativeBinding,
} from '../../core/model.js';
import type {
  AssetAuxiliaryArtifactBindingContext,
  AssetAuxiliaryArtifactSelectionContext,
  AssetDecodeContext,
  AssetDecoder,
} from '../../core/contracts.js';
import { decodeUtf8 } from '../../core/utf8.js';
import { readBinPackV2Entry } from './bin-pack-v2.js';
import { CocosRuntimeAbi } from './cocos-runtime-abi.js';
import { NativeArtifactDecoderRegistry } from './native-artifact-decoder.js';

export const COCOS_IMPORT_DECODER_ID = 'cocos-import';

enum CocosImportArtifactFormat {
  json = 'json',
  cconBinary = 'cconb',
}

export class CocosImportDecoder implements AssetDecoder {
  constructor(
    runtimeAbi: CocosRuntimeAbi,
    nativeArtifactDecoders: NativeArtifactDecoderRegistry,
  ) {
    this.#runtimeAbi = runtimeAbi;
    this.#nativeArtifactDecoders = nativeArtifactDecoders;
  }

  readonly id = COCOS_IMPORT_DECODER_ID;

  decode(
    context: AssetDecodeContext,
    signal: AbortSignal,
  ): Promise<DecodedAsset> {
    throwIfAborted(signal);

    if (context.primaryArtifact.kind !== ArtifactKind.bytes) {
      throw new Error(
        'Cocos import artifacts must be acquired as bytes.',
      );
    }

    let importBytes = context.primaryArtifact.bytes;
    const entry = context.record.primaryArtifact.entry;
    let format = normalizeFormat(context.primaryArtifact.format);
    if (entry !== undefined) {
      if (entry.kind !== ArtifactEntryKind.binPackV2) {
        throw new Error('Unsupported Cocos import artifact entry kind.');
      }

      importBytes = readBinPackV2Entry(importBytes, entry.index);
      format = CocosImportArtifactFormat.cconBinary;
    }

    let serialized: unknown;
    switch (format) {
    case CocosImportArtifactFormat.json: {
      serialized = parseJsonImportArtifact(importBytes);
      if (isPackedCocosJson(serialized)) {
        throw new Error(
          'Cocos packed JSON artifacts are not supported; provide '
          + 'standalone JSON, standalone CCONB, or a BINP-v2 entry.',
        );
      }
      break;
    }

    case CocosImportArtifactFormat.cconBinary:
      serialized = this.#runtimeAbi.decodeCconBinary(importBytes).value;
      break;

    default:
      throw new Error(
        `Unsupported Cocos import artifact format "${format}".`,
      );
    }

    throwIfAborted(signal);
    const result = this.#runtimeAbi.deserialize(
      serialized,
      context.record.cocosUuid,
    );
    try {
      this.#runtimeAbi.assertAssetType(
        result.asset,
        context.record.runtimeTypeId,
      );
      throwIfAborted(signal);
      return Promise.resolve({
        asset: result.asset,
        dependencyBindings: result.dependencyBindings,
      });
    } catch (error) {
      result.asset.destroy();
      throw error;
    }
  }

  selectAuxiliaryArtifact(
    context: AssetAuxiliaryArtifactSelectionContext,
  ): ArtifactCandidate {
    return this.#runtimeAbi.selectNativeArtifactCandidate(
      context.decoded.asset,
      context.set,
    );
  }

  async bindAuxiliaryArtifacts(
    context: AssetAuxiliaryArtifactBindingContext,
    signal: AbortSignal,
  ): Promise<NativeBinding | undefined> {
    throwIfAborted(signal);
    const nativeName = context.decoded.asset._native;
    const artifact = selectAcquiredNativeArtifact(context, nativeName);
    if (artifact === undefined) {
      return undefined;
    }
    const binding = await this.#nativeArtifactDecoders.decode(
      artifact,
      nativeName,
      context.decoded.asset._nativeDep,
      signal,
    );
    try {
      throwIfAborted(signal);
      return binding;
    } catch (error) {
      binding.discard();
      throw error;
    }
  }

  readonly #nativeArtifactDecoders: NativeArtifactDecoderRegistry;
  readonly #runtimeAbi: CocosRuntimeAbi;
}

function selectAcquiredNativeArtifact(
  context: AssetAuxiliaryArtifactBindingContext,
  nativeName: string,
): Artifact | undefined {
  if (nativeName === '') {
    return undefined;
  }

  if (context.auxiliaryArtifacts.size !== 1) {
    throw new Error(
      `Cocos asset "${context.record.resourceId}" declares native data `
      + `but resolved ${context.auxiliaryArtifacts.size} auxiliary artifacts; `
      + 'exactly one native artifact is required.',
    );
  }

  const entry = context.auxiliaryArtifacts.entries().next();
  if (entry.done === true) {
    throw new Error(
      `Cocos asset "${context.record.resourceId}" has no native artifact.`,
    );
  }

  return entry.value[1];
}

function normalizeFormat(format: string): string {
  const normalized = format.trim().toLowerCase();
  return normalized.startsWith('.')
    ? normalized.slice(1)
    : normalized;
}

function parseJsonImportArtifact(bytes: Uint8Array): unknown {
  const json = decodeUtf8(bytes);
  return JSON.parse(json) as unknown;
}

function isPackedCocosJson(value: unknown): boolean {
  if (
    !Array.isArray(value)
    || value.length !== 6
    || typeof value[0] !== 'number'
    || !Array.isArray(value[5])
  ) {
    return false;
  }

  return value[5].every((section: unknown): boolean => (
    Array.isArray(section)
  ));
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new Error('Cocos asset decoding was aborted.');
  }
}
