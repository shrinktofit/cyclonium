import { Vec2 } from '@cyclonium/core/math/vec2';
import { px2Impl } from './px2-impl.js';

export function toPx2ImplVec2(input: Vec2, out?: px2Impl.Vector2) {
  if (out) {
    out.x = input.x;
    out.y = input.y;
    return out;
  } else {
    return new px2Impl.Vector2(input.x, input.y);
  }
}

export function fromPx2ImplVec2(input: px2Impl.Vector2, out?: Vec2) {
  if (out) {
    out.x = input.x;
    out.y = input.y;
    return out;
  } else {
    return new Vec2(input.x, input.y);
  }
}
