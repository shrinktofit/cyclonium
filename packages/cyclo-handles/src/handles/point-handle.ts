import { Vec2 } from '@cyclonium/core/math/vec2';
import type { HandleContext } from '../handle-context.js';
import { HandleProvider } from '../handle-provider.js';
import type { Vec3 } from 'cc';
import { VirtualBox2DHandleProvider } from './virtual-box-2d-handle.js';
import type { Color } from 'cc';

export enum PointHandleLockFlag {
  x = 1 << 0,
  y = 1 << 1,
  z = 1 << 2,
  all = x | y | z,
}

export class PointHandleProvider extends HandleProvider {
  constructor() {
    super();
  }

  draw(_ctx: HandleContext, _model: Vec3): boolean {
    return false;
  }

  drawSquaredPoint2D(ctx: HandleContext, model: Vec2, props?: {
    size?: number;
    lock?: boolean | PointHandleLockFlag;
    style?: {
      color?: Color;
    };
  }): boolean {
    const lockProp = props?.lock;
    const lock = typeof lockProp === 'boolean'
      ? (lockProp ? PointHandleLockFlag.all : 0)
      : (lockProp ?? 0);
    const sizeProps = props?.size;
    const size = sizeProps ? new Vec2(sizeProps, sizeProps) : Vec2.ONE;
    let moved = false;
    this._virtualBox2DHandleProvider.drawVirtualBox(
      ctx,
      model,
      {
        size,
        style: props?.style,
        onWantMove: (newPosition) => {
          if (!(lock & PointHandleLockFlag.x)) {
            model.x = newPosition.x;
            moved = true;
          }
          if (!(lock & PointHandleLockFlag.y)) {
            model.y = newPosition.y;
            moved = true;
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
