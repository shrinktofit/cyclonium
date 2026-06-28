import { assetHandlers } from './asset-handlers.js';

export const methods = {
  ...Object.fromEntries(assetHandlers.map((handlerInfo) => {
    return [
      handlerInfo.register,
      async () => {
        return handlerInfo.handlerType();
      },
    ];
  })),
};
