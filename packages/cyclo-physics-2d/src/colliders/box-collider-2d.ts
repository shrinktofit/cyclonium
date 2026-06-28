import { editable, executeInEditMode, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { Collider2D } from '../collider-2d.js';
import { px2Impl } from '../px2-impl.js';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { drawBoxCollider2DGizmo } from '#gizmo';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Vec2 } from '@cyclonium/core/math/vec2';
import type { Bounds2D } from '@cyclonium/core/math/bounds-2d';

@cycloBuiltinClass('BoxCollider2D')
@executeInEditMode
export class BoxCollider2D extends Collider2D {
  @editable({ min: 0 })
  @idem
  get width() {
    return this._halfWidth * 2;
  }

  set width(value: number) {
    this._halfWidth = value / 2;
    this._updateExtents();
  }

  @editable({ min: 0 })
  @idem
  get height() {
    return this._halfHeight * 2;
  }

  set height(value: number) {
    this._halfHeight = value / 2;
    this._updateExtents();
  }

  get halfExtents() {
    return new Vec2(this._halfWidth, this._halfHeight);
  }

  set halfExtents(value: Vec2) {
    this._halfWidth = value.x;
    this._halfHeight = value.y;
    this._updateExtents();
  }

  protected override getShape(): px2Impl.Shape | undefined {
    const scale = this.sceneGraphScale;
    return new px2Impl.Cuboid(this._halfWidth * scale.x, this._halfHeight * scale.y);
  }

  protected override computeShapeBounds(out: Bounds2D): void {
    const hw = this._halfWidth;
    const hh = this._halfHeight;
    const scale = this.sceneGraphScale;
    out.setCenterSize(
      Vec2.ZERO,
      new Vec2(hw * scale.x * 2, hh * scale.y * 2),
    );
  }

  protected override onUpdate(): void {
    if (EDITOR_NOT_IN_PREVIEW) {
      drawBoxCollider2DGizmo(this);
    }
  }

  protected override updateSceneGraphScale(): void {
    this._updateExtents();
  }

  @serializable
  private _halfWidth = 1;

  @serializable
  private _halfHeight = 1;

  private _updateExtents() {
    if (!this._implCollider) {
      return;
    }
    const scale = this.sceneGraphScale;
    this._implCollider.setHalfExtents(new px2Impl.Vector2(this._halfWidth * scale.x, this._halfHeight * scale.y));
  }
}
