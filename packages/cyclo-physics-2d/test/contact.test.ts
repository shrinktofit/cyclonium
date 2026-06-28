import { describe, expect, it } from 'vitest';
import { Vec2 } from '@cyclonium/core/math/vec2';
import type { Contact2DInfo } from '@/contact.js';

describe('Contact2DInfo', () => {
  it('should have manifold with points', () => {
    const info: Contact2DInfo = {
      manifold: {
        points: [new Vec2(1, 2), new Vec2(3, 4)],
      },
    };
    expect(info.manifold.points.length).toBe(2);
    expect(info.manifold.points[0].x).toBe(1);
    expect(info.manifold.points[0].y).toBe(2);
  });

  it('should allow empty points', () => {
    const info: Contact2DInfo = {
      manifold: {
        points: [],
      },
    };
    expect(info.manifold.points.length).toBe(0);
  });
});
