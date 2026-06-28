import { Color, Vec3 } from 'cc';

import {
  appendBoxFill,
  appendBoxStroke,
  appendCircleFill,
  appendCircleStroke,
  appendSubPathFill,
  appendSubPathStroke,
  createMeshGeometry,
  epsilon,
  normalizeArcDelta,
  normalizeLineDash,
  resolveHalfExtents,
  resolvePoint,
  roundSegmentRadians,
  setColor,
} from './geometry.js';
import { Canvas3DLineCap, Canvas3DLineJoin, PathEntryType } from './types.js';
import type { Canvas3DW2, EnqueueGeometry, PathEntry, StrokeStyle, SubPath } from './types.js';

export class Canvas3DW2Impl implements Canvas3DW2 {
  constructor(enqueueGeometry: EnqueueGeometry) {
    this._enqueueGeometry = enqueueGeometry;
  }

  get lineWidth(): number {
    return this._lineWidth;
  }

  set lineWidth(value: number) {
    this._lineWidth = Math.max(0, value);
  }

  get strokeWidth(): number {
    return this._lineWidth;
  }

  set strokeWidth(value: number) {
    this.lineWidth = value;
  }

  get lineJoin(): Canvas3DLineJoin {
    return this._lineJoin;
  }

  set lineJoin(value: Canvas3DLineJoin) {
    this._lineJoin = value;
  }

  get lineCap(): Canvas3DLineCap {
    return this._lineCap;
  }

  set lineCap(value: Canvas3DLineCap) {
    this._lineCap = value;
  }

  get miterLimit(): number {
    return this._miterLimit;
  }

  set miterLimit(value: number) {
    this._miterLimit = Math.max(0, value);
  }

  get lineDash(): number[] {
    return this.getLineDash();
  }

  set lineDash(value: readonly number[]) {
    this.setLineDash(value);
  }

  get lineDashOffset(): number {
    return this._lineDashOffset;
  }

  set lineDashOffset(value: number) {
    this._lineDashOffset = Number.isFinite(value) ? value : 0;
  }

  get strokeColor(): Color {
    return this._strokeColor;
  }

  set strokeColor(value: Color) {
    this._strokeColor.set(value);
  }

  get fillColor(): Color {
    return this._fillColor;
  }

  set fillColor(value: Color) {
    this._fillColor.set(value);
  }

  get strokeStyle(): Color {
    return this.strokeColor;
  }

  set strokeStyle(value: Readonly<Color> | string) {
    setColor(this._strokeColor, value);
  }

  get fillStyle(): Color {
    return this.fillColor;
  }

  set fillStyle(value: Readonly<Color> | string) {
    setColor(this._fillColor, value);
  }

  beginPath(): this {
    this._pathEntries.length = 0;
    this._currentSubPath = undefined;
    this._hasCurrentPoint = false;
    return this;
  }

  closePath(): this {
    if (!this._currentSubPath) {
      return this;
    }
    this._currentSubPath.closed = true;
    const firstPoint = this._currentSubPath.points[0];
    if (firstPoint) {
      this._currentPoint.set(firstPoint);
      this._hasCurrentPoint = true;
    }
    return this;
  }

  moveTo(point: Vec3): this;
  moveTo(x: number, y: number, z?: number): this;
  moveTo(pointOrX: Vec3 | number, y?: number, z?: number): this {
    const point = resolvePoint(pointOrX, y, z);
    const subPath: SubPath = {
      points: [point],
      closed: false,
    };
    this._pathEntries.push({
      type: PathEntryType.subPath,
      subPath,
    });
    this._currentSubPath = subPath;
    this._currentPoint.set(point);
    this._hasCurrentPoint = true;
    return this;
  }

  lineTo(point: Vec3): this;
  lineTo(x: number, y: number, z?: number): this;
  lineTo(pointOrX: Vec3 | number, y?: number, z?: number): this {
    const point = resolvePoint(pointOrX, y, z);
    if (!this._currentSubPath) {
      return this.moveTo(point);
    }
    this._currentSubPath.points.push(point);
    this._currentPoint.set(point);
    this._hasCurrentPoint = true;
    return this;
  }

  rect(x: number, y: number, width: number, height: number, z: number = 0): this {
    const subPath: SubPath = {
      points: [
        new Vec3(x, y, z),
        new Vec3(x + width, y, z),
        new Vec3(x + width, y + height, z),
        new Vec3(x, y + height, z),
      ],
      closed: true,
    };
    this._pathEntries.push({
      type: PathEntryType.subPath,
      subPath,
    });
    this._currentSubPath = subPath;
    this._currentPoint.set(subPath.points[0]);
    this._hasCurrentPoint = true;
    return this;
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise: boolean = false, z: number = 0): this {
    if (radius <= 0) {
      return this;
    }

    const delta = normalizeArcDelta(startAngle, endAngle, counterclockwise);
    const segmentCount = Math.max(1, Math.ceil(Math.abs(delta) / roundSegmentRadians));
    for (let iSegment = 0; iSegment <= segmentCount; iSegment++) {
      const angle = startAngle + delta * iSegment / segmentCount;
      const point = new Vec3(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        z,
      );
      if (iSegment === 0 && !this._currentSubPath) {
        this.moveTo(point);
      } else {
        this.lineTo(point);
      }
    }
    return this;
  }

  ray(dir: Vec3, length: number): this {
    const normalizedDir = dir.clone();
    if (normalizedDir.lengthSqr() <= epsilon) {
      return this;
    }
    normalizedDir.normalize();
    const start = this._hasCurrentPoint ? this._currentPoint.clone() : Vec3.ZERO.clone();
    const end = Vec3.scaleAndAdd(new Vec3(), start, normalizedDir, length);
    if (!this._currentSubPath) {
      this.moveTo(start);
    }
    this.lineTo(end);
    return this;
  }

  box(center: Vec3, halfExtents: number | Vec3): this {
    this._pathEntries.push({
      type: PathEntryType.box,
      center: center.clone(),
      halfExtents: resolveHalfExtents(halfExtents),
    });
    return this;
  }

  circle(center: Vec3, radius: number): this {
    this._pathEntries.push({
      type: PathEntryType.circle,
      center: center.clone(),
      radius: Math.max(0, radius),
    });
    return this;
  }

  stroke(): this {
    const color = this._strokeColor.clone();
    const strokeStyle = this._createStrokeStyle();
    if (strokeStyle.lineWidth <= 0) {
      return this;
    }

    const geometry = createMeshGeometry();
    for (const entry of this._pathEntries) {
      switch (entry.type) {
      case PathEntryType.subPath:
        appendSubPathStroke(geometry, entry.subPath, strokeStyle, color);
        break;
      case PathEntryType.box:
        appendBoxStroke(geometry, entry.center, entry.halfExtents, strokeStyle, color);
        break;
      case PathEntryType.circle:
        appendCircleStroke(geometry, entry.center, entry.radius, strokeStyle, color);
        break;
      }
    }
    this._enqueueGeometry(geometry);
    return this;
  }

  fill(): this {
    const color = this._fillColor.clone();
    const geometry = createMeshGeometry();
    for (const entry of this._pathEntries) {
      switch (entry.type) {
      case PathEntryType.subPath:
        appendSubPathFill(geometry, entry.subPath, color);
        break;
      case PathEntryType.box:
        appendBoxFill(geometry, entry.center, entry.halfExtents, color);
        break;
      case PathEntryType.circle:
        appendCircleFill(geometry, entry.center, entry.radius, color);
        break;
      }
    }
    this._enqueueGeometry(geometry);
    return this;
  }

  getLineDash(): number[] {
    return this._lineDash.slice();
  }

  setLineDash(value: readonly number[]): void {
    this._lineDash = normalizeLineDash(value);
  }

  private _createStrokeStyle(): StrokeStyle {
    return {
      lineWidth: this._lineWidth,
      lineJoin: this._lineJoin,
      lineCap: this._lineCap,
      miterLimit: this._miterLimit,
      lineDash: this.getLineDash(),
      lineDashOffset: this._lineDashOffset,
    };
  }

  private _lineWidth: number = 1;
  private _lineJoin: Canvas3DLineJoin = Canvas3DLineJoin.miter;
  private _lineCap: Canvas3DLineCap = Canvas3DLineCap.butt;
  private _miterLimit: number = 10;
  private _lineDash: number[] = [];
  private _lineDashOffset: number = 0;
  private readonly _strokeColor: Color = Color.WHITE.clone();
  private readonly _fillColor: Color = Color.WHITE.clone();
  private readonly _pathEntries: PathEntry[] = [];
  private readonly _currentPoint: Vec3 = new Vec3();
  private readonly _enqueueGeometry: EnqueueGeometry;
  private _currentSubPath: SubPath | undefined = undefined;
  private _hasCurrentPoint = false;
}
