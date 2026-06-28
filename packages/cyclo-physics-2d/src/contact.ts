import { Vec2 } from '@cyclonium/core/math/vec2';

export interface Contact2DInfo {
  manifold: {
    points: Vec2[];
  };
}
