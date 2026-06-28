import type { Vec2 } from '@cyclonium/core/math/vec2';
import { Color, Node, Vec3 } from 'cc';
import { Canvas3D } from '@cyclonium/canvas-3d';

export class HandleRenderer {
  constructor(opts: { node: Node }) {
    this._canvas = new Canvas3D(opts);
  }

  destroy_internal() {
    this._canvas.destroy();
  }

  startFrame() {
  }

  endFrame() {
    this._canvas.commit();
  }

  drawRect(_opts: {
    center: Vec3;
    halfExtent: Vec2;
    right?: Vec3;
    up?: Vec3;
    color?: Color;
    unlit?: boolean;
    wireframe?: boolean;
  }) {
  }

  drawLine2D(opts: {
    from: Vec2;
    to: Vec2;
    color?: Color;
    thickness?: number;
    z?: number;
  }) {
    this._canvas.beginPath();
    this._canvas.moveTo(new Vec3(opts.from.x, opts.from.y, opts.z ?? 0));
    this._canvas.lineTo(new Vec3(opts.to.x, opts.to.y, opts.z ?? 0));
    this._canvas.strokeColor = opts.color ?? Color.WHITE;
    this._canvas.lineWidth = opts.thickness ?? 1;
    this._canvas.stroke();
  }

  drawPolyline2D({
    points,
    close = false,
    color = Color.WHITE,
    thickness = 1,
    z = 0,
  }: {
    points: Vec2[];
    close?: boolean;
    color?: Color;
    thickness?: number;
    z?: number;
  }) {
    if (points.length === 0) {
      return;
    }
    this._canvas.beginPath();
    this._canvas.moveTo(new Vec3(points[0].x, points[0].y, z));
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      this._canvas.lineTo(new Vec3(point.x, point.y, z));
    }
    if (close) {
      this._canvas.closePath();
    }
    this._canvas.strokeColor = color;
    this._canvas.lineWidth = thickness;
    this._canvas.stroke();
  }

  drawBox2D(opts: {
    center: Vec3;
    halfExtent: number | Vec2;
    color?: Color;
    wireframe?: boolean;
  }) {
    this._canvas.beginPath();
    this._canvas.box(opts.center, typeof opts.halfExtent === 'number' ? opts.halfExtent : new Vec3(opts.halfExtent.x, opts.halfExtent.y, 0));
    if (opts.wireframe) {
      this._canvas.strokeColor = opts.color ?? Color.WHITE;
      this._canvas.stroke();
    } else {
      this._canvas.fillColor = opts.color ?? Color.WHITE;
      this._canvas.fill();
    }
  }

  private _canvas: Canvas3D;
}
