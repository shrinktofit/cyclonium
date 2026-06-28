export interface SystemJSImportMap {
  imports?: Record<string, string>;
}

const BUILTIN_PIPELINE_IMPORT_MAP_KEY_SUFFIX = '/editor/assets/default_renderpipeline/builtin-pipeline.ts';

export async function loadSystemJSImportMap(url: URL): Promise<SystemJSImportMap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load editor preview import map ${url.href}: ${response.status} ${response.statusText}`);
  }

  const importMap = await response.json() as unknown;
  if (!isSystemJSImportMap(importMap)) {
    throw new Error(`Invalid editor preview import map ${url.href}.`);
  }
  return importMap;
}

export function resolveBuiltinPipelineURL(importMap: SystemJSImportMap, importMapURL: URL): string {
  const entry = Object.entries(importMap.imports ?? {}).find(([key]) => {
    return normalizeImportMapKey(key).endsWith(BUILTIN_PIPELINE_IMPORT_MAP_KEY_SUFFIX);
  });

  if (!entry) {
    throw new Error(`Can not locate builtin pipeline module in editor preview import map. Expected an imports key ending with "${BUILTIN_PIPELINE_IMPORT_MAP_KEY_SUFFIX}".`);
  }
  return new URL(entry[1], importMapURL).href;
}

function normalizeImportMapKey(key: string): string {
  return key.replace(/\\/g, '/');
}

function isSystemJSImportMap(value: unknown): value is SystemJSImportMap {
  if (!isObject(value)) {
    return false;
  }
  if (!('imports' in value) || value.imports === undefined) {
    return true;
  }
  return isStringRecord(value.imports);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isObject(value)) {
    return false;
  }
  return Object.values(value).every((recordValue) => {
    return typeof recordValue === 'string';
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
