import { Transform2DComponent, TransformChangeFlagsObserver, TransformFlag } from '@cyclonium/core/2d';
import { designType, editable, idem, requiresComponent, serializable } from '@cyclonium/core/legacy-decorator';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { fromPx2ImplVec2, toPx2ImplVec2 } from './exchange.js';
import { px2Impl } from './px2-impl.js';
import { PhysicsComponent2DBase } from './physics-component-2d-base.js';
import type { PhysicsWorld2D, RigidBody2DControlBlock } from './physics-world-2d.js';
import { markEnum } from '@cyclonium/core/utils';
import type { Collider2D } from './collider-2d.js';
import type { Contact2DInfo } from './contact.js';
import { createCollisionEventEmitter, ContactEventListenerFlagIndex } from './shared.js';
import { CCString } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { approxEqual } from '@cyclonium/core/math/number';
import { to0ToPI2 } from '@cyclonium/core/math/trigonometry';

export enum RigidBody2DType {
  fixed = 'fixed',
  dynamic = 'dynamic',
  kinematicPositionBased = 'kinematicPositionBased',
  kinematicVelocityBased = 'kinematicVelocityBased',
}
markEnum(RigidBody2DType);

enum CollisionTargetTypeFilterIndex {
  fixed = 0,
  dynamic = 1,
  kinematic = 2,
}

const defaultBodyType = RigidBody2DType.dynamic;

function getDefaultCollisionTargetTypeFilterOf(bodyType: RigidBody2DType) {
  return bodyType === RigidBody2DType.dynamic
    ? ((1 << CollisionTargetTypeFilterIndex.dynamic) | (1 << CollisionTargetTypeFilterIndex.fixed) | (1 << CollisionTargetTypeFilterIndex.kinematic))
    : 0;
}

const SYNC_POSITION_THRESHOLD = 1e-6;
const SYNC_ROTATION_THRESHOLD = 1e-6;

@cycloBuiltinClass('RigidBody2D')
export class RigidBody2D extends PhysicsComponent2DBase {
  onContactBegin = createCollisionEventEmitter<[Collider2D, Collider2D, Contact2DInfo]>((hasAnyListener) => {
    this._updateListenerFlag(ContactEventListenerFlagIndex.begin, hasAnyListener);
  });

  onContactStay = createCollisionEventEmitter<[Collider2D, Collider2D, Contact2DInfo]>((hasAnyListener) => {
    this._updateListenerFlag(ContactEventListenerFlagIndex.stay, hasAnyListener);
  });

  onContactEnd = createCollisionEventEmitter<[Collider2D, Collider2D, Contact2DInfo]>((hasAnyListener) => {
    this._updateListenerFlag(ContactEventListenerFlagIndex.end, hasAnyListener);
  });

  @editable(CCString)
  get tags() {
    return this._tags;
  }

  set tags(value: string[]) {
    this._tags = value.slice();
    this._rigidBodyControlBlock?.setTags(value);
  }

  @designType(RigidBody2DType)
  @idem
  get type() {
    return this._type;
  }

  set type(value: RigidBody2DType) {
    this._type = value;
    if (EDITOR_NOT_IN_PREVIEW) {
      this._collisionTargetTypeFilter = getDefaultCollisionTargetTypeFilterOf(value);
    }
    this._updateActiveCollisionTypes();
    this._rigidBodyControlBlock?.impl.setBodyType(toPx2ImplRigidBodyType(value), true);
  }

  @editable
  get collisionWithDynamic() {
    return this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.dynamic);
  }

  set collisionWithDynamic(value: boolean) {
    this._setCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.dynamic, value);
  }

  @editable
  get collisionWithFixed() {
    return this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.fixed);
  }

  set collisionWithFixed(value: boolean) {
    this._setCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.fixed, value);
  }

  @editable
  get collisionWithKinematic() {
    return this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.kinematic);
  }

  set collisionWithKinematic(value: boolean) {
    this._setCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.kinematic, value);
  }

  @editable
  @idem
  get ccd() {
    return this._ccd;
  }

  set ccd(value: boolean) {
    this._ccd = value;
    this._rigidBodyControlBlock?.impl.enableCcd(value);
  }

  @editable({
    visible(this: RigidBody2D) {
      return this._type === RigidBody2DType.dynamic;
    },
  })
  @idem
  get gravityScale() {
    return this._gravityScale;
  }

  set gravityScale(value: number) {
    this._gravityScale = value;
    this._rigidBodyControlBlock?.impl.setGravityScale(value, true);
  }

  get position() {
    return this._physicsPosition;
  }

  set position(value: Vec2) {
    this._setPhysicsPosition(value);
  }

  get rotation() {
    return this._physicsRotation;
  }

  set rotation(value: number) {
    this._setPhysicsRotation(to0ToPI2(value));
  }

  get linearVelocity() {
    if (this._rigidBodyControlBlock) {
      return fromPx2ImplVec2(this._rigidBodyControlBlock.impl.linvel(), this._linearVelocity);
    } else {
      return this._linearVelocity.set(0, 0);
    }
  }

  @idem
  set linearVelocity(value: Vec2) {
    Vec2.assign(this._linearVelocity, value);
    switch (this._type) {
    default:
      break;
    case RigidBody2DType.dynamic:
    case RigidBody2DType.kinematicVelocityBased: {
      if (this._rigidBodyControlBlock) {
        this._rigidBodyControlBlock.impl.setLinvel(toPx2ImplVec2(value), true);
      }
      break;
    }
    }
  }

  hasTag(tag: string) {
    return this._tags.includes(tag);
  }

  addTag(tag: string) {
    if (!this._tags.includes(tag)) {
      this._tags.push(tag);
    }
  }

  setNextKinematicPosition(position: Vec2) {
    this._rigidBodyControlBlock?.impl.setNextKinematicTranslation(position);
  }

  setNextKinematicRotation(rotation: number) {
    this._rigidBodyControlBlock?.impl.setNextKinematicRotation(rotation);
  }

  get impl() {
    return this._rigidBodyControlBlock?.impl;
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this._destroyImplBody();
  }

  protected onAttachToWorld(world: PhysicsWorld2D): void {
    const transform = this._transform;
    this._transformChangeFlagsObserver.observe(transform);
    this._physicsPosition.copyFrom(transform.position);
    this._physicsRotation = transform.rotation;
    const desc = new px2Impl.RigidBodyDesc(toPx2ImplRigidBodyType(this._type))
      .setEnabled(this.enabled)
      .setTranslation(this._physicsPosition.x, this._physicsPosition.y)
      .setRotation(this._physicsRotation)
      .setCcdEnabled(this._ccd)
      .setLinvel(this._linearVelocity.x, this._linearVelocity.y)
      .setGravityScale(this._gravityScale)
      ;
    const body = world._createRigidBody(this, desc);
    body.setTags(this._tags);
    this._rigidBodyControlBlock = body;
    this._updateActiveCollisionTypes();
    body.impl.setEnabled(this.enabledInHierarchy);
  }

  protected onDetachFromWorld(_world: PhysicsWorld2D): void {
    this._destroyImplBody();
  }

  protected override onEnabled(): void {
    super.onEnabled();
    this._rigidBodyControlBlock?.impl.setEnabled(true);
  }

  protected override onDisabled(): void {
    this._rigidBodyControlBlock?.impl.setEnabled(false);
  }

  protected override onStart(): void {
    super.onStart();
  }

  protected override onSyncTransforms(forceTransform: boolean, _forceScale: boolean): void {
    this._syncToPhysics(forceTransform);
  }

  protected override onAfterPhysicsStep(): void {
    this._syncFromPhysics();
  }

  private _rigidBodyControlBlock: RigidBody2DControlBlock | null = null;

  @serializable
  private _tags: string[] = [];

  @serializable
  private _type: RigidBody2DType = defaultBodyType;

  @serializable
  private _ccd = false;

  @serializable
  private _gravityScale = 1.0;

  @serializable
  private _collisionTargetTypeFilter = getDefaultCollisionTargetTypeFilterOf(defaultBodyType);

  private _physicsPosition = new Vec2();
  private _physicsRotation = 0.0;
  private _linearVelocity = new Vec2();

  private _listenerFlags = 0;

  private _transformChangeFlagsObserver = new TransformChangeFlagsObserver();

  @requiresComponent(Transform2DComponent)
  private get _transform(): Transform2DComponent { return undefined!; }

  private _getCollisionTargetTypeFilter(filterIndex: CollisionTargetTypeFilterIndex) {
    return !!(this._collisionTargetTypeFilter & (1 << filterIndex));
  }

  private _setCollisionTargetTypeFilter(filterIndex: CollisionTargetTypeFilterIndex, value: boolean) {
    if (value) {
      this._collisionTargetTypeFilter |= 1 << filterIndex;
    } else {
      this._collisionTargetTypeFilter &= ~(1 << filterIndex);
    }
    this._updateActiveCollisionTypes();
  }

  private _updateActiveCollisionTypes() {
    let combined = 0;
    switch (this._type) {
    case RigidBody2DType.dynamic:
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.dynamic)) {
        combined |= px2Impl.ActiveCollisionTypes.DYNAMIC_DYNAMIC;
      }
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.fixed)) {
        combined |= px2Impl.ActiveCollisionTypes.DYNAMIC_FIXED;
      }
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.kinematic)) {
        combined |= px2Impl.ActiveCollisionTypes.DYNAMIC_KINEMATIC;
      }
      break;
    case RigidBody2DType.fixed:
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.dynamic)) {
        combined |= px2Impl.ActiveCollisionTypes.DYNAMIC_FIXED;
      }
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.fixed)) {
        combined |= px2Impl.ActiveCollisionTypes.FIXED_FIXED;
      }
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.kinematic)) {
        combined |= px2Impl.ActiveCollisionTypes.KINEMATIC_FIXED;
      }
      break;
    case RigidBody2DType.kinematicPositionBased:
    case RigidBody2DType.kinematicVelocityBased:
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.dynamic)) {
        combined |= px2Impl.ActiveCollisionTypes.DYNAMIC_KINEMATIC;
      }
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.fixed)) {
        combined |= px2Impl.ActiveCollisionTypes.KINEMATIC_FIXED;
      }
      if (this._getCollisionTargetTypeFilter(CollisionTargetTypeFilterIndex.kinematic)) {
        combined |= px2Impl.ActiveCollisionTypes.KINEMATIC_KINEMATIC;
      }
      break;
    }
    this._rigidBodyControlBlock?.setActiveCollisionTypes(combined);
  }

  private _updateListenerFlag(flagIndex: number, hasAny: boolean) {
    if (hasAny) {
      this._listenerFlags |= 1 << flagIndex;
    } else {
      this._listenerFlags &= ~(1 << flagIndex);
    }
    if (this._rigidBodyControlBlock) {
      this._rigidBodyControlBlock.enableCollisionEvents(this._listenerFlags !== 0);
    }
  }

  private _destroyImplBody() {
    const impl = this._rigidBodyControlBlock?.impl;
    const world = this.world;
    if (impl) {
      world?._removeRigidBody(impl);
    }
    this._rigidBodyControlBlock = null;
    this._physicsPosition.set(0, 0);
    this._physicsRotation = 0.0;
  }

  private _setPhysicsPosition(position: Vec2) {
    this._physicsPosition.copyFrom(position);
    this._rigidBodyControlBlock?.impl.setTranslation(toPx2ImplVec2(position), true);
  }

  private _setPhysicsRotation(rotation: number) {
    this._physicsRotation = rotation;
    this._rigidBodyControlBlock?.impl.setRotation(rotation, true);
  }

  private _syncToPhysics(outdated: boolean) {
    const implBody = this._rigidBodyControlBlock?.impl;
    if (!implBody) {
      return;
    }
    const transform = this._transform;
    const changeFlags = this._transformChangeFlagsObserver.sync();
    if (outdated || changeFlags & TransformFlag.position) {
      if (!Vec2.equals(transform.position, this._physicsPosition, SYNC_POSITION_THRESHOLD)) {
        this._setPhysicsPosition(transform.position);
      }
    }
    if (outdated || changeFlags & TransformFlag.rotation) {
      if (!approxEqual(transform.rotation, this._physicsRotation, SYNC_ROTATION_THRESHOLD)) {
        this._setPhysicsRotation(transform.rotation);
      }
    }
  }

  private _syncFromPhysics() {
    if (this._type === RigidBody2DType.fixed) {
      return;
    }
    const implBody = this._rigidBodyControlBlock?.impl;
    if (!implBody) {
      return;
    }
    const transform = this._transform;
    const pxPosition = implBody.translation();
    const positionCache = fromPx2ImplVec2(pxPosition, this._physicsPosition);
    if (!Vec2.equals(positionCache, transform.position, SYNC_POSITION_THRESHOLD)) {
      transform.position = positionCache;
    }
    const pxRotation = to0ToPI2(implBody.rotation());
    this._physicsRotation = pxRotation;
    if (!approxEqual(pxRotation, transform.rotation, SYNC_ROTATION_THRESHOLD)) {
      transform.rotation = pxRotation;
    }
  }
}

function toPx2ImplRigidBodyType(type: RigidBody2DType) {
  switch (type) {
  case RigidBody2DType.fixed:
    return px2Impl.RigidBodyType.Fixed;
  case RigidBody2DType.dynamic:
    return px2Impl.RigidBodyType.Dynamic;
  case RigidBody2DType.kinematicPositionBased:
    return px2Impl.RigidBodyType.KinematicPositionBased;
  case RigidBody2DType.kinematicVelocityBased:
    return px2Impl.RigidBodyType.KinematicVelocityBased;
  }
}
