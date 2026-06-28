import { Vec2 } from './vec2.ts';
import { Ray2D } from './ray.ts';

export function raycastLineSegment2D(
  ray: Ray2D,
  p0: Vec2,
  p1: Vec2,
): number | undefined {
  const v1 = ray.origin.sub(p0);
  const v2 = p1.sub(p0);
  const v3 = new Vec2(-ray.direction.y, ray.direction.x);

  const dot = Vec2.dot(v2, v3);
  // Ray is parallel to line segment.
  if (Math.abs(dot) < 1e-6) {
    return undefined;
  }

  const t1 = Vec2.cross(v2, v1) / dot;
  const t2 = Vec2.dot(v1, v3) / dot;

  if (t1 >= 0.0 && (t2 >= 0.0 && t2 <= 1.0)) {
    return t1;
  }

  return undefined;
}
