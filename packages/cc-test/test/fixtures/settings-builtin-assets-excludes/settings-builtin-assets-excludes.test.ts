import { setupGame } from '@cyclonium/cc-test/runtime';
import * as cc from 'cc';
import { expect, it } from 'vitest';

const DEFAULT_BUILTIN_ASSET = {
  uuid: 'a3cd009f-0ab0-420d-9278-b9fdab939bbc',
  key: 'builtin-unlit',
};

const EXCLUDED_EXTRA_BUILTIN_ASSET = {
  uuid: 'efe8e2a3-eace-427b-b4f1-cb8a937ec77d',
  key: 'ui-sprite-gray-material',
};

const INCLUDED_EXTRA_BUILTIN_ASSET = {
  uuid: '60f7195c-ec2a-45eb-ba94-8955f60e81d0',
  key: 'for2d/builtin-sprite',
};

const INCLUDED_EXTRA_MATERIAL_BUILTIN_ASSET = {
  uuid: 'e9aa9a3e-5b2b-4ac7-a2c7-073de2b2b24f',
  key: 'ui-base-material',
};

it('should load selected editor preview builtin assets after excludes are removed', async () => {
  await setupGame({
    builtinAssets: {
      includes: [
        EXCLUDED_EXTRA_BUILTIN_ASSET.uuid,
        INCLUDED_EXTRA_BUILTIN_ASSET.uuid,
        INCLUDED_EXTRA_MATERIAL_BUILTIN_ASSET.uuid,
      ],
      excludes: [
        DEFAULT_BUILTIN_ASSET.uuid,
        EXCLUDED_EXTRA_BUILTIN_ASSET.uuid,
      ],
    },
  });

  expect(cc.builtinResMgr.get(DEFAULT_BUILTIN_ASSET.key)).toBeDefined();
  expect(cc.builtinResMgr.get(EXCLUDED_EXTRA_BUILTIN_ASSET.key)).toBeUndefined();
  expect(cc.builtinResMgr.get(INCLUDED_EXTRA_BUILTIN_ASSET.key)).toBeDefined();
  expect(cc.builtinResMgr.get(INCLUDED_EXTRA_MATERIAL_BUILTIN_ASSET.key)).toBeDefined();
});
