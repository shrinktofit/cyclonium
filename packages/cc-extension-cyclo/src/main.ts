import { logger } from './logger.js';
import { selfExtensionName } from './self-info.js';

export default function () {
  logger.debug(`${selfExtensionName} loaded`);
  return {
    dispose() {
      logger.debug(`${selfExtensionName} unloaded`);
    },
  };
}
