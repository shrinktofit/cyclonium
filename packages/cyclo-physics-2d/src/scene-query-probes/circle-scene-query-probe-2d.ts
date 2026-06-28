import { editable, executeInEditMode, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { drawCircleSceneQueryProbe2DGizmo } from '#gizmo';
import { SceneQueryProbe2D, type SceneQueryProbeSweepOptions } from '../scene-query-probe-2d.js';
import type { SceneQueryFilter } from '../scene-query.js';
import type { PhysicsWorld2D, ShapeTransformDesc } from '../physics-world-2d.js';

/**
 * Query-only probe that uses a circle shape.
 */
@cycloBuiltinClass('CircleSceneQueryProbe2D')
@executeInEditMode
export class CircleSceneQueryProbe2D extends SceneQueryProbe2D {
  /**
   * Radius of the query circle before Transform2D scale is applied.
   */
  @editable({ min: 0 })
  @idem
  get radius() {
    return this._radius;
  }

  set radius(value: number) {
    this._radius = value;
  }

  protected intersectWithWorld(world: PhysicsWorld2D, filter: SceneQueryFilter) {
    return world.intersectWithCircle(this.queryPosition, this._getScaledRadius(), filter, this.queryRotation);
  }

  protected sweepWithWorld(
    world: PhysicsWorld2D,
    transform: ShapeTransformDesc,
    direction: Vec2,
    maxDistance: number,
    opts: SceneQueryProbeSweepOptions,
    filter: SceneQueryFilter,
  ) {
    return world.castCircle({
      radius: this._getScaledRadius(),
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
    drawCircleSceneQueryProbe2DGizmo(this);
  }

  private _getScaledRadius() {
    const scale = this.queryScale;
    if (scale.x !== scale.y) {
      console.warn('CircleSceneQueryProbe2D should have uniform scale');
    }
    return this._radius * scale.x;
  }

  @serializable
  private _radius = 1;
}
