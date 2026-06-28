import { internalShared, type StandaloneConfigure } from './internal-shared.js';

export function configure(opts: StandaloneConfigure): void {
  if (internalShared.standaloneConfigureLocked || internalShared.cc !== undefined) {
    throw new Error(`Can not configure standalone Cocos constants after module 'cc' or 'cc/env' is initialized.`);
  }
  internalShared.standaloneConfigureCalled = true;
  internalShared.standaloneConfigure = {
    ...internalShared.standaloneConfigure,
    ...opts,
  };
}

export function resolveStandaloneConfigure(defaultConfigure: StandaloneConfigure = {}): StandaloneConfigure {
  internalShared.standaloneConfigureLocked = true;
  return {
    ...defaultConfigure,
    ...internalShared.standaloneConfigure,
  };
}
