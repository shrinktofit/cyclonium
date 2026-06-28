/// <reference types="minigame-api-typings" />

import { ALIPAY, BYTEDANCE, WECHAT } from 'cc/env';

export const minigameGlobal: typeof wx = (() => {
  if (WECHAT) {
    return wx;
  } else if (ALIPAY) {
    // @ts-expect-error
    return my;
  } else if (BYTEDANCE) {
    // @ts-expect-error
    return tt;
  } else {
    return undefined;
  }
})();
