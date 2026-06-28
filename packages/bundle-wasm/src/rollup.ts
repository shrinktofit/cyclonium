import { core } from './core.js';
import type * as rollup from 'rollup';

export default function bundleWasm(...args: Parameters<typeof core>): rollup.Plugin {
  return core(...args);
}
