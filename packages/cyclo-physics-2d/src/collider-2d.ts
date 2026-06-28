import { Transform2DComponent, TransformChangeFlagsObserver, TransformFlag } from '@cyclonium/core/2d';
import { editable, requiresComponent, serializable } from '@cyclonium/core/legacy-decorator';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { type Contact2DInfo } from './contact.js';
import { fromPx2ImplVec2, toPx2ImplVec2 } from './exchange.js';
import { px2Impl } from './px2-impl.js';
import { PhysicsComponent2DBase } from './physics-component-2d-base.js';
import { ContactEventListenerFlagIndex, createCollisionEventEmitter } from './shared.js';
import { type Collider2DHandle } from './physics-world-2d.js';
import { assert } from '@cyclonium/core/utils';
import type { Node } from 'cc';
import { getZRotation } from './utils/3-to-2.js';
import { ColliderShapeCastHit, ColliderShapeIntersection, RayColliderIntersection, type ShapeCastQueryOptions, type ShapeIntersectionQueryOptions } from './scene-query.js';
import type { Ray2D } from '@cyclonium/core/math/ray';
import { Bounds2D } from '@cyclonium/core/math/bounds-2d';

@cycloBuiltinClass({ abstract: true })
export abstract class Collider2D extends PhysicsComponent2DBase {
  get attachedRigidBody() {
    return this._handle?.attachedRigidBody ?? null;
  }

  @editable
  get isSensor() {
    return this._isSensor;
  }

  set isSensor(value) {
    this._isSensor = value;
    if (this._implCollider) {
      this._implCollider.setSensor(value);
    }
  }

  @editable
  get center() {
    return this._center;
  }

  set center(value: Vec2) {
    Vec2.assign(this._center, value);
    this._updateTransform();
  }

  get bounds() {
    return this._computeBounds();
  }

  /**
   * Test only.
   * @internal
   */
  get impl_internal() {
    return this._implCollider;
  }

  onContactBegin = createCollisionEventEmitter<[Collider2D, Collider2D, Contact2DInfo]>((hasAnyListener) => {
    this._updateListenerFlag(ContactEventListenerFlagIndex.begin, hasAnyListener);
  });

  onContactStay = createCollisionEventEmitter<[Collider2D, Collider2D, Contact2DInfo]>((hasAnyListener) => {
    this._updateListenerFlag(ContactEventListenerFlagIndex.stay, hasAnyListener);
  });

  onContactEnd = createCollisionEventEmitter<[Collider2D, Collider2D, Contact2DInfo]>((hasAnyListener) => {
    this._updateListenerFlag(ContactEventListenerFlagIndex.end, hasAnyListener);
  });

  intersect(opts: ShapeIntersectionQueryOptions) {
    const world = this.world;
    if (!world) {
      return;
    }
    const implCollider = this._implCollider;
    if (!implCollider) {
      return;
    }
    const collierImpl = world.impl.intersectionWithShape(
      implCollider.translation(),
      implCollider.rotation(),
      implCollider.shape,
      opts.filter?._filterFlags_internal,
      opts.filter?._filterGroups_internal,
      undefined,
      undefined,
    );
    if (!collierImpl) {
      return;
    }
    const collider = world.getColliderWithWarn_internal(collierImpl);
    if (!collider) {
      return;
    }
    return new ColliderShapeIntersection(collider);
  }

  cast(opts: ShapeCastQueryOptions) {
    const world = this.world;
    if (!world) {
      return;
    }
    const implCollider = this._implCollider;
    if (!implCollider) {
      return;
    }
    const directionNormalized = opts.direction.normalize();
    const shapePosition = implCollider.translation();
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
    const hit = world.impl.castShape(
      shapePosition,
      implCollider.rotation(),
      toPx2ImplVec2(directionNormalized),
      implCollider.shape,
      opts.targetDistance ?? 1e-6,
      opts.maxDistance,
      false,
      opts.filter?._filterFlags_internal,
      opts.filter?._filterGroups_internal,
      undefined,
      undefined,
      filterPredicate,
    );
    if (!hit) {
      return;
    }
    const hitCollider = world.getColliderWithWarn_internal(hit.collider);
    if (!hitCollider) {
      return;
    }
    return new ColliderShapeCastHit(hit, fromPx2ImplVec2(shapePosition), directionNormalized, hitCollider);
  }

  castRay(ray: Ray2D, maxDistance: number, solid?: boolean) {
    const world = this.world;
    if (!world) {
      return;
    }
    const implCollider = this._implCollider;
    if (!implCollider) {
      return;
    }
    const hit = implCollider.castRayAndGetNormal(
      new px2Impl.Ray(toPx2ImplVec2(ray.origin), toPx2ImplVec2(ray.direction)),
      maxDistance,
      solid ?? true,
    );
    if (!hit) {
      return;
    }
    return new RayColliderIntersection(
      this,
      hit.timeOfImpact,
      fromPx2ImplVec2(hit.normal),
    );
  }

  /**
   * @internal
   */
  _enableCollisionEventsSinceBody(value: boolean) {
    this._updateListenerFlag(ContactEventListenerFlagIndex.body, value);
  }

  /**
   * @internal
   */
  _responseToBodyActiveCollisionTypes(value: number) {
    this._bodyActiveCollisionTypes = value;
    if (this._implCollider) {
      this._implCollider.setActiveCollisionTypes(this._bodyActiveCollisionTypes);
    }
  }

  /**
   * @internal
   */
  _responseToBodyCollisionGroups(value: number) {
    this._bodyCollisionGroups = value;
    if (this._implCollider) {
      this._implCollider.setCollisionGroups(value);
    }
  }

  /**
   * @internal
   */
  _responseToBodySolverGroups(value: number) {
    this._bodySolverGroups = value;
    if (this._implCollider) {
      this._implCollider.setSolverGroups(value);
    }
  }

  /**
   * @internal
   */
  _responseToAttachedRigidBodyChanged() {
    this.recreateCollider();
  }

  protected get _implCollider(): px2Impl.Collider | undefined {
    return this._handle?.impl ?? undefined;
  }

  protected recreateCollider() {
    this._destroyCollider();
    const handle = this._handle;
    if (!handle) {
      return;
    }
    const shape = this._acquireShape();
    if (!shape) {
      return;
    }
    const desc = new px2Impl.ColliderDesc(shape);
    desc.setSensor(this._isSensor);
    desc.setActiveEvents(this._getActiveEvents());
    const collider = handle.createCollider(desc);
    collider.setActiveCollisionTypes(this._bodyActiveCollisionTypes);
    collider.setCollisionGroups(this._bodyCollisionGroups);
    collider.setSolverGroups(this._bodySolverGroups);
    this._updateTransform();
    collider.setEnabled(this.enabledInHierarchy);
  }

  protected onAttachToWorld(): void {
    if (!this.world) {
      return;
    }
    this._transformChangeFlagsObserver.observe(this._transform);
    this._sceneGraphScaleCache.copyFrom(this.sceneGraphScale);
    this._handle = this.world._addColliderHandle(this);
    this.recreateCollider();
  }

  protected onDetachFromWorld(): void {
    this._handle?.destroy(true);
    this._handle = null;
  }

  protected override onEnabled(): void {
    super.onEnabled();
    this._implCollider?.setEnabled(true);
  }

  protected override onDisabled(): void {
    this._implCollider?.setEnabled(false);
  }

  protected override onSyncTransforms(forceTransform: boolean, forceScale: boolean): void {
    const changeFlags = this._transformChangeFlagsObserver.sync();
    const currentScale = this.sceneGraphScale;
    const scaleChanged = forceScale || !!(changeFlags & TransformFlag.scale) || !Vec2.equals(currentScale, this._sceneGraphScaleCache);
    if (scaleChanged) {
      this._sceneGraphScaleCache.copyFrom(currentScale);
      this.updateSceneGraphScale();
    }
    if (forceTransform || scaleChanged || !!(changeFlags & (TransformFlag.position | TransformFlag.rotation))) {
      this._updateTransform();
    }
  }

  protected abstract getShape(): px2Impl.Shape | undefined;

  protected abstract computeShapeBounds(out: Bounds2D): void;

  protected get sceneGraphScale() {
    return this._transform.scale;
  }

  protected updateSceneGraphScale(): void {
    const implCollider = this._implCollider;
    if (!implCollider) {
      this.recreateCollider();
      return;
    }
    const shape = this.getShape();
    if (!shape) {
      this.recreateCollider();
      return;
    }
    implCollider.setShape(shape);
  }

  @serializable
  private _isSensor = false;

  @serializable
  private _center = new Vec2();

  private _handle: Collider2DHandle | null = null;

  private _listenerFlags = 0;
  private _bodyActiveCollisionTypes = 0;
  private _bodyCollisionGroups = 0;
  private _bodySolverGroups = 0;
  private _transformChangeFlagsObserver = new TransformChangeFlagsObserver();
  private _sceneGraphScaleCache = new Vec2(1, 1);

  private _shape: px2Impl.Shape | undefined = undefined;

  /**
   * `false` if we acquired the shape but the shape is invalid,
   * otherwise either we have not acquired the shape or the shape is valid.
   */
  private _shapeAcquired = false;

  private _boundsCache = new Bounds2D();

  @requiresComponent(Transform2DComponent)
  private get _transform(): Transform2DComponent { return undefined!; }

  private _destroyCollider() {
    this._shape = undefined;
    this._shapeAcquired = false;
    this._handle?.removeCollider(true);
  }

  private _updateListenerFlag(index: ContactEventListenerFlagIndex, hasAnyListener: boolean) {
    if (hasAnyListener) {
      this._listenerFlags |= 1 << index;
    } else {
      this._listenerFlags &= ~(1 << index);
    }
    if (this._implCollider) {
      this._implCollider.setActiveEvents(this._getActiveEvents());
    }
  }

  private _getActiveEvents(): px2Impl.ActiveEvents {
    return this._listenerFlags === 0
      ? px2Impl.ActiveEvents.NONE
      : px2Impl.ActiveEvents.COLLISION_EVENTS;
  }

  private _acquireShape() {
    if (this._shapeAcquired) {
      return undefined;
    }
    if (!this._shape) {
      this._shape = this.getShape();
      if (!this._shape) {
        this._shapeAcquired = true;
      }
    }
    return this._shape;
  }

  private _updateTransform() {
    const handle = this._handle;
    if (!handle) {
      return;
    }
    const implCollider = handle.impl;
    if (!implCollider) {
      return;
    }
    const parentRigidBody = handle.attachedRigidBody;
    const pivot = this._center.clone();
    const colliderTransform = this._transform;
    pivot.x *= colliderTransform.scale.x;
    pivot.y *= colliderTransform.scale.y;
    if (parentRigidBody) {
      assert(implCollider.parent());
      if (parentRigidBody.node === this.node) {
        // our parent rigid body already handled the scene graph transform
        // only need the collider self's transform.
        implCollider.setTranslationWrtParent(toPx2ImplVec2(pivot));
      } else {
        const { position, rotation } = computeRelativeTransform(colliderTransform.node, parentRigidBody.node);
        pivot.addSelf(position);
        implCollider.setTranslationWrtParent(toPx2ImplVec2(pivot));
        implCollider.setRotationWrtParent(rotation);
      }
    } else {
      pivot.addSelf(colliderTransform.position);
      implCollider.setTranslation(toPx2ImplVec2(pivot));
      implCollider.setRotation(colliderTransform.rotation);
    }
  }

  private _computeBounds() {
    const bounds = this._boundsCache;
    this.computeShapeBounds(bounds);

    const pivot = this._center.clone();
    const colliderTransform = this._transform;
    pivot.x *= colliderTransform.scale.x;
    pivot.y *= colliderTransform.scale.y;

    const center = pivot;
    center.rotateSelf(colliderTransform.rotation);
    center.addSelf(colliderTransform.position);
    bounds.center = center;

    return bounds;
  }
}

function computeRelativeTransform(child: Node, parent: Node): { position: Vec2; rotation: number } {
  const parentRotation = getZRotation(parent.worldRotation);
  const childPosition = child.worldPosition;
  const parentPosition = parent.worldPosition;
  return {
    position: new Vec2(
      childPosition.x - parentPosition.x,
      childPosition.y - parentPosition.y,
    ).rotateSelf(-parentRotation),
    rotation: getZRotation(child.worldRotation) - parentRotation,
  };
}
