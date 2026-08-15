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
            'packages/*/vite.config.ts',
            'packages/*/vitest.config.ts',
            'packages/eslint/*.js',
            'packages/stf-eslint/*.js',
          ],
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
      '**/*.vue',
    ],
    rules: {
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },
]);
