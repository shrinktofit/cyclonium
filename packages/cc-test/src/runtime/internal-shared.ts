import type { IGameConfig } from 'cc';

export type SettingsJSON = NonNullable<IGameConfig['overrideSettings']>;

export interface CanvasOptions {
  id?: string;
  devicePixelRatio?: number;
  size?: {
    width?: number;
    height?: number;
  };
}

export type StandaloneConfigureValue = string | boolean | number;
export type StandaloneConfigure = Record<string, StandaloneConfigureValue>;

interface InternalSharedState {
  canvas: HTMLCanvasElement | undefined;
  configureCanvas: ((opts?: CanvasOptions) => void) | undefined;
  standaloneConfigure: StandaloneConfigure;
  standaloneConfigureCalled: boolean;
  standaloneConfigureLocked: boolean;
  settingsJSON: SettingsJSON;
  cc: undefined | typeof import('cc');
}

interface InternalSharedGlobal {
  [key: symbol]: InternalSharedState | undefined;
}

const internalSharedKey = Symbol.for('@cyclonium/cc-test/runtime/internal-shared');
const internalSharedGlobal = globalThis as typeof globalThis & InternalSharedGlobal;

export const internalShared = internalSharedGlobal[internalSharedKey] ??= {
  canvas: undefined,
  configureCanvas: undefined,
  standaloneConfigure: {},
  standaloneConfigureCalled: false,
  standaloneConfigureLocked: false,
  settingsJSON: {},
  cc: undefined as undefined | typeof import('cc'),
};
