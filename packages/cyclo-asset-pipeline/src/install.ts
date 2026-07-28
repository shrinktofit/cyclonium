import {
  installAssetPipelineInstance,
  type AssetPipeline,
} from './asset-pipeline.js';
import { createDefaultRuntimeConfiguration } from './composition.js';
import type { AssetRuntimeConfiguration } from './core/contracts.js';
import type { AssetPipelineInstallOptions } from './core/public.js';
import { assetPipeline } from './global.js';

/**
 * Installs the single process-wide asset pipeline instance.
 *
 * Repeated calls are idempotent. An installed pipeline cannot be replaced or
 * uninstalled for the lifetime of the runtime.
 */
export function installAssetPipeline(
  options?: AssetPipelineInstallOptions,
): Promise<AssetPipeline> {
  return installAssetPipelineInstance(
    assetPipeline,
    options,
    createDefaultRuntimeConfiguration,
  );
}

export function installAssetPipelineWithConfiguration(
  configuration: AssetRuntimeConfiguration,
): Promise<AssetPipeline> {
  return installAssetPipelineInstance(
    assetPipeline,
    {
      artifactCacheByteBudget: configuration.artifactCacheByteBudget,
      integrityPolicy: configuration.integrityPolicy,
      onIntegrityDiagnostic: configuration.onIntegrityDiagnostic,
    },
    () => configuration,
  );
}
