import type { Vec3 } from 'cc';
import { HandleProvider } from '../handle-provider.js';
import type { HandleContext } from '../handle-context.js';
import type { Ref } from '../ref.js';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { VirtualBox2DHandleProvider } from './virtual-box-2d-handle.js';

export enum LineSegmentHandleLockFlag {
  lockForward = 1 << 0,
  lockBackward = 1 << 1,
  lockOrthogonalLeft = 1 << 2,
  lockOrthogonalRight = 1 << 3,

  lockForwardBackward = lockForward | lockBackward,
  lockOrthogonal = lockOrthogonalLeft | lockOrthogonalRight,
  lockAll = lockForwardBackward | lockOrthogonal,
}

export class LineSegmentHandleProvider extends HandleProvider {
  constructor() {
    super();
  }

  draw(_ctx: HandleContext, _model: { start: Vec3; end: Vec3 }): boolean {
    return false;
  }

  drawEdge2D(ctx: HandleContext, _modelTangent: Ref<number> | undefined, _modelOrthogonal: Ref<number> | undefined, props: {
    start: Vec2;
    end: Vec2;
    width?: number;
    lock?: boolean | LineSegmentHandleLockFlag;
  }): boolean {
    const { start, end } = props;
    const lockProp = props?.lock;
    const lock = typeof lockProp === 'boolean'
      ? (lockProp ? LineSegmentHandleLockFlag.lockAll : 0)
      : (lockProp ?? 0);
    const moved = false;
    const center = start.add(end).mulSelfScalar(0.5);
    const dir = end.sub(start);
    const length = dir.magnitude;
    dir.normalizeSelf();
    const rotation = dir.atan2();
    const width = props?.width ?? 1;
    this._virtualBox2DHandleProvider.drawVirtualBox(
      ctx,
      center,
      {
        size: new Vec2(length, width),
        rotation,
        onWantMove: (newPosition) => {
          if ((lock & LineSegmentHandleLockFlag.lockAll) === LineSegmentHandleLockFlag.lockAll) {
            return;
          }
          const movement = newPosition.sub(center);
          const tangent = dir;
          const { b, lengthA, lengthB } = decomposeCacheResult(movement, dir);
          if (lengthA > 0) {
            if (!(lock & LineSegmentHandleLockFlag.lockForward)) {
              center.addMulScalarSelf(tangent, lengthA);
            }
          } else if (lengthA < 0) {
            if (!(lock & LineSegmentHandleLockFlag.lockBackward)) {
              center.addMulScalarSelf(tangent, -lengthA);
            }
          }
          if (lengthB > 0) {
            if (!(lock & LineSegmentHandleLockFlag.lockOrthogonalLeft)) {
              center.addMulScalarSelf(b, lengthB);
            }
          } else if (lengthB < 0) {
            if (!(lock & LineSegmentHandleLockFlag.lockOrthogonalRight)) {
              center.addMulScalarSelf(b, lengthB);
            }
          }
        },
      },
    );
    if (moved) {
      return true;
    }
    return false;
  }

  private _virtualBox2DHandleProvider = new VirtualBox2DHandleProvider();
}

const decomposeCacheResult = (() => {
  const cacheOrthogonal = new Vec2();
  const cacheResult = {
    lengthA: 0,
    lengthB: 0,
    b: cacheOrthogonal,
  };
  return (input: Vec2, dir: Vec2) => {
    const orthonormal = cacheOrthogonal.copyFrom(dir.orthonormal());
    const lengthA = Vec2.dot(input, dir);
    const lengthB = Vec2.dot(input, orthonormal);
    cacheResult.lengthA = lengthA;
    cacheResult.lengthB = lengthB;
    return cacheResult;
  };
})();
