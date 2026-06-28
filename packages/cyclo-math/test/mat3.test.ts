import { describe, it, expect } from 'vitest';
import { Mat3 } from '@/mat3.js';
import { Vec2 } from '@/vec2.js';

describe('Mat3', () => {
  describe('static properties', () => {
    it('should have ZERO matrix', () => {
      const m = Mat3.ZERO;
      expect(m.m11).toBe(0);
      expect(m.m12).toBe(0);
      expect(m.m13).toBe(0);
      expect(m.m21).toBe(0);
      expect(m.m22).toBe(0);
      expect(m.m23).toBe(0);
      expect(m.m31).toBe(0);
      expect(m.m32).toBe(0);
      expect(m.m33).toBe(0);
    });

    it('should have IDENTITY matrix', () => {
      const m = Mat3.IDENTITY;
      expect(m.m11).toBe(1);
      expect(m.m12).toBe(0);
      expect(m.m13).toBe(0);
      expect(m.m21).toBe(0);
      expect(m.m22).toBe(1);
      expect(m.m23).toBe(0);
      expect(m.m31).toBe(0);
      expect(m.m32).toBe(0);
      expect(m.m33).toBe(1);
    });
  });

  describe('constructor', () => {
    it('should create from individual values', () => {
      const m = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
      expect(m.m11).toBe(1);
      expect(m.m22).toBe(5);
      expect(m.m33).toBe(9);
    });

    it('should create from another Mat3', () => {
      const a = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
      const b = new Mat3(a);
      expect(b.m11).toBe(1);
      expect(b.m22).toBe(5);
      expect(b).not.toBe(a);
    });
  });

  describe('set', () => {
    it('should set all values', () => {
      const m = Mat3.clone(Mat3.ZERO);
      const result = m.set(1, 2, 3, 4, 5, 6, 7, 8, 9);
      expect(m.m11).toBe(1);
      expect(m.m22).toBe(5);
      expect(m.m33).toBe(9);
      expect(result).toBe(m);
    });
  });

  describe('static methods', () => {
    describe('clone', () => {
      it('should create a copy', () => {
        const a = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
        const b = Mat3.clone(a);
        expect(b.m11).toBe(1);
        expect(b).not.toBe(a);
      });
    });

    describe('assign', () => {
      it('should copy from another matrix', () => {
        const a = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
        const b = new Mat3(0, 0, 0, 0, 0, 0, 0, 0, 0);
        Mat3.assign(b, a);
        expect(b.m11).toBe(1);
        expect(b.m22).toBe(5);
      });
    });

    describe('transpose', () => {
      it('should return transposed matrix without modifying original', () => {
        const a = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
        const b = Mat3.transpose(a);
        expect(b.m11).toBe(1);
        expect(b.m12).toBe(4);
        expect(b.m21).toBe(2);
        expect(a.m12).toBe(2);
      });
    });

    describe('mul', () => {
      it('should multiply two matrices', () => {
        const a = new Mat3(1, 0, 0, 0, 1, 0, 0, 0, 1);
        const b = new Mat3(2, 0, 0, 0, 2, 0, 0, 0, 1);
        const c = Mat3.mul(a, b);
        expect(c.m11).toBe(2);
        expect(c.m22).toBe(2);
      });

      it('should multiply multiple matrices', () => {
        const a = new Mat3(2, 0, 0, 0, 2, 0, 0, 0, 1);
        const b = new Mat3(3, 0, 0, 0, 3, 0, 0, 0, 1);
        const c = Mat3.mul(a, b);
        expect(c.m11).toBe(6);
        expect(c.m22).toBe(6);
      });

      it('should return identity for empty input', () => {
        const m = Mat3.mul();
        expect(m.m11).toBe(1);
        expect(m.m22).toBe(1);
      });

      it('should return identity for single matrix', () => {
        const m = Mat3.mul(Mat3.ZERO);
        expect(m.m11).toBe(0);
      });
    });
  });

  describe('determinant', () => {
    it('should calculate determinant of identity matrix', () => {
      expect(Mat3.IDENTITY.determinant()).toBe(1);
    });

    it('should calculate determinant of zero matrix', () => {
      expect(Mat3.ZERO.determinant()).toBe(0);
    });

    it('should calculate determinant of rotation matrix', () => {
      const m = new Mat3(
        0, -1, 0, 1, 0, 0, 0, 0, 1,
      );
      expect(m.determinant()).toBeCloseTo(1);
    });
  });

  describe('inverse', () => {
    it('should return inverse of identity matrix', () => {
      const inv = Mat3.IDENTITY.inverse();
      expect(inv.m11).toBe(1);
      expect(inv.m22).toBe(1);
    });

    it('should return zero matrix for singular matrix', () => {
      const inv = Mat3.ZERO.inverse();
      expect(inv.m11).toBe(0);
    });

    it('should correctly invert rotation matrix', () => {
      const m = Mat3.mul(
        Mat3.mul(
          new Mat3(0, -1, 0, 1, 0, 0, 0, 0, 1),
          new Mat3(1, 0, 5, 0, 1, 6, 0, 0, 1),
        ),
      );
      const inv = m.inverse();
      expect(inv.m13).toBeCloseTo(-5);
      expect(inv.m23).toBeCloseTo(-6);
    });
  });

  describe('inverseSelf', () => {
    it('should invert in place', () => {
      const m = Mat3.mul(
        new Mat3(0, -1, 0, 1, 0, 0, 0, 0, 1),
        new Mat3(1, 0, 5, 0, 1, 6, 0, 0, 1),
      );
      m.inverseSelf();
      expect(m.m13).toBeCloseTo(-5);
      expect(m.m23).toBeCloseTo(-6);
    });
  });

  describe('transport', () => {
    it('should return transposed matrix without modifying original', () => {
      const m = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
      const t = m.transport();
      expect(t.m12).toBe(4);
      expect(t.m21).toBe(2);
      expect(m.m12).toBe(2);
    });
  });

  describe('transportSelf', () => {
    it('should transpose in place', () => {
      const m = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
      m.transportSelf();
      expect(m.m12).toBe(4);
      expect(m.m21).toBe(2);
    });
  });

  describe('transformVec2', () => {
    it('should transform vector', () => {
      const m = Mat3.IDENTITY;
      const v = new Vec2(1, 2);
      const result = m.transformVec2(v);
      expect(result.x).toBe(1);
      expect(result.y).toBe(2);
    });

    it('should use provided output vector', () => {
      const m = Mat3.IDENTITY;
      const v = new Vec2(1, 2);
      const out = new Vec2();
      const result = m.transformVec2(v, out);
      expect(result).toBe(out);
      expect(out.x).toBe(1);
    });

    it('should apply translation', () => {
      const m = new Mat3(1, 0, 5, 0, 1, 6, 0, 0, 1);
      const v = new Vec2(1, 2);
      const result = m.transformVec2(v);
      expect(result.x).toBe(6);
      expect(result.y).toBe(8);
    });

    it('should apply scale', () => {
      const m = new Mat3(2, 0, 0, 0, 3, 0, 0, 0, 1);
      const v = new Vec2(5, 5);
      const result = m.transformVec2(v);
      expect(result.x).toBe(10);
      expect(result.y).toBe(15);
    });

    it('should apply rotation', () => {
      const cos = Math.cos(Math.PI / 2);
      const sin = Math.sin(Math.PI / 2);
      const m = new Mat3(cos, -sin, 0, sin, cos, 0, 0, 0, 1);
      const v = new Vec2(1, 0);
      const result = m.transformVec2(v);
      expect(result.x).toBeCloseTo(0);
      expect(result.y).toBeCloseTo(1);
    });
  });

  describe('transformVec2Normal', () => {
    it('should transform normal vector', () => {
      const m = Mat3.IDENTITY;
      const v = new Vec2(1, 0);
      const result = m.transformVec2Normal(v);
      expect(result.x).toBeCloseTo(1);
      expect(result.y).toBeCloseTo(0);
    });

    it('should return zero for degenerate matrix', () => {
      const m = Mat3.ZERO;
      const v = new Vec2(1, 0);
      const result = m.transformVec2Normal(v);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should apply inverse transpose for normals', () => {
      const m = new Mat3(2, 0, 0, 0, 3, 0, 0, 0, 1);
      const v = new Vec2(1, 0);
      const result = m.transformVec2Normal(v);
      expect(result.x).toBeCloseTo(0.5);
      expect(result.y).toBeCloseTo(0);
    });
  });
});
