import { describe, it, expect } from 'vitest';
import { Vec2 } from '@/vec2.js';
import { Mat3 } from '@/mat3.js';
import { mat3FromSRT, mat3FromTranslation, mat3FromScale, mat3FromRotation, decomposeSRTMat3 } from '@/transform-2d.js';

describe('transform-2d', () => {
  describe('mat3FromSRT', () => {
    it('should create matrix from translation only', () => {
      const translation = new Vec2(5, 6);
      const rotation = 0;
      const scale = new Vec2(1, 1);
      const m = mat3FromSRT(translation, rotation, scale);

      expect(m.m11).toBeCloseTo(1);
      expect(m.m12).toBeCloseTo(0);
      expect(m.m13).toBeCloseTo(5);
      expect(m.m21).toBeCloseTo(0);
      expect(m.m22).toBeCloseTo(1);
      expect(m.m23).toBeCloseTo(6);
      expect(m.m33).toBeCloseTo(1);
    });

    it('should create matrix from scale only', () => {
      const translation = new Vec2(0, 0);
      const rotation = 0;
      const scale = new Vec2(2, 3);
      const m = mat3FromSRT(translation, rotation, scale);

      expect(m.m11).toBeCloseTo(2);
      expect(m.m12).toBeCloseTo(0);
      expect(m.m13).toBeCloseTo(0);
      expect(m.m21).toBeCloseTo(0);
      expect(m.m22).toBeCloseTo(3);
      expect(m.m23).toBeCloseTo(0);
    });

    it('should create matrix from rotation only', () => {
      const translation = new Vec2(0, 0);
      const rotation = Math.PI / 2;
      const scale = new Vec2(1, 1);
      const m = mat3FromSRT(translation, rotation, scale);

      expect(m.m11).toBeCloseTo(0);
      expect(m.m12).toBeCloseTo(-1);
      expect(m.m21).toBeCloseTo(1);
      expect(m.m22).toBeCloseTo(0);
    });

    it('should create combined SRT matrix', () => {
      const translation = new Vec2(10, 20);
      const rotation = Math.PI / 4;
      const scale = new Vec2(2, 2);
      const m = mat3FromSRT(translation, rotation, scale);

      expect(m.m33).toBeCloseTo(1);
      expect(m.m13).toBeCloseTo(10);
      expect(m.m23).toBeCloseTo(20);
    });

    it('should use provided output matrix', () => {
      const translation = new Vec2(5, 6);
      const rotation = 0;
      const scale = new Vec2(1, 1);
      const out = Mat3.clone(Mat3.ZERO);
      const result = mat3FromSRT(translation, rotation, scale, out);
      expect(result).toBe(out);
    });
  });

  describe('mat3FromTranslation', () => {
    it('should create translation matrix', () => {
      const translation = new Vec2(5, 6);
      const m = mat3FromTranslation(translation);

      expect(m.m11).toBeCloseTo(1);
      expect(m.m22).toBeCloseTo(1);
      expect(m.m13).toBeCloseTo(5);
      expect(m.m23).toBeCloseTo(6);
      expect(m.m33).toBeCloseTo(1);
    });

    it('should handle zero translation', () => {
      const translation = new Vec2(0, 0);
      const m = mat3FromTranslation(translation);

      expect(m.m11).toBeCloseTo(1);
      expect(m.m22).toBeCloseTo(1);
      expect(m.m13).toBeCloseTo(0);
      expect(m.m23).toBeCloseTo(0);
    });
  });

  describe('mat3FromScale', () => {
    it('should create scale matrix', () => {
      const scale = new Vec2(2, 3);
      const m = mat3FromScale(scale);

      expect(m.m11).toBeCloseTo(2);
      expect(m.m22).toBeCloseTo(3);
      expect(m.m33).toBeCloseTo(1);
    });

    it('should handle uniform scale', () => {
      const scale = new Vec2(2, 2);
      const m = mat3FromScale(scale);

      expect(m.m11).toBeCloseTo(2);
      expect(m.m22).toBeCloseTo(2);
    });

    it('should handle zero scale', () => {
      const scale = new Vec2(0, 0);
      const m = mat3FromScale(scale);

      expect(m.m11).toBeCloseTo(0);
      expect(m.m22).toBeCloseTo(0);
    });
  });

  describe('mat3FromRotation', () => {
    it('should create rotation matrix for 90 degrees', () => {
      const rotation = Math.PI / 2;
      const m = mat3FromRotation(rotation);

      expect(m.m11).toBeCloseTo(0);
      expect(m.m12).toBeCloseTo(-1);
      expect(m.m21).toBeCloseTo(1);
      expect(m.m22).toBeCloseTo(0);
      expect(m.m33).toBeCloseTo(1);
    });

    it('should create rotation matrix for 0 degrees (identity)', () => {
      const rotation = 0;
      const m = mat3FromRotation(rotation);

      expect(m.m11).toBeCloseTo(1);
      expect(m.m22).toBeCloseTo(1);
    });

    it('should create rotation matrix for 180 degrees', () => {
      const rotation = Math.PI;
      const m = mat3FromRotation(rotation);

      expect(m.m11).toBeCloseTo(-1);
      expect(m.m22).toBeCloseTo(-1);
    });

    it('should preserve translation row', () => {
      const rotation = Math.PI / 2;
      const m = mat3FromRotation(rotation);

      expect(m.m13).toBeCloseTo(0);
      expect(m.m23).toBeCloseTo(0);
    });
  });

  describe('decomposeSRTMat3', () => {
    it('should decompose identity matrix', () => {
      const identity = Mat3.IDENTITY;
      const result = decomposeSRTMat3(identity);

      expect(result.translation.x).toBeCloseTo(0);
      expect(result.translation.y).toBeCloseTo(0);
      expect(result.scale.x).toBeCloseTo(1);
      expect(result.scale.y).toBeCloseTo(1);
      expect(result.rotation).toBeCloseTo(0);
    });

    it('should decompose translation matrix', () => {
      const m = mat3FromTranslation(new Vec2(10, 20));
      const result = decomposeSRTMat3(m);

      expect(result.translation.x).toBeCloseTo(10);
      expect(result.translation.y).toBeCloseTo(20);
      expect(result.scale.x).toBeCloseTo(1);
      expect(result.scale.y).toBeCloseTo(1);
    });

    it('should decompose scale matrix', () => {
      const m = mat3FromScale(new Vec2(2, 3));
      const result = decomposeSRTMat3(m);

      expect(result.scale.x).toBeCloseTo(2);
      expect(result.scale.y).toBeCloseTo(3);
      expect(result.translation.x).toBeCloseTo(0);
      expect(result.translation.y).toBeCloseTo(0);
    });

    it('should decompose rotation matrix', () => {
      const m = mat3FromRotation(Math.PI / 2);
      const result = decomposeSRTMat3(m);

      expect(result.rotation).toBeCloseTo(Math.PI / 2);
      expect(Math.abs(result.scale.x)).toBeCloseTo(1);
      expect(Math.abs(result.scale.y)).toBeCloseTo(1);
    });

    it('should decompose combined SRT matrix', () => {
      const translation = new Vec2(10, 20);
      const rotation = Math.PI / 4;
      const scale = new Vec2(2, 3);
      const m = mat3FromSRT(translation, rotation, scale);
      const result = decomposeSRTMat3(m);

      expect(result.translation.x).toBeCloseTo(10);
      expect(result.translation.y).toBeCloseTo(20);
      expect(result.scale.x).toBeCloseTo(2);
      expect(result.scale.y).toBeCloseTo(3);
      expect(result.rotation).toBeCloseTo(Math.PI / 4);
    });
  });
});
