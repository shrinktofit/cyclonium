import { director } from 'cc';

export const logger = {
  verbose: wrapLogMethod(console.debug.bind(console)),
  info: wrapLogMethod(console.log.bind(console)),
  warn: wrapLogMethod(console.warn.bind(console)),
  error: wrapLogMethod(console.error.bind(console)),
};

function wrapLogMethod(method: (...args: unknown[]) => unknown): (...args: unknown[]) => unknown {
  return (...args) => {
    const prefix = `[${director.getTotalFrames()}]`;
    if (typeof args[0] === 'string') {
      return method(`${prefix}${args[0]}`, ...args.slice(1));
    } else {
      return method(prefix, ...args);
    }
  };
}
