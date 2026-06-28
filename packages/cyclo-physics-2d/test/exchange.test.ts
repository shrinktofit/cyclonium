import { describe, it, expect } from 'vitest';
import { toPx2ImplVec2, fromPx2ImplVec2 } from '@/exchange.js';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { px2Impl } from '@/px2-impl.js';

describe('exchange', () => {
  describe('toPx2ImplVec2', () => {
    it('should convert Vec2 to px2Impl Vector2', () => {
      const input = new Vec2(1.5, 2.5);
      const result = toPx2ImplVec2(input);
      expect(result.x).toBe(1.5);
      expect(result.y).toBe(2.5);
    });

    it('should use provided out parameter', () => {
      const input = new Vec2(3, 4);
      const out = new px2Impl.Vector2(0, 0);
      const result = toPx2ImplVec2(input, out);
      expect(result).toBe(out);
      expect(out.x).toBe(3);
      expect(out.y).toBe(4);
    });
  });

  describe('fromPx2ImplVec2', () => {
    it('should convert px2Impl Vector2 to Vec2', () => {
      const input = new px2Impl.Vector2(1.5, 2.5);
      const result = fromPx2ImplVec2(input);
      expect(result.x).toBe(1.5);
      expect(result.y).toBe(2.5);
    });

    it('should use provided out parameter', () => {
      const input = new px2Impl.Vector2(3, 4);
      const out = new Vec2(0, 0);
      const result = fromPx2ImplVec2(input, out);
      expect(result).toBe(out);
      expect(out.x).toBe(3);
      expect(out.y).toBe(4);
    });
  });
});
