/* eslint-disable n/no-unpublished-import -- OMS rewrites this declared project peer before the extension runtime executes. */
import {
  cycloClass,
  designType,
  editable,
  stored,
} from '#oms-peer:@cyclonium/core/legacy-decorator/general';
/* eslint-enable n/no-unpublished-import */
import { Asset, CCString } from 'cc';
import {
  ASSET_GROUP_ANCHOR_CLASS_NAME,
  ASSET_GROUP_CLASS_NAME,
  ASSET_GROUP_ENTRY_CLASS_NAME,
  ASSET_PIPELINE_SETTINGS_CLASS_NAME,
} from './authoring-class-names.js';

export const UNIVERSAL_ASSET_CLASS_MARKER = Symbol.for('cc.universal-assets');

interface UniversalAssetClassMarker {
  readonly createInfo: {
    readonly menu: readonly never[];
  };
}

function universalAssetClassMarker(): UniversalAssetClassMarker {
  return {
    createInfo: {
      menu: [],
    },
  };
}

@cycloClass(ASSET_GROUP_ENTRY_CLASS_NAME)
export class AssetGroupEntry {
  @stored
  id = '';

  @stored
  kind = '';

  @stored
  assetUuid = '';

  @stored
  assetUrl = '';

  @stored
  address = '';

  @stored
  @designType([CCString])
  labels: string[] = [];
}

@cycloClass(ASSET_GROUP_CLASS_NAME)
export class AssetGroupAsset extends Asset {
  static [UNIVERSAL_ASSET_CLASS_MARKER](): UniversalAssetClassMarker {
    return universalAssetClassMarker();
  }

  @stored
  schemaVersion = 1;

  @stored
  id = '';

  @stored
  @editable
  groupName = '';

  @stored
  @editable
  includeInBuild = true;

  @stored
  @editable
  includeAddressInCatalog = true;

  @stored
  @editable
  includeGuidsInCatalog = false;

  @stored
  @editable
  includeLabelsInCatalog = true;

  @stored
  @editable({ readonly: true })
  delivery = 'local';

  @stored
  @designType([AssetGroupEntry])
  entries: AssetGroupEntry[] = [];
}

@cycloClass(ASSET_GROUP_ANCHOR_CLASS_NAME)
export class AssetGroupAnchorAsset extends Asset {
  static [UNIVERSAL_ASSET_CLASS_MARKER](): UniversalAssetClassMarker {
    return universalAssetClassMarker();
  }

  @stored
  @designType([Asset])
  rootAssets: Asset[] = [];
}

@cycloClass(ASSET_PIPELINE_SETTINGS_CLASS_NAME)
export class AssetPipelineSettingsAsset extends Asset {
  static [UNIVERSAL_ASSET_CLASS_MARKER](): UniversalAssetClassMarker {
    return universalAssetClassMarker();
  }

  @stored
  schemaVersion = 1;

  @stored
  @designType([CCString])
  groupOrder: string[] = [];

  @stored
  @designType([CCString])
  labels: string[] = [];

  @stored
  selectedBuildTaskId = '';
}
