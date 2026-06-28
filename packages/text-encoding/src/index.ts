import { HTML5, MINIGAME } from 'cc/env';
import * as web from './web.js';
import * as minigame from './minigame.js';
import type * as types from './common.js';

const {
  TextEncoder: TextEncoderValue,
  TextDecoder: TextDecoderValue,
}: {
  TextEncoder: {
    prototype: types.TextEncoder;
    new(): types.TextEncoder;
  };
  TextDecoder: {
    prototype: types.TextDecoder;
    new(label?: string): types.TextDecoder;
  };
} = (() => {
  if (HTML5) {
    return web;
  } else if (MINIGAME) {
    return minigame;
  } else {
    return {
      TextEncoder: undefined!,
      TextDecoder: undefined!,
    };
  }
})();

type TextEncoder = types.TextEncoder;
const TextEncoder = TextEncoderValue;
type TextDecoder = types.TextDecoder;
const TextDecoder = TextDecoderValue;

export { TextEncoder, TextDecoder };
