import { describe, expect, it } from 'vitest';
import { Node } from 'cc';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { CircleCollider2D } from '@/colliders/circle-collider-2d.js';
import { RigidBody2D } from '@/rigid-body-2d.js';

describe('CircleCollider2D', () => {
  describe('radius', () => {
    it('should have default radius of 1', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      expect(collider.radius).toBe(1);
    });

    it('should set radius', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      collider.radius = 5;
      expect(collider.radius).toBe(5);
    });

    it('should allow negative radius', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      collider.radius = -1;
      expect(collider.radius).toBe(-1);
    });

    it('should allow setting zero radius', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      collider.radius = 0;
      expect(collider.radius).toBe(0);
    });

    it('should allow large radius', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      collider.radius = 1000;
      expect(collider.radius).toBe(1000);
    });

    it('should compute bounds size from diameter and scene scale', () => {
      const node = new Node();
      const transform = node.addComponent(Transform2DComponent);
      const collider = node.addComponent(CircleCollider2D);
      transform.scale = 2;
      collider.radius = 5;

      expect(collider.bounds.size.x).toBeCloseTo(20);
      expect(collider.bounds.size.y).toBeCloseTo(20);
    });
  });

  describe('center', () => {
    it('should have default center at origin', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      expect(collider.center.x).toBe(0);
      expect(collider.center.y).toBe(0);
    });

    it('should set center', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      collider.center = new Vec2(1, 2);
      expect(collider.center.x).toBe(1);
      expect(collider.center.y).toBe(2);
    });
  });

  describe('isSensor', () => {
    it('should default to false', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      expect(collider.isSensor).toBe(false);
    });

    it('should allow setting isSensor', () => {
      const node = new Node();
      const collider = node.addComponent(CircleCollider2D);
      collider.isSensor = true;
      expect(collider.isSensor).toBe(true);
    });
  });

  describe('with RigidBody2D', () => {
    it('should return null when no physics world', () => {
      const node = new Node();
      node.addComponent(RigidBody2D);
      const collider = node.addComponent(CircleCollider2D);
      expect(collider.attachedRigidBody).toBeNull();
    });

    it('should work with multiple colliders on same body', () => {
      const node = new Node();
      node.addComponent(RigidBody2D);
      const collider1 = node.addComponent(CircleCollider2D);
      const collider2 = node.addComponent(CircleCollider2D);
      collider2.radius = 2;
      expect(collider1.attachedRigidBody).toBe(collider2.attachedRigidBody);
    });
  });
});
