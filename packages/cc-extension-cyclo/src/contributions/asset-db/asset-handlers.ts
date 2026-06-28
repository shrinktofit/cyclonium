import type { AssetHandler } from '@cocos/creator-types/editor/packages/asset-db/@types/protected.js';

const assetHandlerRegistry: Array<{
  handlerType: () => Promise<AssetHandler>;
  name: string;
  extnames: string[];
}> = [
  {
    name: 'cyclo-physics-2d-settings',
    extnames: ['.cyclo-px2-settings'],
    handlerType: async () => {
      return (await import('../../features/physics-2d/physics-2d-settings/asset-handler.js')).default;
    },
  },
];

export const assetHandlers: Array<{
  register: string;
  handlerType: () => Promise<AssetHandler>;
  name: string;
  extnames: string[];
}> = assetHandlerRegistry.map((handlerInfo) => {
  return {
    register: `register_${handlerInfo.name}`,
    handlerType: handlerInfo.handlerType,
    name: handlerInfo.name,
    extnames: handlerInfo.extnames,
  };
});
