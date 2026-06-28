/// <reference types="minigame-api-typings" />

import type * as def from './common.js';

const encodingUTF8 = 'utf-8';

export class TextDecoder implements def.TextDecoder {
  constructor(label = encodingUTF8) {
    const encoding = getEncoding(label);
    this._encoding = encoding;
  }

  get encoding(): string {
    return this._encoding;
  }

  decode(input?: AllowSharedBufferSource): string {
    if (!input) {
      return '';
    }
    if (input instanceof SharedArrayBuffer) {
      throw new TypeError('SharedArrayBuffer is not supported.');
    }
    return wx.decode({
      format: this._encoding,
      data: input instanceof ArrayBuffer
        ? input
        : input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer,
    });
  }

  private _encoding: Encoding;
}

export class TextEncoder implements def.TextEncoder {
  get encoding(): string {
    return encodingUTF8;
  }

  encode(input: string): Uint8Array {
    const arrayBuffer = wx.encode({
      format: encodingUTF8,
      data: input,
    });
    return new Uint8Array(arrayBuffer);
  }
}

type Encoding = ReturnType<typeof getEncoding>;

function getEncoding(label: string) {
  switch (label.trim().toLowerCase()) {
  case encodingUTF8:
  case 'utf8':
    return encodingUTF8 as typeof encodingUTF8;
  default:
    throw new RangeError(`Unsupported encoding: ${label}`);
  }
}
