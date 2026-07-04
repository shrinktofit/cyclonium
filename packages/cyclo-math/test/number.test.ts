import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  inverseLerp,
  remap,
  wrap,
  pingPong,
  smoothStep,
  isPowerOfTwo,
  approxEqual,
  approxEqualExclusive,
  approxEqualInclusive,
  towards,
  randomIntRange,
} from '@/number.js';

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

  describe('inverseLerp', () => {
    it('should calculate normalized positions within a range', () => {
      /// @case
      /// 1. Values are sampled at the start, midpoint, and end of a range.
      /// @expect
      /// The returned factors preserve the normalized position in the range.
      expect(inverseLerp(0, 10, 0)).toBe(0);
      expect(inverseLerp(0, 10, 5)).toBe(0.5);
      expect(inverseLerp(0, 10, 10)).toBe(1);
    });

    it('should extrapolate outside the input range', () => {
      /// @case
      /// 1. Values are sampled before and after the source range.
      /// @expect
      /// The returned factors are allowed to be lower than 0 or greater than 1.
      expect(inverseLerp(0, 10, -5)).toBe(-0.5);
      expect(inverseLerp(0, 10, 15)).toBe(1.5);
    });

    it('should support reversed ranges', () => {
      /// @case
      /// 1. The range starts at a larger value and ends at a smaller value.
      /// @expect
      /// The returned factor follows the reversed range direction.
      expect(inverseLerp(10, 0, 5)).toBe(0.5);
      expect(inverseLerp(10, 0, 15)).toBe(-0.5);
    });

    it('should return zero for equal range endpoints', () => {
      /// @case
      /// 1. The source range has identical endpoints.
      /// @expect
      /// The degenerate range maps to a zero factor.
      expect(inverseLerp(5, 5, 10)).toBe(0);
    });
  });

  describe('remap', () => {
    it('should map values between ranges', () => {
      /// @case
      /// 1. A midpoint in one range is remapped into another range.
      /// @expect
      /// The output preserves the input value's normalized position.
      expect(remap(5, 0, 10, 0, 100)).toBe(50);
    });

    it('should extrapolate outside the input range', () => {
      /// @case
      /// 1. A value beyond the input range is remapped.
      /// @expect
      /// The output is allowed to move beyond the output range.
      expect(remap(15, 0, 10, 0, 100)).toBe(150);
    });

    it('should support reversed output ranges', () => {
      /// @case
      /// 1. A value is remapped from an ascending input range to a descending output range.
      /// @expect
      /// The output follows the direction of the output range.
      expect(remap(0.25, 0, 1, 10, 0)).toBe(7.5);
    });

    it('should map equal input endpoints to the output start', () => {
      /// @case
      /// 1. The input range has identical endpoints.
      /// @expect
      /// The remapped value uses the output range's start value.
      expect(remap(5, 1, 1, 20, 40)).toBe(20);
    });
  });

  describe('wrap', () => {
    it('should wrap values into a half-open range', () => {
      /// @case
      /// 1. Values overflow positively, underflow negatively, and land exactly on max.
      /// @expect
      /// Results stay within [min, max), with max wrapping back to min.
      expect(wrap(12, 0, 5)).toBe(2);
      expect(wrap(-1, 0, 5)).toBe(4);
      expect(wrap(17, 10, 15)).toBe(12);
      expect(wrap(15, 10, 15)).toBe(10);
    });

    it('should return NaN for equal range endpoints', () => {
      /// @case
      /// 1. The wrap range has identical endpoints.
      /// @expect
      /// The result is NaN because there is no valid interval length.
      expect(wrap(1, 5, 5)).toBeNaN();
    });
  });

  describe('pingPong', () => {
    it('should produce a triangle wave between zero and length', () => {
      /// @case
      /// 1. Values move from 0 to length and back to 0.
      /// @expect
      /// The output follows the triangle wave endpoints and mirrored descent.
      expect(pingPong(0, 3)).toBe(0);
      expect(pingPong(3, 3)).toBe(3);
      expect(pingPong(4, 3)).toBe(2);
      expect(pingPong(6, 3)).toBe(0);
    });

    it('should handle negative inputs and lengths', () => {
      /// @case
      /// 1. The input value or length is negative.
      /// @expect
      /// Negative inputs mirror into the same positive triangle wave and negative length is treated as positive.
      expect(pingPong(-1, 3)).toBe(1);
      expect(pingPong(4, -3)).toBe(2);
    });

    it('should return zero for zero length', () => {
      /// @case
      /// 1. The triangle wave length is zero.
      /// @expect
      /// The degenerate wave remains at zero.
      expect(pingPong(10, 0)).toBe(0);
    });
  });

  describe('smoothStep', () => {
    it('should return a smoothed weight within the range', () => {
      /// @case
      /// 1. Values are sampled at the start, midpoint, and end of a range.
      /// @expect
      /// The result is a smoothed 0 to 1 weight.
      expect(smoothStep(0, 10, 0)).toBe(0);
      expect(smoothStep(0, 10, 5)).toBe(0.5);
      expect(smoothStep(0, 10, 10)).toBe(1);
    });

    it('should clamp outside the range', () => {
      /// @case
      /// 1. Values are sampled before and after the source range.
      /// @expect
      /// The smoothed weight is clamped to 0 or 1.
      expect(smoothStep(0, 10, -1)).toBe(0);
      expect(smoothStep(0, 10, 11)).toBe(1);
    });

    it('should support reversed ranges', () => {
      /// @case
      /// 1. The smoothing range starts at a larger value and ends at a smaller value.
      /// @expect
      /// The smoothed weight follows the reversed range direction.
      expect(smoothStep(10, 0, 5)).toBe(0.5);
      expect(smoothStep(10, 0, 15)).toBe(0);
    });
  });

  describe('isPowerOfTwo', () => {
    it('should return true for positive safe integer powers of two', () => {
      /// @case
      /// 1. Positive safe integers that are exact powers of two are checked.
      /// @expect
      /// Each exact power of two is accepted.
      expect(isPowerOfTwo(1)).toBe(true);
      expect(isPowerOfTwo(2)).toBe(true);
      expect(isPowerOfTwo(1024)).toBe(true);
      expect(isPowerOfTwo(2 ** 52)).toBe(true);
    });

    it('should return false for non-positive, fractional, non-finite, and unsafe values', () => {
      /// @case
      /// 1. Values outside the positive safe integer power-of-two domain are checked.
      /// @expect
      /// Non-domain values are rejected without 32-bit integer coercion.
      expect(isPowerOfTwo(0)).toBe(false);
      expect(isPowerOfTwo(-2)).toBe(false);
      expect(isPowerOfTwo(3.5)).toBe(false);
      expect(isPowerOfTwo(Number.NaN)).toBe(false);
      expect(isPowerOfTwo(Number.POSITIVE_INFINITY)).toBe(false);
      expect(isPowerOfTwo(2 ** 53)).toBe(false);
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
