import { CCString } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { editable, idem, requiresComponent, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { PhysicsComponent2DBase } from './physics-component-2d-base.js';
import { SceneQueryFilter, type ColliderShapeCastHit } from './scene-query.js';
import type { Collider2D } from './collider-2d.js';
import type { PhysicsWorld2D, ShapeTransformDesc } from './physics-world-2d.js';

/**
 * Options applied when a SceneQueryProbe2D performs a shape cast.
 */
export interface SceneQueryProbeSweepOptions {
  /**
   * The allowed distance between the swept shape and a hit at the target position.
   */
  targetDistance?: number;

  /**
   * Whether the sweep should stop immediately when the start shape already overlaps a collider.
   */
  stopAtPenetration?: boolean;

  /**
   * Colliders skipped by the sweep, usually the querying object's own collider.
   */
  excludeColliders?: Iterable<Collider2D>;
}

/**
 * Query-only 2D physics probe used for authoring reusable scene queries.
 *
 * It does not create a collider, participate in simulation, or emit contact events.
 */
@cycloBuiltinClass({ abstract: true })
export abstract class SceneQueryProbe2D extends PhysicsComponent2DBase {
  /**
   * Physics tags this probe can hit.
   *
   * Tags are resolved through the current PhysicsWorld2D and cached until the filter config changes.
   * Assign a new array to change tags; in-place mutations are not supported.
   */
  @editable(CCString)
  get targetTags(): readonly string[] {
    return this._targetTags;
  }

  set targetTags(value: readonly string[]) {
    this._targetTags = value.slice();
    this._invalidateFilter();
  }

  /**
   * Whether dynamic rigid bodies are included in this probe's queries.
   */
  @editable
  @idem
  get dynamics() {
    return this._dynamics;
  }

  set dynamics(value: boolean) {
    this._dynamics = value;
    this._invalidateFilter();
  }

  /**
   * Whether fixed rigid bodies are included in this probe's queries.
   */
  @editable
  @idem
  get fixed() {
    return this._fixed;
  }

  set fixed(value: boolean) {
    this._fixed = value;
    this._invalidateFilter();
  }

  /**
   * Whether kinematic rigid bodies are included in this probe's queries.
   */
  @editable
  @idem
  get kinematics() {
    return this._kinematics;
  }

  set kinematics(value: boolean) {
    this._kinematics = value;
    this._invalidateFilter();
  }

  /**
   * Whether sensor colliders are included in this probe's queries.
   */
  @editable
  @idem
  get sensors() {
    return this._sensors;
  }

  set sensors(value: boolean) {
    this._sensors = value;
    this._invalidateFilter();
  }

  /**
   * Whether solid colliders are included in this probe's queries.
   */
  @editable
  @idem
  get solids() {
    return this._solids;
  }

  set solids(value: boolean) {
    this._solids = value;
    this._invalidateFilter();
  }

  /**
   * Finds colliders overlapping this probe's current world transform and filter.
   */
  intersect() {
    const world = this.world;
    if (!world) {
      return [];
    }
    return [...this.intersectWithWorld(world, this._getFilter(world))];
  }

  /**
   * Casts this probe from its current world transform.
   *
   * `direction` is normalized internally; `maxDistance` defines the sweep length.
   */
  sweep(direction: Vec2, maxDistance: number, opts: SceneQueryProbeSweepOptions = {}) {
    return this.sweepFrom({
      position: this.queryPosition,
      rotation: this.queryRotation,
    }, direction, maxDistance, opts);
  }

  /**
   * Casts this probe from an explicit transform without moving the node.
   *
   * Useful for previous-to-current authority sweeps.
   */
  sweepFrom(transform: ShapeTransformDesc, direction: Vec2, maxDistance: number, opts: SceneQueryProbeSweepOptions = {}) {
    const world = this.world;
    if (!world) {
      return;
    }
    return this.sweepWithWorld(world, transform, direction, maxDistance, opts, this._getFilter(world));
  }

  protected get queryPosition() {
    return this._transform.position;
  }

  protected get queryRotation() {
    return this._transform.rotation;
  }

  protected get queryScale() {
    return this._transform.scale;
  }

  protected abstract intersectWithWorld(world: PhysicsWorld2D, filter: SceneQueryFilter): Iterable<Collider2D>;

  protected abstract sweepWithWorld(
    world: PhysicsWorld2D,
    transform: ShapeTransformDesc,
    direction: Vec2,
    maxDistance: number,
    opts: SceneQueryProbeSweepOptions,
    filter: SceneQueryFilter,
  ): ColliderShapeCastHit | undefined;

  protected abstract drawGizmo(): void;

  protected onAttachToWorld(_world: PhysicsWorld2D) {
  }

  protected onDetachFromWorld(_world: PhysicsWorld2D) {
    this._clearFilterCache();
  }

  protected override onUpdate() {
    if (EDITOR_NOT_IN_PREVIEW) {
      this.drawGizmo();
    }
  }

  private _getFilter(world: PhysicsWorld2D) {
    if (!this._filterCache || this._filterWorld !== world || this._filterDirty) {
      this._filterCache = this._createFilter(world);
      this._filterWorld = world;
      this._filterDirty = false;
    }
    return this._filterCache;
  }

  private _createFilter(world: PhysicsWorld2D) {
    const filter = new SceneQueryFilter();
    filter.dynamics = this._dynamics;
    filter.fixed = this._fixed;
    filter.kinematics = this._kinematics;
    filter.sensors = this._sensors;
    filter.solids = this._solids;
    for (const tag of this._targetTags) {
      filter.addTargetTag(world.getTagId(tag));
    }
    return filter;
  }

  private _invalidateFilter() {
    this._filterDirty = true;
  }

  private _clearFilterCache() {
    this._filterCache = undefined;
    this._filterWorld = undefined;
    this._filterDirty = true;
  }

  @serializable
  private _targetTags: string[] = [];

  @serializable
  private _dynamics = true;

  @serializable
  private _fixed = true;

  @serializable
  private _kinematics = true;

  @serializable
  private _sensors = true;

  @serializable
  private _solids = true;

  private _filterCache: SceneQueryFilter | undefined = undefined;

  private _filterWorld: PhysicsWorld2D | undefined = undefined;

  private _filterDirty = true;

  @requiresComponent(Transform2DComponent)
  private get _transform(): Transform2DComponent { return undefined!; }
}
