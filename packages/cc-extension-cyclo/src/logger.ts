import { dirname, join } from 'node:path';
import winston from 'winston';
import Transport from 'winston-transport';
import { ensureDirSync } from 'fs-extra';
import { selfExtensionName, selfPackageJson } from './self-info.js';

const printf = (withEntry: boolean) => winston.format.printf(({ level, message, timestamp }) => {
  let output = '';
  if (typeof timestamp === 'string') {
    output += `${timestamp} `;
  }
  if (withEntry) {
    output += `[@<where?>] `;
  }
  output += `${String(level)}: ${String(message)}`;
  return output;
});

const logFile = join(Editor.Project.tmpDir, 'logs', `${selfExtensionName}-${selfPackageJson.version}.log`);
ensureDirSync(dirname(logFile));

class EditorTransport extends Transport {
  override log(info: { level: string; message: unknown }, next: () => void) {
    logToConsole(info.level, `[${selfExtensionName}] ${String(info.message)}`);
    next();
  }
}

function logToConsole(level: string, message: string): void {
  switch (level) {
  case 'error':
    console.error(message);
    break;
  case 'warn':
    console.warn(message);
    break;
  case 'debug':
    console.debug(message);
    break;
  default:
    console.info(message);
    break;
  }
}

export const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.splat(),
  ),
  transports: [
    new EditorTransport({
      level: 'info',
      format: winston.format.combine(
        printf(false),
      ),
    }),
    new winston.transports.File({
      level: 'debug',
      filename: logFile,
      // options: { flags: 'w' },
      format: winston.format.combine(
        winston.format.timestamp(),
        printf(true),
      ),
    }),
  ],
});
