import { logger } from './logger.js';
import { selfExtensionName } from './self-info.js';

export const methods = {};

export async function load() {
  logger.debug(`${selfExtensionName} loaded`);
}

export function unload() {
  logger.debug(`${selfExtensionName} unloaded`);
}
