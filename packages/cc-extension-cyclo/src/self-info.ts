import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

export const selfPackageJson: {
  name: string;
  version: string;
  extensionName?: string;
} = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  extensionName?: string;
};

export const selfPackageName = selfPackageJson.name;

export const selfExtensionName = selfPackageJson.extensionName ?? selfPackageName;

export const selfPackagePath = resolve(__dirname, '..');
