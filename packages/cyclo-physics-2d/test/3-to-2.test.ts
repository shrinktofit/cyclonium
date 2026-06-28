import { describe, it, expect } from 'vitest';
import type { Quat } from 'cc';
import { getZRotation } from '@/utils/3-to-2.js';

describe('utils/3-to-2', () => {
  describe('getZRotation', () => {
    it('should return 0 when w is 1 (identity quaternion)', () => {
      const quat: Quat = { x: 0, y: 0, z: 0, w: 1 } as Quat;
      expect(getZRotation(quat)).toBe(0);
    });

    it('should return 0 when w is -1', () => {
      const quat: Quat = { x: 0, y: 0, z: 0, w: -1 } as Quat;
      expect(getZRotation(quat)).toBe(0);
    });

    it('should return positive rotation for positive z', () => {
      const halfTheta = Math.PI / 4;
      const w = Math.cos(halfTheta);
      const z = Math.sin(halfTheta);
      const quat: Quat = { x: 0, y: 0, z, w } as Quat;
      const result = getZRotation(quat);
      expect(result).toBeCloseTo(Math.PI / 2, 5);
    });

    it('should return negative rotation for negative z', () => {
      const halfTheta = Math.PI / 4;
      const w = Math.cos(halfTheta);
      const z = -Math.sin(halfTheta);
      const quat: Quat = { x: 0, y: 0, z, w } as Quat;
      const result = getZRotation(quat);
      expect(result).toBeCloseTo(-Math.PI / 2, 5);
    });

    it('should handle various z rotations', () => {
      const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI];
      for (const angle of angles) {
        const halfTheta = angle / 2;
        const w = Math.cos(halfTheta);
        const z = Math.sin(halfTheta);
        const quat: Quat = { x: 0, y: 0, z, w } as Quat;
        const result = getZRotation(quat);
        expect(result).toBeCloseTo(angle, 5);
      }
    });

    it('should handle negative angles', () => {
      const angles = [-Math.PI / 4, -Math.PI / 2, -Math.PI];
      for (const angle of angles) {
        const halfTheta = angle / 2;
        const w = Math.cos(halfTheta);
        const z = Math.sin(halfTheta);
        const quat: Quat = { x: 0, y: 0, z, w } as Quat;
        const result = getZRotation(quat);
        expect(result).toBeCloseTo(angle, 5);
      }
    });
  });
});
