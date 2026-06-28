import { editable, executeInEditMode, idem, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { drawBoxSceneQueryProbe2DGizmo } from '#gizmo';
import { SceneQueryProbe2D, type SceneQueryProbeSweepOptions } from '../scene-query-probe-2d.js';
import type { SceneQueryFilter } from '../scene-query.js';
import type { PhysicsWorld2D, ShapeTransformDesc } from '../physics-world-2d.js';

/**
 * Query-only probe that uses an oriented box shape.
 */
@cycloBuiltinClass('BoxSceneQueryProbe2D')
@executeInEditMode
export class BoxSceneQueryProbe2D extends SceneQueryProbe2D {
  /**
   * Half-size of the query box before Transform2D scale is applied.
   */
  @editable
  @idem
  get halfExtents() {
    return this._halfExtents;
  }

  set halfExtents(value: Vec2) {
    Vec2.assign(this._halfExtents, value);
  }

  protected intersectWithWorld(world: PhysicsWorld2D, filter: SceneQueryFilter) {
    return world.intersectWithBox(this.queryPosition, this._getScaledHalfExtents(), filter, this.queryRotation);
  }

  protected sweepWithWorld(
    world: PhysicsWorld2D,
    transform: ShapeTransformDesc,
    direction: Vec2,
    maxDistance: number,
    opts: SceneQueryProbeSweepOptions,
    filter: SceneQueryFilter,
  ) {
    return world.castRect({
      halfExtents: this._getScaledHalfExtents(),
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
    drawBoxSceneQueryProbe2DGizmo(this);
  }

  private _getScaledHalfExtents() {
    const scale = this.queryScale;
    return Vec2.set(this._scaledHalfExtents, this._halfExtents.x * scale.x, this._halfExtents.y * scale.y);
  }

  @serializable
  private _halfExtents = new Vec2(1, 1);

  private _scaledHalfExtents = new Vec2();
}
