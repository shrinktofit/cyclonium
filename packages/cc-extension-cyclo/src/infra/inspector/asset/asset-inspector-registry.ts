import type { Component } from 'vue';
import type { AssetInspectorData } from './data.js';
import DefaultAssetInspector from './default-asset-inspector.vue';
import DumpBasedAssetInspector from './dump-based-asset-inspector.vue';

const assetInspectorRegistry = new Map<string, Component<{ inspectorData: AssetInspectorData }>>();

function registerAssetInspectorComponent(assetType: string, component: Component<{ inspectorData: AssetInspectorData }>) {
  assetInspectorRegistry.set(assetType, component);
}

export function getAssetInspectorComponent(inspectorData: AssetInspectorData) {
  if (inspectorData.asset.importer) {
    const byType = assetInspectorRegistry.get(inspectorData.asset.importer);
    if (byType) {
      return byType;
    }
  }
  return DefaultAssetInspector;
}

registerAssetInspectorComponent('cyclo-physics-2d-settings', DumpBasedAssetInspector);
