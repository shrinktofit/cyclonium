import { editable, executeInEditMode, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { Collider2D } from '../collider-2d.js';
import { px2Impl } from '../px2-impl.js';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { drawCircleCollider2DGizmo } from '#gizmo';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import type { Bounds2D } from '@cyclonium/core/math/bounds-2d';
import { Vec2 } from '@cyclonium/core/math/vec2';

@cycloBuiltinClass('CircleCollider2D')
@executeInEditMode
export class CircleCollider2D extends Collider2D {
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

  protected override getShape() {
    return new px2Impl.Ball(this._getRadius());
  }

  protected override computeShapeBounds(out: Bounds2D): void {
    out.setCenterSize(
      Vec2.ZERO,
      Vec2.splat(this._getRadius() * 2),
    );
  }

  protected override onUpdate(): void {
    if (EDITOR_NOT_IN_PREVIEW) {
      drawCircleCollider2DGizmo(this);
    }
  }

  protected override updateSceneGraphScale(): void {
    this._implCollider?.setRadius(this._getRadius());
  }

  @serializable
  private _radius = 1;

  private _getRadius() {
    const scale = this.sceneGraphScale;
    if (scale.x !== scale.y) {
      console.warn('CircleCollider2D should have uniform scale');
    }
    return this._radius * scale.x;
  }
}
