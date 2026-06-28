import { editable, idem, idemBy, serializable } from '@cyclonium/core/legacy-decorator';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { fromPx2ImplVec2, toPx2ImplVec2 } from './exchange.js';
import { px2Impl } from './px2-impl.js';
import { PhysicsComponent2DBase } from './physics-component-2d-base.js';
import type { PhysicsWorld2D } from './physics-world-2d.js';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { assert } from '@cyclonium/core/utils';
import { Collider2D } from './collider-2d.js';
import { RigidBody2DType } from './rigid-body-2d.js';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { toRadians } from '@cyclonium/core/math/trigonometry';
import { ManagedEventEmitter } from '@cyclonium/event';
import { logger } from '@cyclonium/core/log';
import { prune } from '@cyclonium/algorithm/prune';

enum PropertyGroup {
  common = 'Common',
  slope = 'Slope',
  autoStep = 'Auto Step',
  snapToGround = 'Snap To Ground',
}

@cycloBuiltinClass('KinematicCharacterController2D')
export class KinematicCharacterController2D extends PhysicsComponent2DBase {
  @editable
  @idem
  get skinWidth() {
    return this._skinWidth;
  }

  set skinWidth(value) {
    this._skinWidth = value;
    this._impl?.setOffset(value);
  }

  @editable
  @idemBy(Vec2.strictEquals)
  get up() {
    return this._up;
  }

  set up(value) {
    Vec2.assign(this._up, value);
    this._impl?.setUp(toPx2ImplVec2(value));
  }

  @editable
  @idem
  get slideEnabled() {
    return this._slideEnabled;
  }

  set slideEnabled(value) {
    this._slideEnabled = value;
    this._updateSlideEnabled();
  }

  @editable({ group: PropertyGroup.slope, radian: true })
  @idem
  get minSlopeSlideAngle() {
    return this._minSlopeSlideAngle;
  }

  set minSlopeSlideAngle(value) {
    this._minSlopeSlideAngle = value;
    this._impl?.setMinSlopeSlideAngle(value);
  }

  @editable({ group: PropertyGroup.slope, radian: true })
  @idem
  get maxSlopeClimbAngle() {
    return this._maxSlopeClimbAngle;
  }

  set maxSlopeClimbAngle(value) {
    this._maxSlopeClimbAngle = value;
    this._impl?.setMaxSlopeClimbAngle(value);
  }

  @editable({ group: PropertyGroup.autoStep })
  @idem
  get autoStepEnabled() {
    return this._autoStepEnabled;
  }

  set autoStepEnabled(value) {
    this._autoStepEnabled = value;
    this._updateAutoStepParams();
  }

  @editable({ group: PropertyGroup.autoStep })
  @idem
  get autoStepMaxHeight() {
    return this._autoStepMaxHeight;
  }

  set autoStepMaxHeight(value) {
    this._autoStepMaxHeight = value;
    this._updateAutoStepParams();
  }

  @editable({ group: PropertyGroup.autoStep })
  @idem
  get autoStepMinWidth() {
    return this._autoStepMinWidth;
  }

  set autoStepMinWidth(value) {
    this._autoStepMinWidth = value;
    this._updateAutoStepParams();
  }

  @editable({ group: PropertyGroup.autoStep })
  @idem
  get autoStepIncludeDynamicBodies() {
    return this._autoStepIncludeDynamicBodies;
  }

  set autoStepIncludeDynamicBodies(value) {
    this._autoStepIncludeDynamicBodies = value;
    this._updateAutoStepParams();
  }

  @editable({ group: PropertyGroup.snapToGround })
  @idem
  get snapToGroundEnabled() {
    return this._snapToGroundEnabled;
  }

  set snapToGroundEnabled(value) {
    this._snapToGroundEnabled = value;
    this._updateSnapToGroundParams();
  }

  @editable({ group: PropertyGroup.snapToGround })
  @idem
  get snapToGroundDistance() {
    return this._snapToGroundDistance;
  }

  set snapToGroundDistance(value) {
    this._snapToGroundDistance = value;
    this._updateSnapToGroundParams();
  }

  @editable
  @idem
  get applyImpulsesToDynamicBodies() {
    return this._applyImpulsesToDynamicBodies;
  }

  set applyImpulsesToDynamicBodies(value) {
    this._applyImpulsesToDynamicBodies = value;
    this._impl?.setApplyImpulsesToDynamicBodies(value);
  }

  get lastMovement() {
    return this._lastMovement;
  }

  get grounded() {
    return this._impl?.computedGrounded() ?? false;
  }

  get listenersOnCollisionBegin() {
    return this._emitterOnCollisionBegin.registry;
  }

  get listenersOnCollisionStay() {
    return this._emitterOnCollisionStay.registry;
  }

  get listenersOnCollisionEnd() {
    return this._emitterOnCollisionEnd.registry;
  }

  get impl() {
    return this._impl;
  }

  move(desiredMovement: Vec2, deltaTime: number) {
    const impl = this._impl;
    if (!impl) {
      return;
    }
    const collider = Collider2D.ofOrNull(this);
    if (!collider || !collider.impl_internal) {
      return;
    }
    const world = this.world;
    if (!world) {
      return;
    }
    impl.computeColliderMovement(
      collider.impl_internal,
      toPx2ImplVec2(desiredMovement),
      undefined,
      collider.impl_internal.collisionGroups(),
    );
    const movement = fromPx2ImplVec2(impl.computedMovement());
    Vec2.assign(this._lastMovement, movement);
    const rigidBody = collider.attachedRigidBody;
    if (!rigidBody || !rigidBody.impl) {
      const newPosition = fromPx2ImplVec2(collider.impl_internal.translation()).add(movement);
      Transform2DComponent.of(collider).position = newPosition;
      collider.impl_internal.setTranslation(toPx2ImplVec2(newPosition));
    } else if (rigidBody.type === RigidBody2DType.kinematicVelocityBased) {
      rigidBody.linearVelocity = movement.mulScalar(1 / deltaTime);
    } else {
      const currentPosition = fromPx2ImplVec2(rigidBody.impl.nextTranslation());
      const newPosition = fromPx2ImplVec2(currentPosition).add(movement);
      Transform2DComponent.of(collider).position = newPosition;
      rigidBody.impl.setNextKinematicTranslation(toPx2ImplVec2(newPosition));
    }

    this._emitCharacterCollisionEvents(impl, world);
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this._destroyImpl();
  }

  protected onAttachToWorld(world: PhysicsWorld2D): void {
    assert(!this._impl);
    const impl = this._impl = world.impl.createCharacterController(this._skinWidth);
    impl.setOffset(this._skinWidth);
    impl.setMinSlopeSlideAngle(this._minSlopeSlideAngle);
    impl.setMaxSlopeClimbAngle(this._maxSlopeClimbAngle);
    impl.setUp(toPx2ImplVec2(this._up));
    this._updateSlideEnabled();
    this._updateAutoStepParams();
    this._updateSnapToGroundParams();
    impl.setApplyImpulsesToDynamicBodies(this._applyImpulsesToDynamicBodies);
  }

  protected onDetachFromWorld(world: PhysicsWorld2D): void {
    void world;
    this._destroyImpl();
  }

  protected override onAfterPhysicsStep(): void {
    void 0;
  }

  private _impl: px2Impl.KinematicCharacterController | undefined;

  @serializable
  private _skinWidth = 0.01;

  @serializable
  private _up = Vec2.UNIT_Y.clone();

  @serializable
  private _slideEnabled = true;

  @serializable
  private _minSlopeSlideAngle = toRadians(30);

  @serializable
  private _maxSlopeClimbAngle = toRadians(45);

  @serializable
  private _autoStepEnabled = true;

  @serializable
  private _autoStepMaxHeight = 0.1;

  @serializable
  private _autoStepMinWidth = 0.1;

  @serializable
  private _autoStepIncludeDynamicBodies = false;

  @serializable
  private _snapToGroundEnabled = true;

  @serializable
  private _snapToGroundDistance = 0.1;

  @serializable
  private _applyImpulsesToDynamicBodies = false;

  private _lastMovement = Vec2.ZERO.clone();

  private _collisionRecords: Array<{
    collider: Collider2D;
    colliderName_debug: undefined | string;
    state: CollisionRecordState;
  }> = [];

  private _emitterOnCollisionBegin = new ManagedEventEmitter<[CharacterCollision]>();
  private _emitterOnCollisionStay = new ManagedEventEmitter<[CharacterCollision]>();
  private _emitterOnCollisionEnd = new ManagedEventEmitter<[CharacterCollision]>();

  private _updateSlideEnabled() {
    this._impl?.setSlideEnabled(this._slideEnabled);
  }

  private _updateAutoStepParams() {
    if (this._autoStepEnabled) {
      this._impl?.enableAutostep(this._autoStepMaxHeight, this._autoStepMinWidth, this._autoStepIncludeDynamicBodies);
    } else {
      this._impl?.disableAutostep();
    }
  }

  private _updateSnapToGroundParams() {
    if (this._snapToGroundEnabled) {
      this._impl?.enableSnapToGround(this._snapToGroundDistance);
    } else {
      this._impl?.disableSnapToGround();
    }
  }

  private _destroyImpl() {
    if (!this._impl) {
      return;
    }
    const world = this.world;
    world?.impl.removeCharacterController(this._impl);
    this._impl = undefined;
  }

  private _emitCharacterCollisionEvents(impl: px2Impl.KinematicCharacterController, world: PhysicsWorld2D) {
    const nComputedCollisions = impl.numComputedCollisions();
    for (let i = 0; i < nComputedCollisions; i++) {
      const collision = impl.computedCollision(i);
      assert(collision);
      if (!collision.collider) {
        logger.warn('a computed collision with null collider.');
        continue;
      }
      const collider = world._getCollider(collision.collider);
      if (!collider) {
        logger.warn('a computed collision with a collider that is not(or has been destroyed) in our physics world.');
        continue;
      }
      const iExistingRecord = this._collisionRecords.findIndex((record) => record.collider === collider);
      if (iExistingRecord < 0) {
        // new collision
        this._collisionRecords.push({
          collider,
          colliderName_debug: collider.node.getPathInHierarchy(),
          state: CollisionRecordState.begin,
        });
      } else {
        const record = this._collisionRecords[iExistingRecord];
        if (record.state === CollisionRecordState.stayStale) {
          record.state = CollisionRecordState.stay;
        } else {
          // That indeed happens.
          // logger.warn(`Received more than once collision with collider ${collider.node.getPathInHierarchy()}?`);
        }
      }
    }

    for (const record of this._collisionRecords) {
      const collision: CharacterCollision = {
        collider: record.collider,
      };
      switch (record.state) {
      case CollisionRecordState.begin:
        record.state = CollisionRecordState.stayStale;
        this._emitterOnCollisionBegin.emit(collision);
        break;
      case CollisionRecordState.stay:
        record.state = CollisionRecordState.stayStale;
        this._emitterOnCollisionStay.emit(collision);
        break;
      case CollisionRecordState.stayStale:
        record.state = CollisionRecordState.end;
        if (!record.collider.isValid) {
          logger.verbose(`[NOTICE] a previous-colliding collider ${record.colliderName_debug ?? '<the name was not recorded>'} is no longer valid, no collision end event will be emitted.`);
          continue;
        }
        this._emitterOnCollisionEnd.emit(collision);
        break;
      }
    }

    prune(this._collisionRecords, (record) => record.state !== CollisionRecordState.end);
  }
}

export interface CharacterCollision {
  collider: Collider2D;
}

enum CollisionRecordState {
  /**
   * The character controller has just started colliding with the collider in this computation.
   */
  begin,

  /**
   * The character controller was colliding with the collider after last computation.
   */
  stayStale,

  /**
   * The character controller is colliding with the collider in this computation.
   */
  stay,

  /**
   * The character controller was not colliding with the collider in this computation.
   */
  end,
}
