import type { ExtensionContributions } from '@cyclonium/cc-extension-utils/extension';
import cycloPhysics2DSettingsInspectorContributionScript from '../../infra/inspector/asset-inspector-index.vue?contribution-script';

export const inspectorContribution = {
  section: {
    asset: {
      'cyclo-physics-2d-settings': cycloPhysics2DSettingsInspectorContributionScript,
    },
  },
} satisfies ExtensionContributions['inspector'];
