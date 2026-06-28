import { describe, it, expect } from 'vitest';
import { Vec2, v2 } from '@/vec2.js';

describe('Vec2', () => {
  describe('static properties', () => {
    it('should have static zero vector', () => {
      expect(Vec2.ZERO.x).toBe(0);
      expect(Vec2.ZERO.y).toBe(0);
    });

    it('should have static one vector', () => {
      expect(Vec2.ONE.x).toBe(1);
      expect(Vec2.ONE.y).toBe(1);
    });

    it('should have static unit vectors', () => {
      expect(Vec2.UNIT_X.x).toBe(1);
      expect(Vec2.UNIT_X.y).toBe(0);
      expect(Vec2.UNIT_Y.x).toBe(0);
      expect(Vec2.UNIT_Y.y).toBe(1);
    });

    it('should have static infinity vectors', () => {
      expect(Vec2.POSITIVE_INFINITY.x).toBe(Infinity);
      expect(Vec2.POSITIVE_INFINITY.y).toBe(Infinity);
      expect(Vec2.NEGATIVE_INFINITY.x).toBe(-Infinity);
      expect(Vec2.NEGATIVE_INFINITY.y).toBe(-Infinity);
    });
  });

  describe('constructor', () => {
    it('should create vector with default values', () => {
      const v = new Vec2();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    it('should create vector with specified values', () => {
      const v = new Vec2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });
  });

  describe('magnitude', () => {
    it('should calculate magnitude', () => {
      const v = new Vec2(3, 4);
      expect(v.magnitude).toBeCloseTo(5);
    });

    it('should return 0 for zero vector', () => {
      expect(new Vec2().magnitude).toBe(0);
    });
  });

  describe('magnitudeSquared', () => {
    it('should calculate squared magnitude', () => {
      const v = new Vec2(3, 4);
      expect(v.magnitudeSquared).toBe(25);
    });
  });

  describe('static methods', () => {
    describe('clone', () => {
      it('should create a copy', () => {
        const a = new Vec2(1, 2);
        const b = Vec2.clone(a);
        expect(b.x).toBe(1);
        expect(b.y).toBe(2);
        expect(b).not.toBe(a);
      });
    });

    describe('fromLiteral', () => {
      it('should create from literal object', () => {
        const v = Vec2.fromLiteral({ x: 3, y: 4 });
        expect(v.x).toBe(3);
        expect(v.y).toBe(4);
      });
    });

    describe('set', () => {
      it('should set values', () => {
        const v = new Vec2();
        const result = Vec2.set(v, 3, 4);
        expect(v.x).toBe(3);
        expect(v.y).toBe(4);
        expect(result).toBe(v);
      });
    });

    describe('assign', () => {
      it('should copy from another vector', () => {
        const a = new Vec2(1, 2);
        const b = new Vec2();
        Vec2.assign(b, a);
        expect(b.x).toBe(1);
        expect(b.y).toBe(2);
      });
    });

    describe('strictEquals', () => {
      it('should return true for identical values', () => {
        const a = new Vec2(1, 2);
        const b = new Vec2(1, 2);
        expect(Vec2.strictEquals(a, b)).toBe(true);
      });

      it('should return false for different values', () => {
        const a = new Vec2(1, 2);
        const b = new Vec2(1, 3);
        expect(Vec2.strictEquals(a, b)).toBe(false);
      });
    });

    describe('equals', () => {
      it('should return true for approximately equal values', () => {
        const a = new Vec2(1.0, 2.0);
        const b = new Vec2(1.00001, 2.00001);
        expect(Vec2.equals(a, b, 0.0001)).toBe(true);
      });

      it('should return false for non-equal values', () => {
        const a = new Vec2(1, 2);
        const b = new Vec2(2, 3);
        expect(Vec2.equals(a, b)).toBe(false);
      });
    });

    describe('negate', () => {
      it('should negate values', () => {
        const v = Vec2.negate(new Vec2(1, -2));
        expect(v.x).toBe(-1);
        expect(v.y).toBe(2);
      });
    });

    describe('add', () => {
      it('should add vectors', () => {
        const v = Vec2.add(new Vec2(1, 2), new Vec2(3, 4));
        expect(v.x).toBe(4);
        expect(v.y).toBe(6);
      });
    });

    describe('sub', () => {
      it('should subtract vectors', () => {
        const v = Vec2.sub(new Vec2(5, 6), new Vec2(2, 3));
        expect(v.x).toBe(3);
        expect(v.y).toBe(3);
      });
    });

    describe('mul', () => {
      it('should multiply vectors component-wise', () => {
        const v = Vec2.mul(new Vec2(2, 3), new Vec2(4, 5));
        expect(v.x).toBe(8);
        expect(v.y).toBe(15);
      });
    });

    describe('div', () => {
      it('should divide vectors component-wise', () => {
        const v = Vec2.div(new Vec2(10, 15), new Vec2(2, 3));
        expect(v.x).toBe(5);
        expect(v.y).toBe(5);
      });
    });

    describe('mulScalar', () => {
      it('should multiply by scalar', () => {
        const v = Vec2.mulScalar(new Vec2(2, 3), 3);
        expect(v.x).toBe(6);
        expect(v.y).toBe(9);
      });
    });

    describe('divScalar', () => {
      it('should divide by scalar', () => {
        const v = Vec2.divScalar(new Vec2(10, 15), 5);
        expect(v.x).toBe(2);
        expect(v.y).toBe(3);
      });
    });

    describe('normalize', () => {
      it('should normalize vector', () => {
        const v = Vec2.normalize(new Vec2(3, 4));
        expect(v.x).toBeCloseTo(0.6);
        expect(v.y).toBeCloseTo(0.8);
      });

      it('should return NaN for zero vector (static method)', () => {
        const v = Vec2.normalize(new Vec2(0, 0));
        expect(Number.isNaN(v.x)).toBe(true);
      });
    });

    describe('dot', () => {
      it('should calculate dot product', () => {
        expect(Vec2.dot(new Vec2(1, 2), new Vec2(3, 4))).toBe(11);
      });
    });

    describe('cross', () => {
      it('should calculate cross product (2D pseudo cross)', () => {
        expect(Vec2.cross(new Vec2(1, 0), new Vec2(0, 1))).toBe(1);
        expect(Vec2.cross(new Vec2(0, 1), new Vec2(1, 0))).toBe(-1);
      });
    });

    describe('distance', () => {
      it('should calculate distance', () => {
        const dist = Vec2.distance(new Vec2(0, 0), new Vec2(3, 4));
        expect(dist).toBeCloseTo(5);
      });
    });

    describe('squaredDistance', () => {
      it('should calculate squared distance', () => {
        expect(Vec2.squaredDistance(new Vec2(0, 0), new Vec2(3, 4))).toBe(25);
      });
    });

    describe('angle', () => {
      it('should calculate angle between vectors', () => {
        expect(Vec2.angle(new Vec2(1, 0), new Vec2(0, 1))).toBeCloseTo(Math.PI / 2);
        expect(Vec2.angle(new Vec2(1, 0), new Vec2(1, 0))).toBeCloseTo(0);
      });

      it('should return 0 for zero vectors', () => {
        expect(Vec2.angle(new Vec2(0, 0), new Vec2(1, 0))).toBe(0);
      });
    });

    describe('signedAngle', () => {
      it('should calculate signed angle', () => {
        expect(Vec2.signedAngle(new Vec2(1, 0), new Vec2(0, 1))).toBeCloseTo(Math.PI / 2);
        expect(Vec2.signedAngle(new Vec2(0, 1), new Vec2(1, 0))).toBeCloseTo(-Math.PI / 2);
      });
    });

    describe('min', () => {
      it('should return component-wise minimum', () => {
        const v = Vec2.min(new Vec2(1, 5), new Vec2(3, 2));
        expect(v.x).toBe(1);
        expect(v.y).toBe(2);
      });
    });

    describe('max', () => {
      it('should return component-wise maximum', () => {
        const v = Vec2.max(new Vec2(1, 5), new Vec2(3, 2));
        expect(v.x).toBe(3);
        expect(v.y).toBe(5);
      });
    });

    describe('clamp', () => {
      it('should clamp vector within bounds', () => {
        const v = Vec2.clamp(new Vec2(10, 20), new Vec2(0, 0), new Vec2(5, 15));
        expect(v.x).toBe(5);
        expect(v.y).toBe(15);
      });
    });

    describe('lerp', () => {
      it('should interpolate between vectors', () => {
        const v = Vec2.lerp(new Vec2(0, 0), new Vec2(10, 20), 0.5);
        expect(v.x).toBe(5);
        expect(v.y).toBe(10);
      });
    });

    describe('rotate', () => {
      it('should rotate vector', () => {
        const v = Vec2.rotate(new Vec2(1, 0), Math.PI / 2);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(1);
      });
    });
  });

  describe('instance methods', () => {
    describe('toString', () => {
      it('should return string representation', () => {
        expect(new Vec2(1, 2).toString()).toBe('Vec2(1, 2)');
      });
    });

    describe('toFixed', () => {
      it('should return fixed decimal representation', () => {
        expect(new Vec2(1.234, 5.678).toFixed(2)).toBe('Vec2(1.23, 5.68)');
      });
    });

    describe('toPrecision', () => {
      it('should return precision representation', () => {
        expect(new Vec2(1.234, 5.678).toPrecision(3)).toBe('Vec2(1.23, 5.68)');
      });
    });

    describe('clone', () => {
      it('should create a copy', () => {
        const a = new Vec2(1, 2);
        const b = a.clone();
        expect(b.x).toBe(1);
        expect(b.y).toBe(2);
        expect(b).not.toBe(a);
      });
    });

    describe('set', () => {
      it('should set values and return this', () => {
        const v = new Vec2();
        const result = v.set(3, 4);
        expect(v.x).toBe(3);
        expect(v.y).toBe(4);
        expect(result).toBe(v);
      });
    });

    describe('copyFrom', () => {
      it('should copy from another vector', () => {
        const a = new Vec2(1, 2);
        const b = new Vec2();
        b.copyFrom(a);
        expect(b.x).toBe(1);
        expect(b.y).toBe(2);
      });
    });

    describe('negation', () => {
      it('should return negated vector', () => {
        const v = new Vec2(1, -2);
        const n = v.negation();
        expect(n.x).toBe(-1);
        expect(n.y).toBe(2);
        expect(v.x).toBe(1);
      });
    });

    describe('normalizeSelf', () => {
      it('should normalize in place', () => {
        const v = new Vec2(3, 4);
        v.normalizeSelf();
        expect(v.x).toBeCloseTo(0.6);
        expect(v.y).toBeCloseTo(0.8);
      });

      it('should handle zero vector', () => {
        const v = new Vec2(0, 0);
        v.normalizeSelf();
        expect(v.x).toBe(0);
        expect(v.y).toBe(0);
      });
    });

    describe('orthonormal', () => {
      it('should return orthonormal vector', () => {
        const v = new Vec2(3, 4).orthonormal();
        expect(v.x).toBeCloseTo(-0.8);
        expect(v.y).toBeCloseTo(0.6);
      });
    });

    describe('reverseOrthonormal', () => {
      it('should return reverse orthonormal vector', () => {
        const v = new Vec2(3, 4).reverseOrthonormal();
        expect(v.x).toBeCloseTo(0.8);
        expect(v.y).toBeCloseTo(-0.6);
      });
    });

    describe('addSelf', () => {
      it('should add in place', () => {
        const v = new Vec2(1, 2);
        v.addSelf(new Vec2(3, 4));
        expect(v.x).toBe(4);
        expect(v.y).toBe(6);
      });
    });

    describe('subSelf', () => {
      it('should subtract in place', () => {
        const v = new Vec2(5, 6);
        v.subSelf(new Vec2(2, 3));
        expect(v.x).toBe(3);
        expect(v.y).toBe(3);
      });
    });

    describe('mulSelf', () => {
      it('should multiply in place', () => {
        const v = new Vec2(2, 3);
        v.mulSelf(new Vec2(4, 5));
        expect(v.x).toBe(8);
        expect(v.y).toBe(15);
      });
    });

    describe('mulSelfScalar', () => {
      it('should multiply by scalar in place', () => {
        const v = new Vec2(2, 3);
        v.mulSelfScalar(3);
        expect(v.x).toBe(6);
        expect(v.y).toBe(9);
      });
    });

    describe('addMulScalar', () => {
      it('should return new vector with scalar multiplication added', () => {
        const v = new Vec2(1, 2).addMulScalar(new Vec2(3, 4), 2);
        expect(v.x).toBe(7);
        expect(v.y).toBe(10);
      });
    });

    describe('projectSelf', () => {
      it('should project onto another vector in place', () => {
        const v = new Vec2(6, 8);
        v.projectSelf(new Vec2(1, 0));
        expect(v.x).toBe(6);
        expect(v.y).toBe(0);
      });
    });

    describe('rotateSelf', () => {
      it('should rotate in place', () => {
        const v = new Vec2(1, 0);
        v.rotateSelf(Math.PI / 2);
        expect(v.x).toBeCloseTo(0);
        expect(v.y).toBeCloseTo(1);
      });
    });

    describe('atan2', () => {
      it('should return angle', () => {
        expect(new Vec2(1, 0).atan2()).toBeCloseTo(0);
        expect(new Vec2(0, 1).atan2()).toBeCloseTo(Math.PI / 2);
      });
    });
  });

  describe('v2 helper', () => {
    it('should create vector', () => {
      const v = v2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });

    it('should use default values', () => {
      const v = v2();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });
  });
});
