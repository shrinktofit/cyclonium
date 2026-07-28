import type {
  ArtifactSource,
  Sha256,
} from '../../core/contracts.js';
import type { NativeArtifactDecoder } from './native-artifact-decoder.js';

export interface AssetPlatformService {
  readonly runtimeVariant: string;
  readonly artifactSource: ArtifactSource;
  readonly nativeArtifactDecoders: readonly NativeArtifactDecoder[];
  readonly sha256: Sha256;
}
