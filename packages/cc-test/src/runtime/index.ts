import { internalInjections } from 'virtual:cyclo-cc-test/internal-injections';
import { internalShared } from './internal-shared.js';

export { setupGame } from './setup-game.js';

export const baseURL = internalInjections.baseURL;

export function getCanvas(): HTMLCanvasElement | undefined {
  return internalShared.canvas;
}
