import { editable, executeInEditMode, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { drawCapsuleSceneQueryProbe2DGizmo } from '#gizmo';
import { SceneQueryProbe2D, type SceneQueryProbeSweepOptions } from '../scene-query-probe-2d.js';
import type { SceneQueryFilter } from '../scene-query.js';
import type { PhysicsWorld2D, ShapeTransformDesc } from '../physics-world-2d.js';

/**
 * Query-only probe that uses a vertical capsule shape.
 */
@cycloBuiltinClass('CapsuleSceneQueryProbe2D')
@executeInEditMode
export class CapsuleSceneQueryProbe2D extends SceneQueryProbe2D {
  /**
   * Radius of the capsule caps before Transform2D scale is applied.
   */
  @editable({ min: 0 })
  @idem
  get radius() {
    return this._radius;
  }

  set radius(value: number) {
    this._radius = value;
  }

  /**
   * Half length of the capsule center segment before Transform2D scale is applied.
   */
  @editable({ min: 0 })
  @idem
  get halfHeight() {
    return this._halfHeight;
  }

  set halfHeight(value: number) {
    this._halfHeight = value;
  }

  protected intersectWithWorld(world: PhysicsWorld2D, filter: SceneQueryFilter) {
    const shape = this._getScaledShape();
    return world.intersectWithCapsule({
      halfHeight: shape.halfHeight,
      radius: shape.radius,
      position: this.queryPosition,
      rotation: this.queryRotation,
    }, filter);
  }

  protected sweepWithWorld(
    world: PhysicsWorld2D,
    transform: ShapeTransformDesc,
    direction: Vec2,
    maxDistance: number,
    opts: SceneQueryProbeSweepOptions,
    filter: SceneQueryFilter,
  ) {
    const shape = this._getScaledShape();
    return world.castCapsule({
      halfHeight: shape.halfHeight,
      radius: shape.radius,
      position: transform.position,
      rotation: transform.rotation,
    }, {
      ...opts,
      direction,
      maxDistance,
      filter,
    });
  }

  protected drawGizmo() {
    drawCapsuleSceneQueryProbe2DGizmo(this);
  }

  private _getUniformScale() {
    const scale = this.queryScale;
    if (scale.x !== scale.y) {
      console.warn('CapsuleSceneQueryProbe2D should have uniform scale');
    }
    return scale.x;
  }

  private _getScaledShape() {
    const scale = this._getUniformScale();
    return {
      halfHeight: this._halfHeight * scale,
      radius: this._radius * scale,
    };
  }

  @serializable
  private _radius = 1;

  @serializable
  private _halfHeight = 1;
}
