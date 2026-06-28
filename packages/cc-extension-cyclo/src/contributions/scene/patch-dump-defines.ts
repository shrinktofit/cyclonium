import type { IProperty } from '@cocos/creator-types/editor/packages/scene/@types/public.js';

// @ts-expect-error
cce.exports.Dump.registerDumpHandler('cyclo._Raw', {
  encode: (object: unknown, data: IProperty, opts?: unknown) => {
    data.value = JSON.parse(JSON.stringify(object.data));
  },

  decode: (data: unknown, info: any, dump: IProperty, opts?: unknown) => {
    // @ts-expect-error
    data[info.key] = dump.value;
  },
});
