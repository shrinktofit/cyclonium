import { describe, it, expect } from 'vitest';
import { to0ToPI2, toDegrees, toRadians, lerpAngle, deltaAngle, towardsAngle } from '@/trigonometry.js';

describe('trigonometry', () => {
  describe('to0ToPI2', () => {
    it('should return values within [0, 2PI)', () => {
      expect(to0ToPI2(0)).toBeCloseTo(0);
      expect(to0ToPI2(Math.PI)).toBeCloseTo(Math.PI);
      expect(to0ToPI2(Math.PI * 2)).toBeCloseTo(0);
    });

    it('should normalize positive values', () => {
      expect(to0ToPI2(Math.PI * 3)).toBeCloseTo(Math.PI);
      expect(to0ToPI2(Math.PI * 4)).toBeCloseTo(0);
    });

    it('should normalize negative values', () => {
      expect(to0ToPI2(-Math.PI)).toBeCloseTo(Math.PI);
      expect(to0ToPI2(-Math.PI / 2)).toBeCloseTo(Math.PI * 1.5);
    });

    it('should handle edge cases', () => {
      expect(to0ToPI2(0)).toBe(0);
      expect(to0ToPI2(-0)).toBe(-0);
    });
  });

  describe('toDegrees', () => {
    it('should convert radians to degrees', () => {
      expect(toDegrees(0)).toBe(0);
      expect(toDegrees(Math.PI)).toBe(180);
      expect(toDegrees(Math.PI / 2)).toBe(90);
      expect(toDegrees(Math.PI * 2)).toBe(360);
    });

    it('should handle negative radians', () => {
      expect(toDegrees(-Math.PI / 2)).toBe(-90);
    });
  });

  describe('toRadians', () => {
    it('should convert degrees to radians', () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(180)).toBeCloseTo(Math.PI);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
      expect(toRadians(360)).toBeCloseTo(Math.PI * 2);
    });

    it('should handle negative degrees', () => {
      expect(toRadians(-90)).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('lerpAngle', () => {
    it('should lerp within same revolution', () => {
      expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4);
      expect(lerpAngle(0, Math.PI, 0.5)).toBeCloseTo(Math.PI / 2);
    });

    it('should handle wrap around', () => {
      const result = lerpAngle(Math.PI * 1.8, -Math.PI * 1.8, 0.5);
      expect(result).not.toBeNaN();
    });

    it('should clamp t to [0, 1]', () => {
      expect(lerpAngle(0, Math.PI, -1)).toBeCloseTo(0);
      expect(lerpAngle(0, Math.PI, 2)).toBeCloseTo(Math.PI);
    });
  });

  describe('deltaAngle', () => {
    it('should return shortest angular difference', () => {
      expect(deltaAngle(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
      expect(deltaAngle(Math.PI / 2, 0)).toBeCloseTo(-Math.PI / 2);
    });

    it('should handle wrap around', () => {
      expect(deltaAngle(Math.PI, -Math.PI)).toBeCloseTo(0);
      expect(deltaAngle(-Math.PI, Math.PI)).toBeCloseTo(0);
    });

    it('should normalize to [-PI, PI]', () => {
      expect(deltaAngle(0, Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    });
  });

  describe('towardsAngle', () => {
    it('should reach target when within maxDelta', () => {
      expect(towardsAngle(0, Math.PI / 4, Math.PI / 2)).toBeCloseTo(Math.PI / 4);
    });

    it('should move towards target', () => {
      expect(towardsAngle(0, Math.PI, Math.PI / 4)).toBeCloseTo(Math.PI / 4);
      expect(towardsAngle(Math.PI / 4, Math.PI, Math.PI / 4)).toBeCloseTo(Math.PI / 2);
    });

    it('should handle wrap around', () => {
      const result = towardsAngle(Math.PI * 1.5, -Math.PI * 1.5, Math.PI / 4);
      expect(result).not.toBeNaN();
    });
  });
});
