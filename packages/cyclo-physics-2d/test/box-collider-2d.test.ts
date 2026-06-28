import { describe, expect, it } from 'vitest';
import { Node } from 'cc';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { BoxCollider2D } from '@/colliders/box-collider-2d.js';
import { RigidBody2D } from '@/rigid-body-2d.js';

describe('BoxCollider2D', () => {
  describe('dimensions', () => {
    it('should have default dimensions', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      expect(collider.width).toBe(2);
      expect(collider.height).toBe(2);
    });

    it('should set width', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.width = 4;
      expect(collider.width).toBe(4);
    });

    it('should set height', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.height = 6;
      expect(collider.height).toBe(6);
    });

    it('should set both width and height', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.width = 4;
      collider.height = 6;
      expect(collider.width).toBe(4);
      expect(collider.height).toBe(6);
    });

    it('should compute halfExtents correctly', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.width = 4;
      collider.height = 6;
      const halfExtents = collider.halfExtents;
      expect(halfExtents.x).toBe(2);
      expect(halfExtents.y).toBe(3);
    });

    it('should compute bounds size from full extents and scene scale', () => {
      const node = new Node();
      const transform = node.addComponent(Transform2DComponent);
      const collider = node.addComponent(BoxCollider2D);
      transform.scale = new Vec2(2, 3);
      collider.width = 4;
      collider.height = 6;

      expect(collider.bounds.size.x).toBeCloseTo(8);
      expect(collider.bounds.size.y).toBeCloseTo(18);
    });

    it('should allow negative width', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.width = -1;
      expect(collider.width).toBe(-1);
    });

    it('should allow negative height', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.height = -1;
      expect(collider.height).toBe(-1);
    });
  });

  describe('center', () => {
    it('should have default center at origin', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      expect(collider.center.x).toBe(0);
      expect(collider.center.y).toBe(0);
    });

    it('should set center', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.center = new Vec2(1, 2);
      expect(collider.center.x).toBe(1);
      expect(collider.center.y).toBe(2);
    });
  });

  describe('isSensor', () => {
    it('should default to false', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      expect(collider.isSensor).toBe(false);
    });

    it('should allow setting isSensor', () => {
      const node = new Node();
      const collider = node.addComponent(BoxCollider2D);
      collider.isSensor = true;
      expect(collider.isSensor).toBe(true);
    });
  });

  describe('with RigidBody2D', () => {
    it('should return null attached rigid body when no physics world', () => {
      const node = new Node();
      node.addComponent(RigidBody2D);
      const collider = node.addComponent(BoxCollider2D);
      expect(collider.attachedRigidBody).toBeNull();
    });
  });
});
