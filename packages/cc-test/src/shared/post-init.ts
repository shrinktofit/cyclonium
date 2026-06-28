import { internalShared } from '../runtime/internal-shared.js';

export interface PostInitOptions {
  cc: typeof import('cc');
  setupGame: boolean;
}

export async function postInit(opts: PostInitOptions) {
  if (internalShared.cc !== undefined) {
    throw new Error(`Can not initialize multiple instances of module 'cc'.`);
  }
  internalShared.cc = opts.cc;

  if (opts.setupGame) {
    const { setupGame } = await import('../runtime/setup-game.js');
    await setupGame();
  }
}
