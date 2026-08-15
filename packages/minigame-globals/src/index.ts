/// <reference types="minigame-api-typings" />

import { ALIPAY, BYTEDANCE, WECHAT } from 'cc/env';

export const minigameGlobal: typeof wx = (() => {
  if (WECHAT) {
    return wx;
  } else if (ALIPAY) {
    // @ts-expect-error -- Alipay exposes its runtime global outside TypeScript's wx typings.
    return my;
  } else if (BYTEDANCE) {
    // @ts-expect-error -- ByteDance exposes its runtime global outside TypeScript's wx typings.
    return tt;
  } else {
    return undefined;
  }
})();
