import { logger } from './logger.js';
import { selfExtensionName } from './self-info.js';

export const methods = {};

export function load(): void {
  logger.debug(`${selfExtensionName} loaded`);
}

export function unload() {
  logger.debug(`${selfExtensionName} unloaded`);
}
