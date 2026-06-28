export interface TextDecoderCommon {
  readonly encoding: string;
}

export interface TextDecoder extends TextDecoderCommon {
  decode(input?: AllowSharedBufferSource): string;
}

export interface TextEncoderCommon {
  readonly encoding: string;
}

export interface TextEncoder extends TextEncoderCommon {
  encode(input?: string): Uint8Array;
}
