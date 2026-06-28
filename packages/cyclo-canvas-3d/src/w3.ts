import { Mat4, Vec3 } from 'cc';
import type { Color } from 'cc';

import {
  copyPrimitiveDrawState,
  createQuadCorners,
  createPrimitiveDrawState,
  drawPrimitive,
  normalizeLineDash,
  PrimitiveEntryType,
  resolveCapsule,
  resolveCapsuleSegments,
  resolveCylinder,
  resolveCylinderSegments,
  resolveDiscSegments,
  resolveDiscRadius,
  resolveHalfExtents,
  resolveRingRadii,
  resolveRingSegments,
  resolveSphereSegments,
  setColor,
} from './geometry.js';
import type {
  Canvas3DBoxOptions,
  Canvas3DCapsuleOptions,
  Canvas3DCylinderOptions,
  Canvas3DDiscOptions,
  Canvas3DLineCap,
  Canvas3DLineJoin,
  Canvas3DLineOptions,
  Canvas3DQuadOptions,
  Canvas3DRingOptions,
  Canvas3DSphereOptions,
  Canvas3DW3,
  Canvas3DW3Scope,
  EnqueueGeometry,
  PrimitiveDrawState,
} from './types.js';

export class Canvas3DW3Impl implements Canvas3DW3 {
  constructor(enqueueGeometry: EnqueueGeometry) {
    this._enqueueGeometry = enqueueGeometry;
    this._directScope = new Canvas3DW3ScopeImpl(enqueueGeometry);
  }

  scope(draw: (w3: Canvas3DW3Scope) => void): this {
    draw(new Canvas3DW3ScopeImpl(this._enqueueGeometry));
    return this;
  }

  line(options: Canvas3DLineOptions): this {
    this._drawDirect((scope) => {
      scope.line(options);
    });
    return this;
  }

  box(options: Canvas3DBoxOptions): this {
    this._drawDirect((scope) => {
      scope.box(options);
    });
    return this;
  }

  quad(options: Canvas3DQuadOptions): this {
    this._drawDirect((scope) => {
      scope.quad(options);
    });
    return this;
  }

  cylinder(options: Canvas3DCylinderOptions): this {
    this._drawDirect((scope) => {
      scope.cylinder(options);
    });
    return this;
  }

  disc(options: Canvas3DDiscOptions): this {
    this._drawDirect((scope) => {
      scope.disc(options);
    });
    return this;
  }

  ring(options: Canvas3DRingOptions): this {
    this._drawDirect((scope) => {
      scope.ring(options);
    });
    return this;
  }

  sphere(options: Canvas3DSphereOptions): this {
    this._drawDirect((scope) => {
      scope.sphere(options);
    });
    return this;
  }

  capsule(options: Canvas3DCapsuleOptions): this {
    this._drawDirect((scope) => {
      scope.capsule(options);
    });
    return this;
  }

  private _drawDirect(draw: (scope: Canvas3DW3ScopeImpl) => void): void {
    draw(this._directScope);
  }

  private readonly _enqueueGeometry: EnqueueGeometry;
  private readonly _directScope: Canvas3DW3ScopeImpl;
}

class Canvas3DW3ScopeImpl implements Canvas3DW3Scope {
  constructor(enqueueGeometry: EnqueueGeometry) {
    this._enqueueGeometry = enqueueGeometry;
  }

  get lineWidth(): number {
    return this._state.lineWidth;
  }

  set lineWidth(value: number) {
    this._state.lineWidth = Math.max(0, value);
  }

  get lineJoin(): Canvas3DLineJoin {
    return this._state.lineJoin;
  }

  set lineJoin(value: Canvas3DLineJoin) {
    this._state.lineJoin = value;
  }

  get lineCap(): Canvas3DLineCap {
    return this._state.lineCap;
  }

  set lineCap(value: Canvas3DLineCap) {
    this._state.lineCap = value;
  }

  get lineDash(): number[] {
    return this.getLineDash();
  }

  set lineDash(value: readonly number[]) {
    this.setLineDash(value);
  }

  get lineDashOffset(): number {
    return this._state.lineDashOffset;
  }

  set lineDashOffset(value: number) {
    this._state.lineDashOffset = Number.isFinite(value) ? value : 0;
  }

  get strokeColor(): Color {
    return this._state.strokeColor;
  }

  set strokeColor(value: Color) {
    this._state.strokeColor.set(value);
  }

  get fillColor(): Color {
    return this._state.fillColor;
  }

  set fillColor(value: Color) {
    this._state.fillColor.set(value);
  }

  color(value: Readonly<Color> | string): this {
    setColor(this._state.fillColor, value);
    setColor(this._state.strokeColor, value);
    return this;
  }

  depthTest(value: boolean = true): this {
    this._state.depthTest = value;
    return this;
  }

  depthWrite(value: boolean = true): this {
    this._state.depthWrite = value;
    return this;
  }

  save(): this {
    const state = this._stateStack[this._stateStackDepth] ??= createPrimitiveDrawState();
    copyPrimitiveDrawState(state, this._state);
    this._stateStackDepth++;
    return this;
  }

  restore(): this {
    if (this._stateStackDepth > 0) {
      this._stateStackDepth--;
      copyPrimitiveDrawState(this._state, this._stateStack[this._stateStackDepth]);
    }
    return this;
  }

  resetTransform(): this {
    Mat4.identity(this._state.transform);
    return this;
  }

  setTransform(transform: Mat4): this {
    this._state.transform.set(transform);
    return this;
  }

  transform(transform: Mat4): this {
    Mat4.multiply(this._state.transform, this._state.transform, transform);
    return this;
  }

  translate(x: number, y: number, z: number = 0): this {
    Mat4.transform(this._state.transform, this._state.transform, new Vec3(x, y, z));
    return this;
  }

  scale(x: number, y: number = x, z: number = x): this {
    Mat4.scale(this._state.transform, this._state.transform, new Vec3(x, y, z));
    return this;
  }

  rotate(rad: number, axis: Vec3): this {
    Mat4.rotate(this._state.transform, this._state.transform, rad, axis);
    return this;
  }

  rotateX(rad: number): this {
    Mat4.rotateX(this._state.transform, this._state.transform, rad);
    return this;
  }

  rotateY(rad: number): this {
    Mat4.rotateY(this._state.transform, this._state.transform, rad);
    return this;
  }

  rotateZ(rad: number): this {
    Mat4.rotateZ(this._state.transform, this._state.transform, rad);
    return this;
  }

  line(options: Canvas3DLineOptions): this {
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.line,
      from: options.from.clone(),
      to: options.to.clone(),
    }], options);
    return this;
  }

  box(options: Canvas3DBoxOptions): this {
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.box,
      center: options.center.clone(),
      halfExtents: resolveHalfExtents(options.halfExtents),
    }], options);
    return this;
  }

  quad(options: Canvas3DQuadOptions): this {
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.quad,
      corners: createQuadCorners(options),
    }], options);
    return this;
  }

  cylinder(options: Canvas3DCylinderOptions): this {
    const cylinder = resolveCylinder(options);
    const segments = resolveCylinderSegments(options);
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.cylinder,
      from: cylinder.from,
      to: cylinder.to,
      radius: cylinder.radius,
      radialSegments: segments.radialSegments,
      wireSegments: segments.wireSegments,
    }], options);
    return this;
  }

  disc(options: Canvas3DDiscOptions): this {
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.disc,
      center: options.center.clone(),
      normal: options.normal.clone(),
      radius: resolveDiscRadius(options),
      segments: resolveDiscSegments(options),
    }], options);
    return this;
  }

  ring(options: Canvas3DRingOptions): this {
    const radii = resolveRingRadii(options);
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.ring,
      center: options.center.clone(),
      normal: options.normal.clone(),
      innerRadius: radii.innerRadius,
      outerRadius: radii.outerRadius,
      segments: resolveRingSegments(options),
    }], options);
    return this;
  }

  sphere(options: Canvas3DSphereOptions): this {
    const segments = resolveSphereSegments(options);
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.sphere,
      center: options.center.clone(),
      radius: Math.max(0, options.radius),
      latitudeSegments: segments.latitudeSegments,
      longitudeSegments: segments.longitudeSegments,
      wireSegments: segments.wireSegments,
    }], options);
    return this;
  }

  capsule(options: Canvas3DCapsuleOptions): this {
    const capsule = resolveCapsule(options);
    const segments = resolveCapsuleSegments(options);
    drawPrimitive(this._enqueueGeometry, this._state, [{
      type: PrimitiveEntryType.capsule,
      from: capsule.from,
      to: capsule.to,
      radius: capsule.radius,
      radialSegments: segments.radialSegments,
      wireSegments: segments.wireSegments,
      capSegments: segments.capSegments,
    }], options);
    return this;
  }

  getLineDash(): number[] {
    return this._state.lineDash.slice();
  }

  setLineDash(value: readonly number[]): void {
    this._state.lineDash = normalizeLineDash(value);
  }

  private readonly _stateStack: PrimitiveDrawState[] = [];
  private readonly _enqueueGeometry: EnqueueGeometry;
  private _state: PrimitiveDrawState = createPrimitiveDrawState();
  private _stateStackDepth = 0;
}
