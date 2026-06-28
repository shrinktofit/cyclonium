import { BYTEDANCE, WECHAT } from 'cc/env';
import * as wx from './wx.js';
import * as tt from './tt.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare namespace Spec {
  export namespace MinigameWebAssembly {
    export function instantiate(path: string, imports?: WebAssembly.Imports): Promise<WebAssembly.Module>;
  }
}

const {
  MinigameWebAssembly,
}: typeof Spec = (() => {
  if (WECHAT) {
    return wx as unknown as typeof Spec;
  } else if (BYTEDANCE) {
    return tt;
  } else {
    return {
      MinigameWebAssembly: undefined!,
    };
  }
})();

export { MinigameWebAssembly };
