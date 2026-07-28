// @ts-check

import { defineConfig, globalIgnores } from 'eslint/config';
import stf from '@shrinktofit/eslint-config';
import vue from '@shrinktofit/eslint-config/vue';
import node from '@shrinktofit/eslint-config/node';

export default defineConfig([
  {
    settings: {
      node: {
        version: '>=26.0.0',
      },
    },
  },
  globalIgnores([
    '**/built/',
    '**/dist/',
    '**/lib/',
  ]),
  stf.configs.recommended,
  stf.configs.conventions,
  vue.configs.recommended,
  node.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: [
            'env.d.ts',
            'eslint.config.js',
            'vitest.workspace.ts',
            'packages/bundle-wasm/static/*.ts',
            'packages/cc-extension-cyclo/*.cjs',
            'packages/cc-extension-cyclo/*.mjs',
            'packages/cc-extension-cyclo/test/fixtures/vortex-project/*.mjs',
            'packages/cc-extension-utils/types/vite-plugins/*.d.ts',
            'packages/cyclo-abort-controller/index.d.ts',
            'packages/rapier/@types/*.d.ts',
            'packages/*/vite.config.ts',
            'packages/*/vitest.config.ts',
            'packages/eslint/*.js',
            'packages/stf-eslint/*.js',
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 32,
        },
      },
    },
  },
  {
    rules: {
      'n/no-extraneous-import': 'off',
    },
  },
  {
    files: [
      'packages/cc-extension-cyclo/*.cjs',
    ],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
      },
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      '**/*.vue',
    ],
    rules: {
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
]);
