import { HTML5, MINIGAME } from 'cc/env';
import * as web from './web.js';
import * as minigame from './minigame.js';
import type {
  Headers,
  HeadersInit,
  HeadersIterator,
  RequestInit,
  Response,
} from './common.js';

export type {
  RequestInit,
  Headers,
  HeadersInit,
  HeadersIterator,
};

const implementation: {
  fetch(url: string, init: RequestInit): Promise<Response>;
} = (() => {
  if (HTML5) {
    return web;
  } else if (MINIGAME) {
    return minigame;
  } else {
    return {
      fetch: undefined!,
    };
  }
})();

export function fetch(url: string, init: RequestInit): Promise<Response> {
  return implementation.fetch(url, init);
}
