import { internalInjections } from 'virtual:cyclo-cc-test/internal-injections';
import { internalShared, type SettingsJSON } from '../runtime/internal-shared.js';
import { postInit as sharedPostInit, type PostInitOptions } from '../shared/post-init.js';

export type { PostInitOptions } from '../shared/post-init.js';

export async function postInit(opts: PostInitOptions): Promise<void> {
  internalShared.settingsJSON = await fetchSettingsJSON(internalInjections.baseURL);
  await sharedPostInit(opts);
}

async function fetchSettingsJSON(baseURL: string): Promise<SettingsJSON> {
  const settingsUrl = new URL('settings.js?scene=current_scene', baseURL);
  const response = await fetch(settingsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch editor preview settings: ${settingsUrl.href}`);
  }
  return evaluateSettingsScript(await response.text());
}

function evaluateSettingsScript(script: string): SettingsJSON {
  const window = {} as {
    _CCSettings?: unknown;
  };
  // Cocos preview returns JS like `window._CCSettings = {...}`, not a JSON response.
  new Function('window', script)(window);

  if (!window._CCSettings || typeof window._CCSettings !== 'object') {
    throw new Error(`Invalid editor preview settings script.`);
  }

  return window._CCSettings as SettingsJSON;
}
