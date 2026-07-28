import {
  ArtifactKind,
  type Artifact,
  type PlatformFileArtifact,
} from '../../../core/model.js';

export function requirePlatformFileArtifact(
  artifact: Artifact,
): PlatformFileArtifact {
  if (artifact.kind !== ArtifactKind.platformFile) {
    throw new Error('Mini-game media requires a platform file artifact.');
  }
  return artifact;
}
