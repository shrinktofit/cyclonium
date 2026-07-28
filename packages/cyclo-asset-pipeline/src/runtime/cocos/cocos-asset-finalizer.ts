import type { AbortSignal } from '@cyclonium/abort-controller';

import type { AssetFinalizer } from '../../core/contracts.js';
import type {
  DecodedAsset,
} from '../../core/model.js';
import type {
  CycloAsset,
} from '../../core/public.js';

export class CocosAssetFinalizer implements AssetFinalizer {
  finalize(
    decoded: DecodedAsset,
    signal: AbortSignal,
  ): Promise<CycloAsset> {
    if (signal.aborted) {
      throw new Error('Cocos asset finalization was aborted.');
    }

    if (this.#finalizedAssets.has(decoded.asset)) {
      throw new Error(
        `Cocos asset "${decoded.asset._uuid}" was finalized more than once.`,
      );
    }

    decoded.asset.onLoaded();
    this.#finalizedAssets.add(decoded.asset);
    return Promise.resolve(decoded.asset);
  }

  readonly #finalizedAssets = new WeakSet<CycloAsset>();
}
