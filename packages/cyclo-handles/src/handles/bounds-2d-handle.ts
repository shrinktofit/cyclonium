import { HandleProvider } from '../handle-provider.js';
import type { Bounds2D } from '@cyclonium/core/math/bounds-2d';
import { Vec2 } from '@cyclonium/core/math/vec2';
import type { HandleContext } from '../handle-context.js';
import { PointHandleProvider } from './point-handle.js';
import { LineSegmentHandleLockFlag, LineSegmentHandleProvider } from './line-segment-handle.js';
import { Ref } from '../ref.js';
import { Color, Quat, Vec3 } from 'cc';

export enum RectHandleLockFlag {
  lockTopEdge = 1 << 0,
  lockBottomEdge = 1 << 1,
  lockLeftEdge = 1 << 2,
  lockRightEdge = 1 << 3,

  lockTopLeft = lockTopEdge | lockLeftEdge,
  lockTopRight = lockTopEdge | lockRightEdge,
  lockBottomLeft = lockBottomEdge | lockLeftEdge,
  lockBottomRight = lockBottomEdge | lockRightEdge,
  lockAllEdges = lockTopEdge | lockBottomEdge | lockLeftEdge | lockRightEdge,

  lockCenter = 1 << 4,

  lockAspectRatio = 1 << 5,
}

const cornerPointStyle = {
  color: new Color(Color.BLACK),
  wireframe: true,
};

const centerPointStyle = cornerPointStyle;

export class Bounds2DHandleProvider extends HandleProvider {
  constructor() {
    super();
    this._pointHandleProvider = new PointHandleProvider();
    this._lineSegmentHandleProvider = new LineSegmentHandleProvider();
    this._cacheEssentials = {
      centerPoint: new Vec2(),
      leftTopPoint: new Vec2(),
      rightTopPoint: new Vec2(),
      leftBottomPoint: new Vec2(),
      rightBottomPoint: new Vec2(),
      topEdge: new Ref<number>(0),
      bottomEdge: new Ref<number>(0),
      leftEdge: new Ref<number>(0),
      rightEdge: new Ref<number>(0),
    };
  }

  draw(ctx: HandleContext, bounds: Bounds2D, opts?: {
    lock?: RectHandleLockFlag;
  }): boolean {
    const essentials = this._cacheEssentials;
    const {
      centerPoint,
      leftTopPoint,
      rightTopPoint,
      leftBottomPoint,
      rightBottomPoint,
      topEdge,
      bottomEdge,
      leftEdge,
      rightEdge,
    } = essentials;
    const {
      lock = 0,
    } = opts || {};

    const rotationQuat: Quat | undefined = undefined;
    const baseRight = Vec3.UNIT_X;
    const baseUp = Vec3.UNIT_Y;
    ctx.renderer.drawRect({
      center: new Vec3(bounds.center.x, bounds.center.y, 0),
      halfExtent: bounds.size.mulScalar(0.5),
      right: rotationQuat ? Vec3.transformQuat(new Vec3(), baseRight, rotationQuat) : baseRight,
      up: rotationQuat ? Vec3.transformQuat(new Vec3(), baseUp, rotationQuat) : baseUp,
      color: new Color(255, 255, 255, 128),
      unlit: true,
      wireframe: false,
    });

    const pointSize = Math.min(bounds.size.x, bounds.size.y) * 0.1;
    const edgeWidth = pointSize * 0.5;

    const mirrorOperation: boolean = ctx.input.mouseAltKey && ctx.input.mouseCtrlKey && ctx.input.mouseShiftKey;

    let centerChanged = false;
    centerPoint.copyFrom(bounds.center);
    if (this._drawPoint(ctx, centerPoint, centerPointStyle, pointSize, !!(lock & RectHandleLockFlag.lockCenter))) {
      bounds.center = centerPoint;
      centerChanged = true;
    }
    const min = new Vec2().copyFrom(bounds.min);
    const max = new Vec2().copyFrom(bounds.max);
    let minMaxChanged = false;

    {
      const pointModel = leftTopPoint;
      const inputX = min.x;
      const inputY = max.y;
      pointModel.set(inputX, inputY);
      if (this._drawPoint(ctx, pointModel, cornerPointStyle, pointSize, !!(lock & RectHandleLockFlag.lockTopLeft))) {
        const { x, y } = pointModel;
        if (mirrorOperation) {
          const dx = x - inputX;
          const dy = y - inputY;
          this._applyMirror(min, max, -dx, dy);
        } else {
          min.x = x;
          max.y = y;
        }
        minMaxChanged = true;
      }
    }

    {
      const pointModel = rightTopPoint;
      const inputX = max.x;
      const inputY = max.y;
      pointModel.set(inputX, inputY);
      if (this._drawPoint(ctx, pointModel, cornerPointStyle, pointSize, !!(lock & RectHandleLockFlag.lockTopRight))) {
        const { x, y } = pointModel;
        if (mirrorOperation) {
          const dx = x - inputX;
          const dy = y - inputY;
          this._applyMirror(min, max, dx, dy);
        } else {
          max.x = x;
          max.y = y;
        }
        minMaxChanged = true;
      }
    }

    {
      const pointModel = rightBottomPoint;
      const inputX = max.x;
      const inputY = min.y;
      pointModel.set(inputX, inputY);
      if (this._drawPoint(ctx, pointModel, cornerPointStyle, pointSize, !!(lock & RectHandleLockFlag.lockBottomRight))) {
        const { x, y } = pointModel;
        if (mirrorOperation) {
          const dx = x - inputX;
          const dy = y - inputY;
          this._applyMirror(min, max, dx, -dy);
        } else {
          max.x = x;
          min.y = y;
        }
        minMaxChanged = true;
      }
    }

    {
      const pointModel = leftBottomPoint;
      const inputX = min.x;
      const inputY = min.y;
      pointModel.set(inputX, inputY);
      if (this._drawPoint(ctx, pointModel, cornerPointStyle, pointSize, !!(lock & RectHandleLockFlag.lockBottomLeft))) {
        const { x, y } = pointModel;
        if (mirrorOperation) {
          const dx = x - inputX;
          const dy = y - inputY;
          this._applyMirror(min, max, -dx, -dy);
        } else {
          min.x = x;
          min.y = y;
        }
        minMaxChanged = true;
      }
    }

    topEdge.value = min.y;
    if (this._drawEdge(ctx, leftTopPoint, rightTopPoint, topEdge, !!(lock & RectHandleLockFlag.lockTopEdge), edgeWidth)) {
      min.y = topEdge.value;
      minMaxChanged = true;
    }

    bottomEdge.value = max.y;
    if (this._drawEdge(ctx, leftBottomPoint, rightBottomPoint, bottomEdge, !!(lock & RectHandleLockFlag.lockBottomEdge), edgeWidth)) {
      max.y = bottomEdge.value;
      minMaxChanged = true;
    }

    leftEdge.value = min.x;
    if (this._drawEdge(ctx, leftTopPoint, leftBottomPoint, leftEdge, !!(lock & RectHandleLockFlag.lockLeftEdge), edgeWidth)) {
      min.x = leftEdge.value;
      minMaxChanged = true;
    }

    rightEdge.value = max.x;
    if (this._drawEdge(ctx, rightTopPoint, rightBottomPoint, rightEdge, !!(lock & RectHandleLockFlag.lockRightEdge), edgeWidth)) {
      max.x = rightEdge.value;
      minMaxChanged = true;
    }

    if (minMaxChanged) {
      bounds.setMinMax(min, max);
    }

    return centerChanged || minMaxChanged;
  }

  private readonly _pointHandleProvider: PointHandleProvider;
  private readonly _lineSegmentHandleProvider: LineSegmentHandleProvider;
  private readonly _cacheEssentials: RectHandleEssentials;

  private _drawPoint(ctx: HandleContext, point: Vec2, style: typeof cornerPointStyle, size: number, locked: boolean) {
    return this._pointHandleProvider.drawSquaredPoint2D(ctx, point, {
      lock: locked,
      style,
      size,
    });
  }

  private _drawEdge(ctx: HandleContext, start: Vec2, end: Vec2, edge: Ref<number>, locked: boolean, edgeWidth: number) {
    return this._lineSegmentHandleProvider.drawEdge2D(
      ctx,
      edge,
      undefined,
      {
        start,
        end,
        lock: locked ? true : LineSegmentHandleLockFlag.lockForwardBackward,
        width: edgeWidth,
      },
    );
  }

  private _applyMirror(min: Vec2, max: Vec2, dxMax: number, dyMax: number) {
    max.x += dxMax;
    max.y += dyMax;
    min.x -= dxMax;
    min.y -= dyMax;
  }
}

interface RectHandleEssentials {
  centerPoint: Vec2;
  leftTopPoint: Vec2;
  rightTopPoint: Vec2;
  leftBottomPoint: Vec2;
  rightBottomPoint: Vec2;
  topEdge: Ref<number>;
  bottomEdge: Ref<number>;
  leftEdge: Ref<number>;
  rightEdge: Ref<number>;
}
