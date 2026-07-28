export {
  ASSET_GROUP_ANCHOR_CLASS_NAME,
  ASSET_GROUP_CLASS_NAME,
  ASSET_GROUP_ENTRY_CLASS_NAME,
  ASSET_PIPELINE_SETTINGS_CLASS_NAME,
} from '../../../exports/src/runtime/authoring-class-names.js';

export interface UniversalAssetDocument {
  readonly __type__: string;
  readonly [key: string]: unknown;
}

export function serializeUniversalAsset(document: UniversalAssetDocument): string {
  return `${JSON.stringify([document], undefined, 2)}\n`;
}

export function parseUniversalAssetDocument(
  source: string,
  expectedType: string,
  file: string,
): UniversalAssetDocument {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(`Failed to parse Cyclo UniversalAsset: ${file}`, { cause: error });
  }
  const root = Array.isArray(value) ? value[0] : value;
  if (!isRecord(root) || root.__type__ !== expectedType) {
    throw new Error(`Cyclo UniversalAsset ${file} must have type ${expectedType}`);
  }
  return root as UniversalAssetDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
