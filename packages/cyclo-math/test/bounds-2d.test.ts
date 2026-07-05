import { describe, it, expect } from 'vitest';
import { Bounds2D } from '@/bounds-2d.js';
import { Vec2 } from '@/vec2.js';

describe('Bounds2D', () => {
  describe('static methods', () => {
    describe('fromMinMax', () => {
      it('should create bounds from min and max vectors', () => {
        const min = new Vec2(1, 2);
        const max = new Vec2(3, 4);
        const bounds = Bounds2D.fromMinMax(min, max);

        expect(bounds.xMin).toBe(1);
        expect(bounds.yMin).toBe(2);
        expect(bounds.xMax).toBe(3);
        expect(bounds.yMax).toBe(4);
      });
    });

    describe('fromCenterSize', () => {
      it('should create bounds from center and size vectors', () => {
        const center = new Vec2(5, 5);
        const size = new Vec2(4, 6);
        const bounds = Bounds2D.fromCenterSize(center, size);

        expect(bounds.xMin).toBeCloseTo(3);
        expect(bounds.yMin).toBeCloseTo(2);
        expect(bounds.xMax).toBeCloseTo(7);
        expect(bounds.yMax).toBeCloseTo(8);
      });

      it('should handle zero size', () => {
        const center = new Vec2(0, 0);
        const size = new Vec2(0, 0);
        const bounds = Bounds2D.fromCenterSize(center, size);

        expect(bounds.xMin).toBeCloseTo(0);
        expect(bounds.yMin).toBeCloseTo(0);
        expect(bounds.xMax).toBeCloseTo(0);
        expect(bounds.yMax).toBeCloseTo(0);
      });
    });

    describe('invertedInfinity', () => {
      it('should create bounds ready to extend from any point', () => {
        /// @case
        /// 1. An inverted infinity bounds is created and then extended by a point.
        /// @expect
        /// It starts with inverted infinite min/max values and becomes a point-sized bounds after extension.
        const bounds = Bounds2D.invertedInfinity();

        expect(bounds.xMin).toBe(Number.POSITIVE_INFINITY);
        expect(bounds.yMin).toBe(Number.POSITIVE_INFINITY);
        expect(bounds.xMax).toBe(Number.NEGATIVE_INFINITY);
        expect(bounds.yMax).toBe(Number.NEGATIVE_INFINITY);

        bounds.extend(new Vec2(1, 2));
        expect(bounds.xMin).toBe(1);
        expect(bounds.yMin).toBe(2);
        expect(bounds.xMax).toBe(1);
        expect(bounds.yMax).toBe(2);
      });
    });
  });

  describe('getters and setters', () => {
    describe('min', () => {
      it('should get min vector', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        expect(bounds.min.x).toBe(1);
        expect(bounds.min.y).toBe(2);
      });

      it('should set min vector', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        bounds.min = new Vec2(0, 1);
        expect(bounds.xMin).toBe(0);
        expect(bounds.yMin).toBe(1);
      });
    });

    describe('max', () => {
      it('should get max vector', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        expect(bounds.max.x).toBe(3);
        expect(bounds.max.y).toBe(4);
      });

      it('should set max vector', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        bounds.max = new Vec2(5, 6);
        expect(bounds.xMax).toBe(5);
        expect(bounds.yMax).toBe(6);
      });
    });

    describe('xMin', () => {
      it('should get xMin', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        expect(bounds.xMin).toBe(1);
      });

      it('should set xMin', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        bounds.xMin = 0;
        expect(bounds.xMin).toBe(0);
      });
    });

    describe('yMin', () => {
      it('should get yMin', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        expect(bounds.yMin).toBe(2);
      });

      it('should set yMin', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        bounds.yMin = 1;
        expect(bounds.yMin).toBe(1);
      });
    });

    describe('xMax', () => {
      it('should get xMax', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        expect(bounds.xMax).toBe(3);
      });

      it('should set xMax', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        bounds.xMax = 5;
        expect(bounds.xMax).toBe(5);
      });
    });

    describe('yMax', () => {
      it('should get yMax', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        expect(bounds.yMax).toBe(4);
      });

      it('should set yMax', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        bounds.yMax = 6;
        expect(bounds.yMax).toBe(6);
      });
    });

    describe('center', () => {
      it('should get center vector', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        expect(bounds.center.x).toBeCloseTo(2);
        expect(bounds.center.y).toBeCloseTo(3);
      });

      it('should set center and maintain size', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        const oldSize = { x: bounds.size.x, y: bounds.size.y };
        bounds.center = new Vec2(5, 5);
        expect(bounds.center.x).toBeCloseTo(5);
        expect(bounds.center.y).toBeCloseTo(5);
        expect(bounds.size.x).toBeCloseTo(oldSize.x);
        expect(bounds.size.y).toBeCloseTo(oldSize.y);
      });
    });

    describe('x', () => {
      it('should get x coordinate of center', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        expect(bounds.x).toBeCloseTo(2);
      });

      it('should set x coordinate of center and maintain width', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        const oldWidth = bounds.width;
        bounds.x = 10;
        expect(bounds.x).toBeCloseTo(10);
        expect(bounds.width).toBeCloseTo(oldWidth);
      });
    });

    describe('y', () => {
      it('should get y coordinate of center', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        expect(bounds.y).toBeCloseTo(3);
      });

      it('should set y coordinate of center and maintain height', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        const oldHeight = bounds.height;
        bounds.y = 10;
        expect(bounds.y).toBeCloseTo(10);
        expect(bounds.height).toBeCloseTo(oldHeight);
      });
    });

    describe('size', () => {
      it('should get size vector', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(5, 8));
        expect(bounds.size.x).toBe(4);
        expect(bounds.size.y).toBe(6);
      });

      it('should set size and maintain center', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        const oldCenter = { x: bounds.center.x, y: bounds.center.y };
        bounds.size = new Vec2(10, 10);
        expect(bounds.size.x).toBeCloseTo(10);
        expect(bounds.size.y).toBeCloseTo(10);
        expect(bounds.center.x).toBeCloseTo(oldCenter.x);
        expect(bounds.center.y).toBeCloseTo(oldCenter.y);
      });
    });

    describe('width', () => {
      it('should get width', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(5, 8));
        expect(bounds.width).toBe(4);
      });

      it('should set width', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        bounds.width = 10;
        expect(bounds.xMin).toBeCloseTo(8);
        expect(bounds.xMax).toBeCloseTo(12);
        expect(bounds.center.x).toBeCloseTo(10);
      });
    });

    describe('height', () => {
      it('should get height', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(5, 8));
        expect(bounds.height).toBe(6);
      });

      it('should set height', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 6));
        bounds.height = 10;
        expect(bounds.yMin).toBeCloseTo(7);
        expect(bounds.yMax).toBeCloseTo(13);
        expect(bounds.center.y).toBeCloseTo(10);
      });
    });
  });

  describe('instance methods', () => {
    describe('clone', () => {
      it('should create an independent copy', () => {
        /// @case
        /// 1. A bounds is cloned and the clone is mutated afterwards.
        /// @expect
        /// The clone preserves the original values initially and does not share vectors with the source bounds.
        const source = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        const copy = source.clone();

        expect(copy).not.toBe(source);
        expect(copy.min).not.toBe(source.min);
        expect(copy.max).not.toBe(source.max);
        expect(copy.xMin).toBe(1);
        expect(copy.yMin).toBe(2);
        expect(copy.xMax).toBe(3);
        expect(copy.yMax).toBe(4);

        copy.setMinMax(new Vec2(-1, -2), new Vec2(8, 9));
        expect(source.xMin).toBe(1);
        expect(source.yMin).toBe(2);
        expect(source.xMax).toBe(3);
        expect(source.yMax).toBe(4);
      });
    });

    describe('strictEquals', () => {
      it('should compare bounds coordinates exactly', () => {
        /// @case
        /// 1. Bounds with matching, different, and inverted infinity coordinates are compared exactly.
        /// @expect
        /// Only bounds with identical min/max coordinates are strict-equal.
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        const same = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        const differentMin = Bounds2D.fromMinMax(new Vec2(0, 2), new Vec2(3, 4));
        const differentMax = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 5));

        expect(bounds.strictEquals(same)).toBe(true);
        expect(bounds.strictEquals(differentMin)).toBe(false);
        expect(bounds.strictEquals(differentMax)).toBe(false);
        expect(Bounds2D.invertedInfinity().strictEquals(Bounds2D.invertedInfinity())).toBe(true);
      });
    });

    describe('equals', () => {
      it('should compare bounds coordinates approximately', () => {
        /// @case
        /// 1. Bounds with near, far, and inverted infinity coordinates are compared approximately.
        /// @expect
        /// Near finite values and exact infinities are equal, while values outside epsilon are not.
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(3, 4));
        const near = Bounds2D.fromMinMax(new Vec2(1.0005, 1.9995), new Vec2(2.9995, 4.0005));
        const far = Bounds2D.fromMinMax(new Vec2(1.01, 2), new Vec2(3, 4));

        expect(bounds.equals(near, 0.001)).toBe(true);
        expect(bounds.equals(far, 0.001)).toBe(false);
        expect(Bounds2D.invertedInfinity().equals(Bounds2D.invertedInfinity())).toBe(true);
      });
    });

    describe('contains', () => {
      it('should return true when point is inside bounds', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 4));
        expect(bounds.contains(new Vec2(2, 2))).toBe(true);
      });

      it('should return false when point is outside bounds', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 4));
        expect(bounds.contains(new Vec2(5, 5))).toBe(false);
      });

      it('should return true when point is on boundary', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 4));
        expect(bounds.contains(0, 0)).toBe(true);
        expect(bounds.contains(4, 4)).toBe(true);
        expect(bounds.contains(0, 4)).toBe(true);
        expect(bounds.contains(4, 0)).toBe(true);
      });

      it('should return false when point is just outside boundary', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 4));
        expect(bounds.contains(-0.001, 2)).toBe(false);
        expect(bounds.contains(2, -0.001)).toBe(false);
        expect(bounds.contains(4.001, 2)).toBe(false);
        expect(bounds.contains(2, 4.001)).toBe(false);
      });

      it('should accept x, y number parameters', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(4, 4));
        expect(bounds.contains(2, 2)).toBe(true);
        expect(bounds.contains(5, 5)).toBe(false);
      });

      it('should return true when other bounds is completely inside', () => {
        const outer = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(10, 10));
        const inner = Bounds2D.fromMinMax(new Vec2(2, 2), new Vec2(8, 8));
        expect(outer.contains(inner)).toBe(true);
      });

      it('should return false when other bounds is partially outside', () => {
        const outer = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(10, 10));
        const partial = Bounds2D.fromMinMax(new Vec2(5, 5), new Vec2(15, 15));
        expect(outer.contains(partial)).toBe(false);
      });

      it('should return true when other bounds equals this bounds', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(10, 10));
        expect(bounds.contains(bounds)).toBe(true);
      });
    });

    describe('intersects', () => {
      it('should return true when bounds overlap', () => {
        const a = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(5, 5));
        const b = Bounds2D.fromMinMax(new Vec2(3, 3), new Vec2(8, 8));
        expect(a.intersects(b)).toBe(true);
      });

      it('should return true when bounds touch at edge', () => {
        const a = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(5, 5));
        const b = Bounds2D.fromMinMax(new Vec2(5, 0), new Vec2(10, 5));
        expect(a.intersects(b)).toBe(true);
      });

      it('should return false when bounds do not overlap', () => {
        const a = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(5, 5));
        const b = Bounds2D.fromMinMax(new Vec2(10, 10), new Vec2(15, 15));
        expect(a.intersects(b)).toBe(false);
      });

      it('should return true when one bounds contains another', () => {
        const outer = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(10, 10));
        const inner = Bounds2D.fromMinMax(new Vec2(2, 2), new Vec2(8, 8));
        expect(outer.intersects(inner)).toBe(true);
      });

      it('should return true for identical bounds', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(5, 5));
        expect(bounds.intersects(bounds)).toBe(true);
      });
    });

    describe('setMinMax', () => {
      it('should set min and max vectors', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(1, 1));
        const result = bounds.setMinMax(new Vec2(5, 10), new Vec2(15, 20));
        expect(bounds.xMin).toBe(5);
        expect(bounds.yMin).toBe(10);
        expect(bounds.xMax).toBe(15);
        expect(bounds.yMax).toBe(20);
        expect(result).toBe(bounds);
      });
    });

    describe('setCenterSize', () => {
      it('should set center and size', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(1, 1));
        const result = bounds.setCenterSize(new Vec2(5, 5), new Vec2(4, 6));
        expect(bounds.xMin).toBeCloseTo(3);
        expect(bounds.yMin).toBeCloseTo(2);
        expect(bounds.xMax).toBeCloseTo(7);
        expect(bounds.yMax).toBeCloseTo(8);
        expect(result).toBe(bounds);
      });

      it('should handle zero size', () => {
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(10, 10));
        bounds.setCenterSize(new Vec2(5, 5), new Vec2(0, 0));
        expect(bounds.xMin).toBeCloseTo(5);
        expect(bounds.yMin).toBeCloseTo(5);
        expect(bounds.xMax).toBeCloseTo(5);
        expect(bounds.yMax).toBeCloseTo(5);
      });
    });

    describe('grow', () => {
      it('should expand each edge by delta', () => {
        /// @case
        /// 1. A bounds is grown by a positive delta.
        /// @expect
        /// Each edge moves outward by delta, the center stays fixed, and the method returns this.
        const bounds = Bounds2D.fromMinMax(new Vec2(1, 2), new Vec2(5, 8));
        const result = bounds.grow(2);

        expect(result).toBe(bounds);
        expect(bounds.xMin).toBe(-1);
        expect(bounds.yMin).toBe(0);
        expect(bounds.xMax).toBe(7);
        expect(bounds.yMax).toBe(10);
        expect(bounds.x).toBe(3);
        expect(bounds.y).toBe(5);
        expect(bounds.width).toBe(8);
        expect(bounds.height).toBe(10);
      });

      it('should shrink each edge when delta is negative', () => {
        /// @case
        /// 1. A bounds is grown by a negative delta.
        /// @expect
        /// Each edge moves inward by the absolute delta and the center stays fixed.
        const bounds = Bounds2D.fromMinMax(new Vec2(0, 0), new Vec2(10, 10));

        bounds.grow(-2);

        expect(bounds.xMin).toBe(2);
        expect(bounds.yMin).toBe(2);
        expect(bounds.xMax).toBe(8);
        expect(bounds.yMax).toBe(8);
        expect(bounds.x).toBe(5);
        expect(bounds.y).toBe(5);
        expect(bounds.width).toBe(6);
        expect(bounds.height).toBe(6);
      });
    });
  });
});
