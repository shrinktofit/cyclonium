import { wasmBinaryId } from './wasm-binary-id.js';
// @ts-expect-error node specific
import { join, dirname } from 'node:path';
// @ts-expect-error node specific
import { fileURLToPath } from 'node:url';

export default {
  source: (() => {
    const rapier2dModule = fileURLToPath(import.meta.resolve('@cyclonium/rapier2d'));
    const rapier2dPkg = dirname(rapier2dModule);
    return join(rapier2dPkg, 'rapier_wasm2d_bg.wasm');
  })(),

  target: wasmBinaryId,
};
