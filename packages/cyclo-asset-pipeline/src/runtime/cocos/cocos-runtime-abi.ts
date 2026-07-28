import * as cc from 'cc';

import type {
  AssetType,
  CycloAsset,
} from '../../core/public.js';
import type {
  ArtifactCandidate,
  AuxiliaryArtifactSet,
  CocosUuid,
  DependencyBinding,
} from '../../core/model.js';

const SUPPORTED_COCOS_RUNTIME_VERSION = '4.0.0';
const SUPPORTED_VORTEX_HOST_VERSION = '4.0.0-alpha.23';
const CCON_MAGIC = 0x4E4F4343;
const SUPPORTED_CCON_VERSIONS = new Set([1, 2]);
const CCON_HEADER_BYTE_LENGTH = 12;
const COMPRESSED_UUID_LENGTH = 22;
const BASE64_ALPHABET
  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const HEX_ALPHABET = '0123456789abcdef';

type CconBinaryDecoder = (bytes: Uint8Array) => unknown;

export interface CocosAudioPlayer {
  readonly duration: number;
  readonly type: number;
  destroy(): void;
}

export interface CocosAudioMeta {
  readonly duration: number;
  readonly player: CocosAudioPlayer;
  readonly type: number;
  readonly url: string;
}

interface CconContainer {
  readonly value: object;
  readonly document: unknown;
  readonly chunks: readonly Uint8Array[];
}

export interface CocosDeserializationResult {
  readonly asset: CycloAsset;
  readonly dependencyBindings: readonly DependencyBinding[];
}

export class CocosRuntimeAbi {
  constructor() {
    const runtimeVersion = cc.VERSION as string;
    if (runtimeVersion !== SUPPORTED_COCOS_RUNTIME_VERSION) {
      throw new Error(
        'Unsupported Cocos runtime ABI '
        + `"${runtimeVersion}". Cyclo targets Vortex `
        + `${SUPPORTED_VORTEX_HOST_VERSION}, whose runtime reports `
        + `"${SUPPORTED_COCOS_RUNTIME_VERSION}".`,
      );
    }

    this.#assertDetailsAbi();
    this.#decodeCconBinary = this.#resolveCconBinaryDecoder();
  }

  decodeCconBinary(bytes: Uint8Array): CconContainer {
    assertSupportedCconHeader(bytes);

    const decoded = this.#decodeCconBinary(bytes);
    if (!isObject(decoded)) {
      throw new Error(
        'cclegacy.internal.decodeCCONBinary returned a non-object value.',
      );
    }

    if (
      !Reflect.has(decoded, 'document')
      || !Reflect.has(decoded, 'chunks')
    ) {
      throw new Error(
        'cclegacy.internal.decodeCCONBinary returned an incompatible CCON object.',
      );
    }

    const chunks = Reflect.get(decoded, 'chunks') as unknown;
    if (
      !Array.isArray(chunks)
      || !chunks.every((chunk: unknown): chunk is Uint8Array => (
        chunk instanceof Uint8Array
      ))
    ) {
      throw new Error(
        'cclegacy.internal.decodeCCONBinary returned invalid CCON chunks.',
      );
    }

    return {
      value: decoded,
      document: Reflect.get(decoded, 'document') as unknown,
      chunks,
    };
  }

  deserialize(
    serialized: unknown,
    cocosUuid: CocosUuid | undefined,
  ): CocosDeserializationResult {
    const details = new cc.Details();
    const deserialized = cc.deserialize(
      serialized,
      details,
      {
        customEnv: cocosUuid === undefined
          ? undefined
          : {
            __uuid__: cocosUuid,
          },
      },
    );

    if (!(deserialized instanceof cc.Asset)) {
      throw new Error(
        'The Cocos import artifact did not deserialize to cc.Asset.',
      );
    }

    if (cocosUuid !== undefined) {
      deserialized._uuid = cocosUuid;
    }

    try {
      return {
        asset: deserialized,
        dependencyBindings: extractDependencyBindings(details),
      };
    } catch (error) {
      deserialized.destroy();
      throw error;
    }
  }

  assertAssetType(
    asset: CycloAsset,
    runtimeTypeId: string,
  ): void {
    const expectedType = resolveCocosAssetType(runtimeTypeId);
    if (
      !Object.prototype.isPrototypeOf.call(
        expectedType.prototype,
        asset,
      )
    ) {
      throw new Error(
        `Cocos import artifact produced "${cc.js.getClassName(asset)}" `
        + `instead of Catalog runtime type "${runtimeTypeId}".`,
      );
    }
  }

  selectNativeArtifactCandidate(
    asset: CycloAsset,
    set: AuxiliaryArtifactSet,
  ): ArtifactCandidate {
    const nativeFormat = normalizeNativeFormat(asset._native);
    if (nativeFormat === '') {
      throw new Error(
        `Cocos asset "${asset._uuid}" has auxiliary artifact slot `
        + `"${set.slot}" but selected no native artifact during deserialization.`,
      );
    }

    const matchingFormat = set.candidates.filter((candidate) => (
      normalizeNativeFormat(candidate.location.format) === nativeFormat
    ));
    if (matchingFormat.length === 0) {
      throw new Error(
        `Cocos asset "${asset._uuid}" selected native format `
        + `"${asset._native}", but Catalog slot "${set.slot}" has no `
        + 'matching artifact candidate.',
      );
    }

    const pkmVariant = selectPkmVariant(asset, nativeFormat);
    if (pkmVariant !== undefined) {
      const candidate = matchingFormat.find((value) => (
        value.variant === pkmVariant
      ));
      if (candidate === undefined) {
        throw new Error(
          `Cocos ImageAsset "${asset._uuid}" selected "${pkmVariant}", `
          + `but Catalog slot "${set.slot}" does not contain that variant.`,
        );
      }
      return candidate;
    }

    if (matchingFormat.length === 1) {
      return matchingFormat[0];
    }
    const fallback = matchingFormat.find((value) => (
      value.variant === undefined
    ));
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(
      `Cocos asset "${asset._uuid}" selected native format `
      + `"${asset._native}", but Catalog slot "${set.slot}" has `
      + `${matchingFormat.length} ambiguous candidates.`,
    );
  }

  async loadAudio(
    url: string,
    nativeDependency: unknown,
  ): Promise<CocosAudioMeta> {
    const legacy = cc.cclegacy as unknown;
    if (!isObject(legacy)) {
      throw new Error('The supported Cocos runtime must expose cclegacy.');
    }
    const AudioPlayer = Reflect.get(legacy, 'AudioPlayer') as unknown;
    if (typeof AudioPlayer !== 'function') {
      throw new Error(
        'The supported Cocos runtime must expose cclegacy.AudioPlayer.',
      );
    }
    const load = Reflect.get(AudioPlayer, 'load') as unknown;
    if (typeof load !== 'function') {
      throw new Error(
        'cclegacy.AudioPlayer.load does not match the supported runtime ABI.',
      );
    }

    const audioLoadMode = readAudioLoadMode(nativeDependency);
    const loaded = await Promise.resolve(Reflect.apply(
      load,
      AudioPlayer,
      [url, { audioLoadMode }],
    ) as unknown);
    if (!isObject(loaded)) {
      throw new Error('cclegacy.AudioPlayer.load returned a non-object player.');
    }
    const duration = Reflect.get(loaded, 'duration') as unknown;
    const type = Reflect.get(loaded, 'type') as unknown;
    const destroy = Reflect.get(loaded, 'destroy') as unknown;
    if (
      typeof duration !== 'number'
      || typeof type !== 'number'
      || typeof destroy !== 'function'
    ) {
      throw new Error(
        'cclegacy.AudioPlayer.load returned an incompatible player.',
      );
    }
    return {
      duration,
      player: loaded as unknown as CocosAudioPlayer,
      type,
      url,
    };
  }

  readonly #decodeCconBinary: CconBinaryDecoder;

  #assertDetailsAbi(): void {
    if (typeof cc.Details !== 'function') {
      throw new Error(
        'The supported Cocos runtime must export the Details constructor.',
      );
    }

    const details = new cc.Details();
    if (
      details.uuidList !== null
      || details.uuidObjList !== null
      || details.uuidPropList !== null
      || !Array.isArray(details.uuidTypeList)
    ) {
      throw new Error(
        'The Cocos Details dependency-slot ABI does not match '
        + `Vortex ${SUPPORTED_VORTEX_HOST_VERSION}.`,
      );
    }
  }

  #resolveCconBinaryDecoder(): CconBinaryDecoder {
    const legacy = cc.cclegacy as unknown;
    if (!isObject(legacy)) {
      throw new Error('The supported Cocos runtime must expose cclegacy.');
    }

    const internal = Reflect.get(legacy, 'internal') as unknown;
    if (!isObject(internal)) {
      throw new Error(
        'The supported Cocos runtime must expose cclegacy.internal.',
      );
    }

    const decoder = Reflect.get(internal, 'decodeCCONBinary') as unknown;
    if (typeof decoder !== 'function' || decoder.length !== 1) {
      throw new Error(
        'cclegacy.internal.decodeCCONBinary does not match the '
        + `Vortex ${SUPPORTED_VORTEX_HOST_VERSION} ABI.`,
      );
    }

    return (bytes: Uint8Array): unknown => (
      Reflect.apply(decoder, internal, [bytes]) as unknown
    );
  }
}

function selectPkmVariant(
  asset: CycloAsset,
  nativeFormat: string,
): 'pkm-etc1' | 'pkm-etc2' | undefined {
  if (nativeFormat !== 'pkm') {
    return undefined;
  }
  if (!(asset instanceof cc.ImageAsset)) {
    throw new Error(
      `Cocos asset "${asset._uuid}" selected PKM native data without `
      + 'deserializing to ImageAsset.',
    );
  }

  const pixelFormat = asset.format;
  switch (pixelFormat) {
  case cc.Texture2D.PixelFormat.RGB_ETC1:
  case cc.Texture2D.PixelFormat.RGBA_ETC1:
    return 'pkm-etc1';

  case cc.Texture2D.PixelFormat.RGB_ETC2:
  case cc.Texture2D.PixelFormat.RGBA_ETC2:
    return 'pkm-etc2';

  default:
    throw new Error(
      `Cocos ImageAsset "${asset._uuid}" selected PKM native data with `
      + `unsupported pixel format ${pixelFormat}.`,
    );
  }
}

function normalizeNativeFormat(format: string): string {
  const normalized = format.trim().toLowerCase();
  const withoutDot = normalized.startsWith('.')
    ? normalized.slice(1)
    : normalized;
  return withoutDot === 'jpg' ? 'jpeg' : withoutDot;
}

function readAudioLoadMode(nativeDependency: unknown): number | undefined {
  if (!isObject(nativeDependency)) {
    return undefined;
  }
  const value = Reflect.get(nativeDependency, 'audioLoadMode') as unknown;
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number') {
    throw new Error('Cocos audioLoadMode must be numeric when provided.');
  }
  return value;
}

function extractDependencyBindings(
  details: cc.Details,
): readonly DependencyBinding[] {
  const uuidList = details.uuidList as unknown;
  const ownerList = details.uuidObjList as unknown;
  const propertyList = details.uuidPropList as unknown;
  const expectedTypeList = details.uuidTypeList as unknown;

  if (
    !Array.isArray(uuidList)
    || !Array.isArray(ownerList)
    || !Array.isArray(propertyList)
    || !Array.isArray(expectedTypeList)
  ) {
    throw new Error(
      'Cocos Details did not expose dependency slots after deserialization.',
    );
  }

  if (
    ownerList.length !== uuidList.length
    || propertyList.length !== uuidList.length
    || expectedTypeList.length > uuidList.length
  ) {
    throw new Error(
      'Cocos Details returned dependency-slot arrays with incompatible lengths.',
    );
  }

  return uuidList.map((compressedUuid: unknown, index: number) => {
    if (typeof compressedUuid !== 'string') {
      throw new Error(
        `Cocos dependency slot ${index} has a non-string UUID.`,
      );
    }

    const owner = ownerList[index] as unknown;
    if (!isObject(owner)) {
      throw new Error(
        `Cocos dependency slot ${index} has a non-object owner.`,
      );
    }

    const property = propertyList[index] as unknown;
    if (typeof property !== 'string' && typeof property !== 'number') {
      throw new Error(
        `Cocos dependency slot ${index} has an invalid property key.`,
      );
    }

    const expectedTypeId = expectedTypeList[index] as unknown;
    if (
      expectedTypeId !== undefined
      && typeof expectedTypeId !== 'string'
    ) {
      throw new Error(
        `Cocos dependency slot ${index} has a non-string expected type.`,
      );
    }

    return {
      cocosUuid: decodeCocosUuid(compressedUuid),
      owner,
      property: String(property),
      expectedType: expectedTypeId === '' || expectedTypeId === undefined
        ? undefined
        : resolveCocosAssetType(expectedTypeId),
    };
  });
}

function resolveCocosAssetType(
  runtimeTypeId: string,
): AssetType<CycloAsset> {
  const assetType = cc.js.getClassById(runtimeTypeId) as unknown;
  if (typeof assetType !== 'function') {
    throw new Error(
      `Cocos asset type "${runtimeTypeId}" is not registered.`,
    );
  }

  const prototype = Reflect.get(assetType, 'prototype') as unknown;
  if (
    !isObject(prototype)
    || (
      prototype !== cc.Asset.prototype
      && !(prototype instanceof cc.Asset)
    )
  ) {
    throw new Error(
      `Cocos class "${runtimeTypeId}" is not a cc.Asset type.`,
    );
  }

  return assetType;
}

function assertSupportedCconHeader(bytes: Uint8Array): void {
  if (bytes.byteLength < CCON_HEADER_BYTE_LENGTH) {
    throw new Error('The CCONB artifact is shorter than its header.');
  }

  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const magic = view.getUint32(0, true);
  if (magic !== CCON_MAGIC) {
    throw new Error('The CCONB artifact has invalid magic bytes.');
  }

  const version = view.getUint32(4, true);
  if (!SUPPORTED_CCON_VERSIONS.has(version)) {
    throw new Error(
      `Unsupported CCONB version ${version}; only versions 1 and 2 are supported.`,
    );
  }

  const declaredByteLength = view.getUint32(8, true);
  if (declaredByteLength !== bytes.byteLength) {
    throw new Error(
      'The CCONB artifact length does not match its header.',
    );
  }
}

function decodeCocosUuid(compressedUuidWithSuffix: string): string {
  const separatorIndex = compressedUuidWithSuffix.indexOf('@');
  const compressedUuid = separatorIndex === -1
    ? compressedUuidWithSuffix
    : compressedUuidWithSuffix.slice(0, separatorIndex);

  if (compressedUuid.length !== COMPRESSED_UUID_LENGTH) {
    return compressedUuidWithSuffix;
  }

  const decodedCharacters = new Array<string>(36);
  const separators = new Set([8, 13, 18, 23]);
  for (let index = 0; index < decodedCharacters.length; index += 1) {
    decodedCharacters[index] = separators.has(index) ? '-' : '';
  }

  decodedCharacters[0] = compressedUuid[0];
  decodedCharacters[1] = compressedUuid[1];

  const writableIndices: number[] = [];
  for (let index = 0; index < decodedCharacters.length; index += 1) {
    if (!separators.has(index)) {
      writableIndices.push(index);
    }
  }

  let targetIndex = 2;
  for (let sourceIndex = 2; sourceIndex < compressedUuid.length; sourceIndex += 2) {
    const left = BASE64_ALPHABET.indexOf(compressedUuid[sourceIndex]);
    const right = BASE64_ALPHABET.indexOf(compressedUuid[sourceIndex + 1]);
    if (left === -1 || right === -1) {
      throw new Error(
        `Cocos dependency UUID "${compressedUuidWithSuffix}" is not valid base64-compressed UUID data.`,
      );
    }

    decodedCharacters[writableIndices[targetIndex]]
      = HEX_ALPHABET[left >> 2];
    targetIndex += 1;
    decodedCharacters[writableIndices[targetIndex]]
      = HEX_ALPHABET[((left & 3) << 2) | (right >> 4)];
    targetIndex += 1;
    decodedCharacters[writableIndices[targetIndex]]
      = HEX_ALPHABET[right & 0xF];
    targetIndex += 1;
  }

  const suffix = separatorIndex === -1
    ? ''
    : compressedUuidWithSuffix.slice(separatorIndex);
  return decodedCharacters.join('') + suffix;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
