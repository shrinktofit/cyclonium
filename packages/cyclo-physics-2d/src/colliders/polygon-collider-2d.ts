import { Collider2D } from '../collider-2d.js';
import { px2Impl } from '../px2-impl.js';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Bounds2D } from '@cyclonium/core/math/bounds-2d';

@cycloBuiltinClass('PolygonCollider2D')
export class PolygonCollider2D extends Collider2D {
  get points() {
    return this._points;
  }

  setPolygon(points: Vec2[], indices?: ArrayLike<number>) {
    this._points = points.slice().map((v) => v.clone());
    this._indices = indices ? Uint32Array.from(indices) : undefined;
    this._updateShape();
  }

  protected override getShape(): px2Impl.Shape {
    return this._makeShape();
  }

  protected override computeShapeBounds(out: Bounds2D): void {
    const scale = this.sceneGraphScale;
    out.setMinMax(Vec2.POSITIVE_INFINITY, Vec2.NEGATIVE_INFINITY);
    const p = new Vec2();
    for (const point of this._points) {
      out.extend(p.copyFrom(point).mulSelf(scale));
    }
  }

  protected override updateSceneGraphScale(): void {
    this._updateShape();
  }

  private _points: Vec2[] = [];
  private _indices: Uint32Array | undefined = undefined;

  private _updateShape(): void {
    this._implCollider?.setShape(this._makeShape());
  }

  private _makeShape(): px2Impl.Polyline {
    const scale = this.sceneGraphScale;
    const flatVertices = new Float32Array(this._points.length * 2);
    for (let i = 0; i < this._points.length; i++) {
      const point = this._points[i];
      flatVertices[i * 2] = point.x * scale.x;
      flatVertices[i * 2 + 1] = point.y * scale.y;
    }
    return new px2Impl.Polyline(flatVertices, this._indices);
  }
}
