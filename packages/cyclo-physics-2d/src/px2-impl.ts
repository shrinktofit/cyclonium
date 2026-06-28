import * as px2Impl from '@cyclonium/rapier2d';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
export { px2Impl };

export const initializePx2Impl = (() => {
  let promise: Promise<void> | null = null;
  return async () => {
    if (!promise) {
      promise = (async () => {
        await px2Impl.__init__();
      })();
    }
    await promise;
  };
})();

if (!EDITOR_NOT_IN_PREVIEW) {
  await initializePx2Impl().catch(console.error.bind(console));
}
