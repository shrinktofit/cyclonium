import { Scene } from 'cc';
import { logger } from '@cyclonium/core/log';
import { prune } from '@cyclonium/algorithm/prune';
import { assert } from '@cyclonium/core/utils';
import { BodyColliderLink, BodyColliderLinkManager } from './body-collider-link.js';
import type { Collider2D } from './collider-2d.js';
import { CollisionMatrix } from './collision-matrix.js';
import { type Contact2DInfo } from './contact.js';
import { fromPx2ImplVec2, toPx2ImplVec2 } from './exchange.js';
import { invokeOnAfterStep, invokeOnSyncTransforms, PhysicsComponent2DBase } from './physics-component-2d-base.js';
import { px2Impl } from './px2-impl.js';
import { RigidBody2D } from './rigid-body-2d.js';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { ManagedEventEmitter } from '@cyclonium/event';
import { Ray2D } from '@cyclonium/core/math/ray';
import { getPhysicsWorld, registerPhysicsWorld, unregisterPhysicsWorld } from './physics-world-registry.js';
import { ColliderShapeCastHit, RayColliderIntersection, type SceneQueryFilter, type ShapeCastQueryOptions } from './scene-query.js';

export class RaycastResult {
  constructor(
    ray: Ray2D,
    collider: Collider2D,
    distance: number,
  ) {
    this._ray = ray;
    this._collider = collider;
    this._distance = distance;
  }

  get collider() {
    return this._collider;
  }

  get distance() {
    return this._distance;
  }

  get position() {
    return this._ray.at(this._distance);
  }

  private _ray: Ray2D;
  private _collider: Collider2D;
  private _distance: number;
}

export interface CircleShapeDesc {
  radius: number;
}

export interface CapsuleShapeDesc {
  halfHeight: number;
  radius: number;
}

export interface RectShapeDesc {
  halfExtents: Vec2;
}

export interface ShapeTransformDesc {
  position: Vec2;
  rotation?: number;
}

export class PhysicsWorld2D {
  static of(scene: Scene) {
    const world = PhysicsWorld2D.ofUndefined(scene);
    if (!world) {
      throw new Error(`PhysicsWorld2D not found for scene ${scene.name}.`);
    }
    return world;
  }

  static ofUndefined(scene: Scene) {
    return getPhysicsWorld(scene);
  }

  constructor({
    scene,
    tags,
    collisionMatrix,
    solverMatrix,
  }: {
    scene: Scene;
    tags: Record<string, number>;
    collisionMatrix: CollisionMatrix;
    solverMatrix: CollisionMatrix;
  }) {
    registerPhysicsWorld(scene, this);

    Object.assign(this._tags, tags);
    this._collisionMatrix = collisionMatrix.clone();
    this._solverMatrix = solverMatrix.clone();
    this._worldImpl = new px2Impl.World(
      new px2Impl.Vector2(0, -9.81),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    this._eventQueue = new px2Impl.EventQueue(true);
  }

  get listenersOnWillDestroy() {
    return this._emitterForWillDestroy.registry;
  }

  get impl() {
    return this._worldImpl;
  }

  destroy() {
    unregisterPhysicsWorld(this);
    this._emitterForWillDestroy.emit();
    this._worldImpl.free();
    this._worldImpl = null!;
  }

  step(_deltaTime: number) {
    const outdated = this._outDated;
    this._outDated = false;

    for (const component of this._physicsComponents) {
      if (!component.enabled) {
        continue;
      }
      invokeOnSyncTransforms(component, outdated, outdated);
    }

    this._worldImpl.step(this._eventQueue);

    for (const component of this._physicsComponents) {
      if (!component.enabled) {
        continue;
      }
      invokeOnAfterStep(component);
    }

    this._emitEvents();
  }

  setOutdated() {
    this._outDated = true;
  }

  getTagId(tag: string) {
    const tagId = this._tags[tag];
    if (tagId === undefined) {
      throw new Error(`Tag ${tag} not found.`);
    }
    return tagId;
  }

  * intersectionWithPoint(point: Vec2, filter: SceneQueryFilter) {
    const colliders: Collider2D[] = [];
    this._worldImpl.intersectionsWithPoint(
      toPx2ImplVec2(point),
      (colliderImpl) => {
        const collider = this.getColliderWithWarn_internal(colliderImpl);
        if (collider) {
          colliders.push(collider);
        }
        return true;
      },
      filter._filterFlags_internal,
      filter._filterGroups_internal,
      undefined,
      undefined,
      undefined,
    );
    yield* colliders;
  }

  * intersectionWithCollider(collider: Collider2D, filter: SceneQueryFilter) {
    const implCollider = collider.impl_internal;
    if (!implCollider) {
      return;
    }
    const colliders: Collider2D[] = [];
    this._worldImpl.intersectionWithShape(
      implCollider.translation(),
      implCollider.rotation(),
      implCollider.shape,
      filter._filterFlags_internal,
      filter._filterGroups_internal,
      undefined,
      undefined,
      (otherImplCollider) => {
        const otherCollider = this.getColliderWithWarn_internal(otherImplCollider);
        if (otherCollider) {
          colliders.push(otherCollider);
        }
        return true;
      },
    );
    yield* colliders;
  }

  intersectWithCircle(center: Vec2, radius: number, filter: SceneQueryFilter, rotation = 0) {
    return this._intersectWithShape(
      new px2Impl.Ball(radius),
      center,
      rotation,
      filter,
    );
  }

  intersectWithBox(center: Vec2, halfExtents: Vec2, filter: SceneQueryFilter, rotation = 0) {
    return this._intersectWithShape(
      new px2Impl.Cuboid(halfExtents.x, halfExtents.y),
      center,
      rotation,
      filter,
    );
  }

  /**
   * Finds colliders overlapping a capsule shape.
   */
  intersectWithCapsule(capsule: CapsuleShapeDesc & ShapeTransformDesc, filter: SceneQueryFilter) {
    return this._intersectWithShape(
      new px2Impl.Capsule(capsule.halfHeight, capsule.radius),
      capsule.position,
      capsule.rotation ?? 0,
      filter,
    );
  }

  * intersectWithRay(ray: Ray2D, maxDistance: number, filter: SceneQueryFilter) {
    const intersections: RayColliderIntersection[] = [];
    this._worldImpl.intersectionsWithRay(
      new px2Impl.Ray(toPx2ImplVec2(ray.origin), toPx2ImplVec2(ray.direction)),
      maxDistance,
      false,
      (intersection) => {
        const collider = this.getColliderWithWarn_internal(intersection.collider);
        if (collider) {
          intersections.push(new RayColliderIntersection(collider, intersection.timeOfImpact, fromPx2ImplVec2(intersection.normal)));
        }
        return true;
      },
      filter._filterFlags_internal,
      filter._filterGroups_internal,
      undefined,
      undefined,
      undefined,
    );
    yield* intersections;
  }

  castRay(ray: Ray2D, maxDistance: number, filter: SceneQueryFilter) {
    const rayColliderHit = this._worldImpl.castRay(
      new px2Impl.Ray(toPx2ImplVec2(ray.origin), toPx2ImplVec2(ray.direction)),
      maxDistance,
      false,
      filter._filterFlags_internal,
      filter._filterGroups_internal,
      undefined,
      undefined,
      undefined,
    );
    if (!rayColliderHit) {
      return undefined;
    }
    const collider = this.getColliderWithWarn_internal(rayColliderHit.collider);
    if (!collider) {
      return undefined;
    }
    return new RaycastResult(
      new Ray2D(ray.origin, ray.direction),
      collider,
      rayColliderHit.timeOfImpact,
    );
  }

  castCircle(circle: CircleShapeDesc & ShapeTransformDesc, opts: ShapeCastQueryOptions) {
    return this._castShape(
      new px2Impl.Ball(circle.radius),
      circle,
      opts,
    );
  }

  castRect(rect: RectShapeDesc & ShapeTransformDesc, opts: ShapeCastQueryOptions) {
    return this._castShape(
      new px2Impl.Cuboid(rect.halfExtents.x, rect.halfExtents.y),
      rect,
      opts,
    );
  }

  castCapsule(capsule: CapsuleShapeDesc & ShapeTransformDesc, opts: ShapeCastQueryOptions) {
    return this._castShape(
      new px2Impl.Capsule(capsule.halfHeight, capsule.radius),
      capsule,
      opts,
    );
  }

  /**
   * Pushes current scene graph transforms to the physics backend without stepping simulation.
   */
  syncTransforms() {
    for (const component of this._physicsComponents) {
      if (!component.enabled) {
        continue;
      }
      invokeOnSyncTransforms(component, true, false);
    }
    this._worldImpl.propagateModifiedBodyPositionsToColliders();
    this._worldImpl.updateSceneQueries();
  }

  _createRigidBody(component: RigidBody2D, desc: px2Impl.RigidBodyDesc): RigidBody2DControlBlock {
    if (this._physicsComponents.has(component)) {
      throw new Error('RigidBody already created for this component.');
    }
    const impl = this._worldImpl.createRigidBody(desc);
    this._physicsComponents.add(component);
    const link = this._linkManager.joinRigidBody(component);
    this._rigidBodies.set(impl.handle, {
      component,
      link,
      impl,
    });
    return {
      impl,
      enableCollisionEvents(value) {
        link.enableCollisionEventsFromBody(value);
      },
      setTags: (tags) => {
        let groupBits = 0;
        let collisionBits = 0;
        let solverBits = 0;
        if (tags.length === 0) {
          logger.warn(`RigidBody ${component.name} has no any tag, this leads to no scene query can be made to its colliders.`);
        }
        for (const tag of tags) {
          const tagBitIndex = this._getTagBit(tag);
          if (tagBitIndex < 0) {
            logger.warn(`Tag ${tag} not found`);
          } else {
            groupBits |= (1 << tagBitIndex);
            const collisionBitsOfTag = this._collisionMatrix.getCollisionsBitsOf(tagBitIndex);
            collisionBits |= collisionBitsOfTag;
            const solverBitsOfTag = this._solverMatrix.getCollisionsBitsOf(tagBitIndex);
            solverBits |= solverBitsOfTag;
          }
        }
        // > The membership and filter are both 16-bit bit masks packed into a single 32-bits value.
        // > The 16 left-most bits contain the memberships whereas the 16 right-most bits contain the filter.
        link.setBodyCollisionGroups((groupBits << 16) | collisionBits);
        link.setBodySolverGroups((groupBits << 16) | solverBits);
      },
      setActiveCollisionTypes(activeCollisionTypes) {
        link.setBodyActiveCollisionTypes(activeCollisionTypes);
      },
    };
  }

  _removeRigidBody(impl: px2Impl.RigidBody): void {
    const key = impl.handle;
    const record = this._rigidBodies.get(key);
    if (!record) {
      logger.warn(`RigidBody ${key} not found`);
      return;
    }
    this._rigidBodies.delete(key);
    assert(record.impl === impl);
    if (!this._physicsComponents.delete(record.component)) {
      logger.warn(`RigidBody ${key} not found in physics components`);
    }
    if (!this._linkManager.removeRigidBody(record.component)) {
      logger.warn(`RigidBody ${key} not found in link manager`);
    }
    // This should be the last since above calls call to impl rigid body/impl colliders.
    this._worldImpl.removeRigidBody(impl);
  }

  _addColliderHandle(component: Collider2D): Collider2DHandle {
    if (this._physicsComponents.has(component)) {
      throw new Error('Collider handle already created for this component.');
    }
    this._physicsComponents.add(component);
    this._linkManager.joinCollider(component);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const world = this;
    return {
      component,

      destroy(wakeUp: boolean) {
        this.removeCollider(wakeUp);
        if (!world._physicsComponents.delete(component)) {
          logger.warn(`Collider ${component} not found in physics components`);
        }
        if (!world._linkManager.removeCollider(component)) {
          logger.warn(`Collider ${component} not found in link manager`);
        }
      },

      get attachedRigidBody() {
        return world._linkManager.getLinkedRigidBody(component)?.rigidBody ?? null;
      },

      impl: null,

      createCollider(desc: px2Impl.ColliderDesc) {
        this.removeCollider(false);
        const rigidBody = this.attachedRigidBody;
        const impl = world._createImplCollider(component, desc, rigidBody?.impl);
        this.impl = impl;
        return impl;
      },

      removeCollider(wakeUp) {
        const impl = this.impl;
        if (!impl) {
          return;
        }
        world._removeImplCollider(impl, wakeUp);
        this.impl = null;
      },
    };
  }

  _getCollider(impl: px2Impl.Collider) {
    return this._colliders.get(impl.handle)?.component ?? undefined;
  }

  getColliderWithWarn_internal(impl: px2Impl.Collider) {
    const collider = this._getCollider(impl);
    if (!collider) {
      logger.warn(`Collider ${impl.handle} not found`);
    }
    return collider;
  }

  private _tags: Record<string, number> = {};
  private _collisionMatrix: CollisionMatrix;
  private _solverMatrix: CollisionMatrix;
  private _worldImpl: px2Impl.World;
  private _eventQueue: px2Impl.EventQueue;
  private _linkManager = new BodyColliderLinkManager();
  private _rigidBodies = new Map<number, RigidBodyRecord>();
  private _colliders = new Map<number, ColliderRecord>();

  private _collisionRecords: CollisionRecord[] = [];

  private _physicsComponents = new Set<PhysicsComponent2DBase>();
  private _outDated = false;

  private _emitterForWillDestroy = new ManagedEventEmitter();

  private _getTagBit(tag: string) {
    return this._tags[tag] ?? -1;
  }

  private _createImplCollider(component: Collider2D, desc: px2Impl.ColliderDesc, parent: px2Impl.RigidBody | undefined): px2Impl.Collider {
    const impl = this._worldImpl.createCollider(desc, parent);
    this._colliders.set(impl.handle, { impl, component });
    return impl;
  }

  private _removeImplCollider(impl: px2Impl.Collider, wakeUp: boolean) {
    const key = impl.handle;
    const colliderRecord = this._colliders.get(key);
    if (!colliderRecord) {
      logger.warn(`Collider ${key} not found`);
    } else {
      this._colliders.delete(key);
      assert(colliderRecord.impl === impl);
    }
    this._collisionRecords.forEach((record) => {
      if (record.collider1.impl !== impl && record.collider2.impl !== impl) {
        return;
      }
      if (record.state === CollisionRecordState.start) {
        this._emitCollisionEvent(record, 'onContactEnd');
      }
    });
    // todo: should notify the other side?
    prune(this._collisionRecords, (record) => record.collider1.impl !== impl && record.collider2.impl !== impl);
    this._worldImpl.removeCollider(impl, wakeUp);
  }

  private _emitEvents() {
    let exception: unknown;
    let hasException = false;
    const catchCallback = <TArgs extends unknown[]>(callback: (...args: TArgs) => void) => {
      return (...args: TArgs) => {
        if (hasException) {
          return;
        }
        try {
          callback(...args);
        } catch (e) {
          exception = e;
          hasException = true;
        }
      };
    };
    this._eventQueue.drainCollisionEvents(catchCallback((collider1Handle, collider2Handle, started) => {
      // Find local colliders.
      const collider1 = this._colliders.get(collider1Handle);
      const collider2 = this._colliders.get(collider2Handle);
      if (!collider1 || !collider2) {
        if (!collider1) {
          logger.warn(`Impl collider ${collider1Handle} not found`);
        }
        if (!collider2) {
          logger.warn(`Collider ${collider2Handle} not found`);
        }
        return;
      }

      // Get or create collision record.
      let collisionRecord = this._collisionRecords.find((record) => record.collider1 === collider1 && record.collider2 === collider2);
      if (started) {
        if (!collisionRecord) {
          // ok: not colliding in previous steps, start collide in this frame
          collisionRecord = { collider1, collider2, state: CollisionRecordState.start };
          this._collisionRecords.push(collisionRecord);
        } else if (collisionRecord.state === CollisionRecordState.end) {
          // also ok: the end event has emitted for these two collider in current step,
          // but they collide gain right way in current step.
          collisionRecord.state = CollisionRecordState.start;
        } else {
          // unexpected, who's wrong?
          return void warnUnexpectedCollisionEventOrder(`is already colliding, but received start gain?`, collider1, collider2);
        }
      } else {
        if (collisionRecord) {
          if (collisionRecord.state === CollisionRecordState.end) {
            // unexpected, who's wrong?
            return void warnUnexpectedCollisionEventOrder(`has already end their collision in current step, but received end again?`, collider1, collider2);
          } else {
            collisionRecord.state = CollisionRecordState.end;
          }
        } else {
          // unexpected, who's wrong?
          return void warnUnexpectedCollisionEventOrder(`was not colliding in last step, but received end this step?`, collider1, collider2);
        }
      }
    }));

    // Emit events
    for (const collisionRecord of this._collisionRecords) {
      switch (collisionRecord.state) {
      case CollisionRecordState.stay:
        this._emitCollisionEvent(collisionRecord, 'onContactStay');
        break;
      case CollisionRecordState.start:
        collisionRecord.state = CollisionRecordState.stay;
        this._emitCollisionEvent(collisionRecord, 'onContactBegin');
        break;
      case CollisionRecordState.end:
        this._emitCollisionEvent(collisionRecord, 'onContactEnd');
        break;
      }
    }
    this._collisionRecords = this._collisionRecords.filter((record) => record.state !== CollisionRecordState.end);

    if (hasException) {
      throw exception;
    }
  }

  private _emitCollisionEvent(collisionRecord: CollisionRecord, eventType: 'onContactBegin' | 'onContactStay' | 'onContactEnd') {
    const { collider1, collider2 } = collisionRecord;

    // Get contact info.
    const contactInfo: Contact2DInfo = {
      manifold: {
        points: [],
      },
    };

    const isAnySensor = collider1.component.isSensor || collider2.component.isSensor;
    if (isAnySensor) {
      // todo: no need this
      void this._worldImpl.intersectionPair(collider1.impl, collider2.impl);
    } else {
      this._worldImpl.contactPair(collider1.impl, collider2.impl, (manifold) => {
        const nContacts = manifold.numSolverContacts();
        for (let iContact = 0; iContact < nContacts; iContact++) {
          const contactPoint = manifold.solverContactPoint(iContact);
          contactInfo.manifold.points.push(fromPx2ImplVec2(contactPoint));
        }
      });
    }

    // Emit.
    const implRigidBody1 = collider1.impl.parent();
    const rigidBody1 = implRigidBody1 ? this._rigidBodies.get(implRigidBody1.handle) : null;
    const implRigidBody2 = collider2.impl.parent();
    const rigidBody2 = implRigidBody2 ? this._rigidBodies.get(implRigidBody2.handle) : null;
    collider1.component[eventType].emit(collider1.component, collider2.component, contactInfo);
    if (rigidBody1) {
      rigidBody1.component[eventType].emit(collider1.component, collider2.component, contactInfo);
    }
    collider2.component[eventType].emit(collider2.component, collider1.component, contactInfo);
    if (rigidBody2) {
      rigidBody2.component[eventType].emit(collider2.component, collider1.component, contactInfo);
    }
  }

  private* _intersectWithShape(shape: px2Impl.Shape, shapePosition: Vec2, shapeRotation: number, filter: SceneQueryFilter) {
    const colliders: Collider2D[] = [];
    this._worldImpl.intersectionWithShape(
      toPx2ImplVec2(shapePosition),
      shapeRotation,
      shape,
      filter._filterFlags_internal,
      filter._filterGroups_internal,
      undefined,
      undefined,
      (colliderImpl) => {
        const collider = this._colliders.get(colliderImpl.handle);
        if (collider) {
          colliders.push(collider.component);
        } else {
          logger.warn(`Collider ${colliderImpl.handle} not found`);
        }
        return true;
      },
    );
    yield* colliders;
  }

  private _castShape(
    shape: px2Impl.Shape,
    transform: ShapeTransformDesc,
    opts: ShapeCastQueryOptions,
  ) {
    const {
      direction,
      targetDistance = 1e-6,
      maxDistance,
      filter,
    } = opts;
    const directionNormalized = direction.normalize();
    let filterPredicate: ((collider: px2Impl.Collider) => boolean) | undefined;
    if (opts.excludeColliders) {
      const excludedColliderHandles = new Set<number>();
      for (const collider of opts.excludeColliders) {
        const excludedImplCollider = collider.impl_internal;
        if (excludedImplCollider) {
          excludedColliderHandles.add(excludedImplCollider.handle);
        }
      }
      if (excludedColliderHandles.size > 0) {
        filterPredicate = (collider) => !excludedColliderHandles.has(collider.handle);
      }
    }
    const hit = this._worldImpl.castShape(
      toPx2ImplVec2(transform.position),
      transform.rotation ?? 0,
      toPx2ImplVec2(directionNormalized),
      shape,
      targetDistance,
      maxDistance,
      opts.stopAtPenetration ?? false,
      filter?._filterFlags_internal,
      filter?._filterGroups_internal,
      undefined,
      undefined,
      filterPredicate,
    );
    if (!hit) {
      return;
    }
    const hitCollider = this.getColliderWithWarn_internal(hit.collider);
    if (!hitCollider) {
      return;
    }
    return new ColliderShapeCastHit(hit, transform.position, directionNormalized, hitCollider);
  }
}

export interface RigidBody2DControlBlock {
  impl: px2Impl.RigidBody;
  enableCollisionEvents(value: boolean): void;
  setTags(tags: string[]): void;
  setActiveCollisionTypes(collisionTypeFilter: number): void;
}

export interface Collider2DHandle {
  component: Collider2D;
  destroy(wakeUp: boolean): void;
  attachedRigidBody: RigidBody2D | null;
  impl: px2Impl.Collider | null;
  createCollider(desc: px2Impl.ColliderDesc): px2Impl.Collider;
  removeCollider(wakeUp: boolean): void;
}

interface ColliderRecord {
  impl: px2Impl.Collider;
  component: Collider2D;
}

enum CollisionRecordState {
  start,
  stay,
  end,
}

interface RigidBodyRecord {
  link: BodyColliderLink;
  impl: px2Impl.RigidBody;
  component: RigidBody2D;
}

interface CollisionRecord {
  collider1: ColliderRecord;
  collider2: ColliderRecord;
  state: CollisionRecordState;
}

function warnUnexpectedCollisionEventOrder(message: string, collider1: ColliderRecord, collider2: ColliderRecord) {
  logger.warn(`${collider1.component.name} <=> ${collider2.component.name} `, message);
  // eslint-disable-next-line no-debugger
  debugger;
}
