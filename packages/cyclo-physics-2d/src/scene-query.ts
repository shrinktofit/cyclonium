import { Vec2 } from '@cyclonium/core/math/vec2';
import type { Collider2D } from './collider-2d.js';
import { px2Impl } from './px2-impl.js';
import { fromPx2ImplVec2 } from './exchange.js';

export class SceneQueryFilter {
  constructor() {
  }

  get dynamics() {
    return this._getIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_DYNAMIC);
  }

  set dynamics(value) {
    this._setIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_DYNAMIC, value);
  }

  get fixed() {
    return this._getIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_FIXED);
  }

  set fixed(value) {
    this._setIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_FIXED, value);
  }

  get kinematics() {
    return this._getIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_KINEMATIC);
  }

  set kinematics(value) {
    this._setIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_KINEMATIC, value);
  }

  get sensors() {
    return this._getIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_SENSORS);
  }

  set sensors(value) {
    this._setIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_SENSORS, value);
  }

  get solids() {
    return this._getIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_SOLIDS);
  }

  set solids(value) {
    this._setIncludesFlag(px2Impl.QueryFilterFlags.EXCLUDE_SOLIDS, value);
  }

  addTargetTag(tag: number) {
    this._filterGroupFilter |= 1 << tag;
    return this;
  }

  get _filterFlags_internal() {
    return this._filterFlags;
  }

  get _filterGroups_internal() {
    // TODO
    // return composeCollisionGroup(GROUP_MEMBERSHIP_ALLOW_SCENE_QUERY, this._filterGroupFilter);
    return composeCollisionGroup(0xFFFF, this._filterGroupFilter);
  }

  private _filterGroupFilter = 0;
  private _filterFlags = 0;

  private _getIncludesFlag(flag: Extract<px2Impl.QueryFilterFlags, 1 | 2 | 4 | 8 | 16>) {
    return (this._filterFlags & flag) === 0;
  }

  private _setIncludesFlag(flag: Extract<px2Impl.QueryFilterFlags, 1 | 2 | 4 | 8 | 16>, value: boolean) {
    this._filterFlags = value ? this._filterFlags & ~flag : this._filterFlags | flag;
  }
}

function composeCollisionGroup(membership: number, filter: number) {
  // Per https://rapier.rs/docs/user_guides/javascript/colliders#collision-groups-and-solver-groups
  // > The membership and filter are both 16-bit bit masks packed into a single 32-bits value.
  // > The 16 left-most bits contain the memberships whereas the 16 right-most bits contain the filter.
  return (membership << 16) | filter;
}

export interface ShapeCastQueryOptions {
  direction: Vec2;
  maxDistance: number;
  targetDistance?: number;
  stopAtPenetration?: boolean;
  filter?: SceneQueryFilter;
  /**
   * Colliders skipped by the shape cast, usually the querying object's own collider.
   */
  excludeColliders?: Iterable<Collider2D>;
}

export class ColliderShapeCastHit {
  constructor(
    impl: px2Impl.ColliderShapeCastHit,
    startPosition: Vec2,
    direction: Vec2,
    collider: Collider2D,
  ) {
    this._impl = impl;
    this._startPosition = new Vec2(startPosition.x, startPosition.y);
    this._direction = new Vec2(direction.x, direction.y);
    this._collider = collider;
  }

  get collider() {
    return this._collider;
  }

  get impl() {
    return this._impl;
  }

  get point() {
    return this._startPosition.addMulScalar(this._direction, this._impl.time_of_impact);
  }

  get distance() {
    return this._impl.time_of_impact;
  }

  get localPoint1() {
    return fromPx2ImplVec2(this._impl.witness1);
  }

  get localPoint2() {
    return fromPx2ImplVec2(this._impl.witness2);
  }

  get localNormal1() {
    return fromPx2ImplVec2(this._impl.normal1);
  }

  get localNormal2() {
    return fromPx2ImplVec2(this._impl.normal2);
  }

  private _impl: px2Impl.ColliderShapeCastHit;
  private _startPosition: Vec2;
  private _direction: Vec2;
  private _collider: Collider2D;
}

export interface ShapeIntersectionQueryOptions {
  filter?: SceneQueryFilter;
}

export class ColliderShapeIntersection {
  constructor(
    private _collider: Collider2D,
  ) {
  }

  get collider() {
    return this._collider;
  }
}

export class RayColliderIntersection {
  constructor(
    collider: Collider2D,
    timeOfImpact: number,
    normal: Vec2,
  ) {
    this._collider = collider;
    this._timeOfImpact = timeOfImpact;
    this._normal = normal;
  }

  get collider() {
    return this._collider;
  }

  get timeOfImpact() {
    return this._timeOfImpact;
  }

  get normal() {
    return this._normal;
  }

  private _collider: Collider2D;
  private _timeOfImpact: number;
  private _normal: Vec2;
}
