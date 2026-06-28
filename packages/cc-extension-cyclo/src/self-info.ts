import { resolve } from 'node:path';

export const selfPackageJson: {
  name: string;
  version: string;
  extensionName?: string;
} = require(resolve(__dirname, '..', 'package.json'));

export const selfPackageName = selfPackageJson.name;

export const selfExtensionName = selfPackageJson.extensionName ?? selfPackageName;

export const selfPackagePath = resolve(__dirname, '..');
