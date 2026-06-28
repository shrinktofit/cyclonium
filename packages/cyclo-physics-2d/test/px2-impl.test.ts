import { describe, expect, it } from 'vitest';
import { px2Impl, initializePx2Impl } from '@/px2-impl.js';

describe('px2-impl', () => {
  describe('initializePx2Impl', () => {
    it('should be a function', () => {
      expect(typeof initializePx2Impl).toBe('function');
    });

    it('should be callable multiple times without error', async () => {
      await initializePx2Impl();
      await initializePx2Impl();
    });
  });

  describe('px2Impl', () => {
    it('should export rapier2d module', () => {
      expect(px2Impl).toBeDefined();
      expect(px2Impl.RigidBodyDesc).toBeDefined();
      expect(px2Impl.ColliderDesc).toBeDefined();
    });

    it('should have Vector2', () => {
      expect(px2Impl.Vector2).toBeDefined();
    });
  });
});
