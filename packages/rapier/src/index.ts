export * from '@dimforge/rapier2d';

import * as wbg from '@dimforge/rapier2d/rapier_wasm2d_bg.js';

let initPromise: Promise<void> | undefined;

declare const WXWebAssembly: unknown;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export async function __init__(opts?: {}) {
  void opts;
  if (!initPromise) {
    initPromise = (async () => {
      const imports = {
        './rapier_wasm2d_bg.js': wbg,
      };
      let wasmModuleInstance: WebAssembly.Instance;
      // eslint-disable-next-line unicorn/no-typeof-undefined
      if (typeof WebAssembly === 'object' && WebAssembly && typeof WXWebAssembly === 'undefined') {
        const { default: wasmBinary } = await import('./rapier_wasm2d_bg.wasm?wasm-binary');
        const wasmModule = await WebAssembly.compile(wasmBinary);
        wasmModuleInstance = await WebAssembly.instantiate(wasmModule, imports);
      } else {
        throw new Error('rapier2d is not supported in current environment');
      }
      wbg.__wbg_set_wasm(wasmModuleInstance.exports);
    })();
  }
  await initPromise;
}
