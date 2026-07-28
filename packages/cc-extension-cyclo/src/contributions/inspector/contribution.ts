import type { ExtensionContributions } from '@cyclonium/cc-extension-utils/extension';
import cycloPhysics2DSettingsInspectorContributionScript from '../../infra/inspector/asset-inspector-index.vue?contribution-script';

export function createInspectorContribution(
  toExtensionRelativePath: (path: string) => string,
): ExtensionContributions['inspector'] {
  return {
    section: {
      asset: {
        'cyclo-physics-2d-settings': toExtensionRelativePath(
          cycloPhysics2DSettingsInspectorContributionScript,
        ),
      },
    },
  };
}
