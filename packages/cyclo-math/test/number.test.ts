import { describe, it, expect } from 'vitest';
import { clamp, lerp, approxEqual, approxEqualExclusive, approxEqualInclusive, towards, randomIntRange } from '@/number.js';

describe('number', () => {
  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should handle negative ranges', () => {
      expect(clamp(5, -10, -5)).toBe(-5);
      expect(clamp(-15, -10, -5)).toBe(-10);
    });
  });

  describe('lerp', () => {
    it('should interpolate between two values', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('should extrapolate when t is outside [0, 1]', () => {
      expect(lerp(0, 10, -0.5)).toBe(-5);
      expect(lerp(0, 10, 1.5)).toBe(15);
    });

    it('should handle negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
      expect(lerp(-10, -5, 0.5)).toBe(-7.5);
    });
  });

  describe('approxEqual', () => {
    it('should return true for equal values within epsilon', () => {
      expect(approxEqual(1.0, 1.00001, 0.0001)).toBe(true);
      expect(approxEqual(1.0, 1.0, 0.0001)).toBe(true);
    });

    it('should return false for values outside epsilon', () => {
      expect(approxEqual(1.0, 1.001, 0.0001)).toBe(false);
    });

    it('should handle zero', () => {
      expect(approxEqual(0, 0, 0.001)).toBe(true);
    });
  });

  describe('approxEqualExclusive', () => {
    it('should return true for values within epsilon', () => {
      expect(approxEqualExclusive(1.0, 1.00001, 0.0001)).toBe(true);
    });

    it('should return false for values at epsilon boundary', () => {
      expect(approxEqualExclusive(1.0, 1.0002, 0.0001)).toBe(false);
    });
  });

  describe('approxEqualInclusive', () => {
    it('should return true for values within epsilon', () => {
      expect(approxEqualInclusive(1.0, 1.00001, 0.0001)).toBe(true);
    });

    it('should return true for values at epsilon boundary', () => {
      expect(approxEqualInclusive(1.0, 1.0001, 0.0001)).toBe(true);
    });

    it('should return false for values outside epsilon', () => {
      expect(approxEqualInclusive(1.0, 1.0002, 0.0001)).toBe(false);
    });
  });

  describe('towards', () => {
    it('should return target when current is within maxDelta of target', () => {
      expect(towards(5, 10, 10)).toBe(10);
      expect(towards(5, 10, 5)).toBe(10);
    });

    it('should move towards target by maxDelta', () => {
      expect(towards(0, 10, 3)).toBe(3);
      expect(towards(3, 10, 3)).toBe(6);
    });

    it('should handle negative direction', () => {
      expect(towards(10, 0, 3)).toBe(7);
      expect(towards(10, -10, 3)).toBe(7);
    });

    it('should handle exact maxDelta', () => {
      expect(towards(0, 10, 10)).toBe(10);
    });
  });

  describe('randomIntRange', () => {
    it('should return integer within range [min, maxExclusive)', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomIntRange(5, 10);
        expect(result).toBeGreaterThanOrEqual(5);
        expect(result).toBeLessThan(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('should handle single element range', () => {
      for (let i = 0; i < 100; i++) {
        expect(randomIntRange(5, 6)).toBe(5);
      }
    });

    it('should handle negative ranges', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomIntRange(-10, -5);
        expect(result).toBeGreaterThanOrEqual(-10);
        expect(result).toBeLessThan(-5);
      }
    });
  });
});
