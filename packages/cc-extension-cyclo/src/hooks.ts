import { assetHandlers } from './contributions/asset-db/asset-handlers.js';
import { logger } from './logger.js';
import { inspectorContribution } from './contributions/inspector/contribution.js';
import { mergeContributions, type ExtensionContributions } from '@cyclonium/cc-extension-utils/extension';
import assetDBContributionScript from './contributions/asset-db/register.js?contribution-script';
import sceneContributionScript from './contributions/scene/contribution.js?contribution-script';

export async function register(info: {
  contributions: ExtensionContributions;
}) {
  const contributions = await getContributions();
  mergeContributions(info.contributions ??= {}, contributions);
  logger.debug(`registered contributions: ${JSON.stringify(contributions, undefined, 2)}`);
}

async function getContributions(): Promise<ExtensionContributions> {
  return {
    'asset-db': {
      'script': assetDBContributionScript,
      'asset-handler': assetHandlers.map(({ register: handler, name, extnames }) => ({
        handler,
        name,
        extnames,
      })),
      'mount': {
        path: 'mount/assets',
      },
    },
    'inspector': inspectorContribution,
    'scene': {
      script: sceneContributionScript,
    },
  };
}
