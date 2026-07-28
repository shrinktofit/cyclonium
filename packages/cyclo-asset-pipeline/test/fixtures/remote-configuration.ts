import type {
  ArtifactSource,
  AssetRuntimeConfiguration,
  RemoteAssetLoader,
} from '@/core/contracts.js';
import type { AssetCatalog } from '@/core/model.js';
import { AssetIntegrityPolicy } from '@/core/public.js';
import { sha256 } from '@/sha256/index.js';

const EMPTY_CATALOG: AssetCatalog = {
  revision: 'remote-test',
  keys: new Map(),
  cocosUuids: new Map(),
  records: new Map(),
};

export function createRemoteTestConfiguration(
  remoteAssetLoader: RemoteAssetLoader,
  sources: readonly ArtifactSource[] = [],
  artifactCacheByteBudget = 0,
): AssetRuntimeConfiguration {
  return {
    catalog: EMPTY_CATALOG,
    sources,
    decoders: [],
    finalizer: {
      finalize: (decoded) => Promise.resolve(decoded.asset),
    },
    remoteAssetLoader,
    sha256,
    integrityPolicy: AssetIntegrityPolicy.whenPresent,
    artifactCacheByteBudget,
  };
}
