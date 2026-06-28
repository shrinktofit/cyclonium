import { describe, expect, it } from 'vitest';
import { Node } from 'cc';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { CapsuleCollider2D } from '@/colliders/capsule-collider-2d.js';

describe('CapsuleCollider2D', () => {
  it('should have default radius and halfHeight', () => {
    const node = new Node();
    const collider = node.addComponent(CapsuleCollider2D);
    expect(collider.radius).toBe(1);
    expect(collider.halfHeight).toBe(1);
  });

  it('should set radius and halfHeight', () => {
    const node = new Node();
    const collider = node.addComponent(CapsuleCollider2D);
    collider.radius = 2;
    collider.halfHeight = 3;
    expect(collider.radius).toBe(2);
    expect(collider.halfHeight).toBe(3);
  });

  it('should compute bounds size from capsule extents and scene scale', () => {
    const node = new Node();
    const transform = node.addComponent(Transform2DComponent);
    const collider = node.addComponent(CapsuleCollider2D);
    transform.scale = 4;
    collider.radius = 2;
    collider.halfHeight = 3;

    expect(collider.bounds.size.x).toBeCloseTo(16);
    expect(collider.bounds.size.y).toBeCloseTo(28);
  });
});
