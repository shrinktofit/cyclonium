import type { IProperty } from '@cocos/creator-types/editor/packages/scene/@types/public.js';

// @ts-expect-error -- Cocos exposes cce as an editor-scene runtime global without a public declaration.
cce.exports.Dump.registerDumpHandler('cyclo._Raw', {
  encode: (object: { data: unknown }, data: IProperty, _opts?: unknown) => {
    data.value = JSON.parse(JSON.stringify(object.data));
  },

  decode: (data: Record<PropertyKey, unknown>, info: { key: PropertyKey }, dump: IProperty, _opts?: unknown) => {
    data[info.key] = dump.value;
  },
});
