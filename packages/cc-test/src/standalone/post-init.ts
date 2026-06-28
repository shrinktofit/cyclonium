import { postInit as sharedPostInit, type PostInitOptions } from '../shared/post-init.js';

interface GameConstructorWithLoadCCEScripts {
  prototype: {
    _loadCCEScripts?: () => Promise<void>;
  };
}

export async function postInit(opts: PostInitOptions): Promise<void> {
  const gameConstructor = opts.cc.game.constructor as GameConstructorWithLoadCCEScripts;
  gameConstructor.prototype._loadCCEScripts = async () => {};

  await sharedPostInit(opts);
}
