import { describe, expect, it, beforeEach } from 'vitest';
import { Scene } from 'cc';
import {
  registerPhysicsWorld,
  getPhysicsWorld,
} from '@/physics-world-registry.js';
import type { PhysicsWorld2D } from '@/physics-world-2d.js';

describe('physics-world-registry', () => {
  let scene: Scene;
  let mockWorld: PhysicsWorld2D;

  beforeEach(() => {
    scene = new Scene('test-scene');
    mockWorld = {} as PhysicsWorld2D;
  });

  describe('registerPhysicsWorld', () => {
    it('should register a world for a scene', () => {
      registerPhysicsWorld(scene, mockWorld);
      expect(getPhysicsWorld(scene)).toBe(mockWorld);
    });

    it('should throw when scene already has a world', () => {
      registerPhysicsWorld(scene, mockWorld);
      expect(() => registerPhysicsWorld(scene, {} as PhysicsWorld2D)).toThrow(
        'Physics world already registered for a scene.',
      );
    });
  });

  describe('getPhysicsWorld', () => {
    it('should return undefined for unregistered scene', () => {
      const unregisteredScene = new Scene('other-scene');
      expect(getPhysicsWorld(unregisteredScene)).toBeUndefined();
    });

    it('should return registered world', () => {
      registerPhysicsWorld(scene, mockWorld);
      expect(getPhysicsWorld(scene)).toBe(mockWorld);
    });
  });
});
