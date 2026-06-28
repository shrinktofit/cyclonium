import * as polyfill from 'abort-controller/dist/abort-controller.mjs';

const {
  AbortSignal: AbortSignal_,
  AbortController: AbortController_,
} = typeof AbortController === 'undefined'
  ? polyfill
  : {
    AbortSignal: AbortController,
    AbortController: AbortController,
  };

export { AbortSignal_ as AbortSignal, AbortController_ as AbortController };
