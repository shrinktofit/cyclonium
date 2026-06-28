import { editable, executeInEditMode, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { Collider2D } from '../collider-2d.js';
import { px2Impl } from '../px2-impl.js';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { drawCapsuleCollider2DGizmo } from '#gizmo';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import type { Bounds2D } from '@cyclonium/core/math/bounds-2d';
import { Vec2 } from '@cyclonium/core/math/vec2';

@cycloBuiltinClass('CapsuleCollider2D')
@executeInEditMode
export class CapsuleCollider2D extends Collider2D {
  @editable({
    min: 0,
  })
  @idem
  get radius() {
    return this._radius;
  }

  set radius(value: number) {
    this._radius = value;
    this._implCollider?.setRadius(this._getRadius());
  }

  @editable({
    min: 0,
  })
  @idem
  get halfHeight() {
    return this._halfHeight;
  }

  set halfHeight(value: number) {
    this._halfHeight = value;
    this._implCollider?.setHalfHeight(this._halfHeight);
  }

  protected override getShape() {
    return new px2Impl.Capsule(this._halfHeight, this._getRadius());
  }

  protected override computeShapeBounds(out: Bounds2D): void {
    const scale = this.sceneGraphScale;
    const uniformScale = scale.x;
    out.setCenterSize(
      Vec2.ZERO,
      new Vec2(this._radius * 2, this._halfHeight + this._radius * 2).mulSelfScalar(uniformScale),
    );
  }

  protected override onUpdate(): void {
    if (EDITOR_NOT_IN_PREVIEW) {
      drawCapsuleCollider2DGizmo(this);
    }
  }

  protected override updateSceneGraphScale(): void {
    this._implCollider?.setRadius(this._getRadius());
  }

  @serializable
  private _radius = 1;

  @serializable
  private _halfHeight = 1;

  private _getRadius() {
    const scale = this.sceneGraphScale;
    if (scale.x !== scale.y) {
      console.warn('CapsuleCollider2D should have uniform scale');
    }
    return this._radius * scale.x;
  }
}
