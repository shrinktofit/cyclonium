export interface InspectorAsset {
  displayName: string;
  extends: string[];
  file: string;
  imported: boolean;
  importer: string;
  invalid: boolean;
  isDirectory: boolean;
  library: Record<string, string>;
  name: string;
  path: string;
  readonly: boolean;
  source: string;
  subAssets: InspectorAsset[];
  type: string;
  url: string;
  uuid: string;
  visible: boolean;
}

export interface InspectorMeta {
  displayName: string;
  files: string[];
  id: string;
  imported: boolean;
  importer: string;
  name: string;
  subMetas: Record<string, InspectorMeta>;
  userData: Record<string, unknown>;
  uuid: string;
  ver: string;
}

export interface AssetInspectorData {
  asset: InspectorAsset;
  meta: InspectorMeta;
}
