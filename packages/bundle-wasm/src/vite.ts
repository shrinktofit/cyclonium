import { core } from './core.js';
import type * as vite from 'vite';

export default function bundleWasm(...args: Parameters<typeof core>): vite.Plugin {
  return core(...args);
}
