import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { director, Node, Quat, Scene, Vec3 } from 'cc';
import { PhysicsWorld2DSceneComponent } from '@/physics-world-2d-scene-component.js';
import { CircleCollider2D } from '@/index.js';
import { RigidBody2D, RigidBody2DType } from '@/rigid-body-2d.js';
import { toRadians } from '@cyclonium/core/math/trigonometry';
import { fromPx2ImplVec2 } from '@/exchange.js';
import { Vec2 } from '@cyclonium/core/math/vec2';

const defaultTickDeltaTime = 1 / 60;

describe('Collider2D', () => {
  let scene: Scene = undefined!;
  let physicsScene: PhysicsWorld2DSceneComponent = undefined!;
  afterAll(() => {
    scene.destroy();
  });
  beforeAll(() => {
    scene = new Scene('test-scene');
    director.runSceneImmediate(scene);
    const node = new Node(`physics-scene`);
    physicsScene = node.addComponent(PhysicsWorld2DSceneComponent);
    scene.addChild(node);
  });

  it('enabling', () => {
    const node = new Node();
    node.active = false;
    scene.addChild(node);
    const collider = node.addComponent(CircleCollider2D);

    expect(collider.impl_internal).toBeUndefined();

    node.active = true;
    expect(collider.impl_internal!.isEnabled()).toBe(true);

    collider.enabled = false;
    expect(collider.impl_internal!.isEnabled()).toBe(false);

    collider.enabled = true;
    expect(collider.impl_internal!.isEnabled()).toBe(true);

    node.active = false;
    expect(collider.impl_internal!.isEnabled()).toBe(false);
  });

  describe('_updateTransform', () => {
    describe('branch: handle is null', () => {
      it('should early return when handle is null', () => {
        const colliderNode = new Node('collider');
        colliderNode.parent = physicsScene.node;
        const collider = colliderNode.addComponent(CircleCollider2D);
        collider.center = new Vec2(1, 2);
        expect(collider.center.x).toBe(1);
        colliderNode.destroy();
      });
    });

    describe('branch: no parentRigidBody (standalone collider)', () => {
      it('should set absolute translation and rotation', () => {
        const colliderNodeParent = new Node('collider-parent');
        colliderNodeParent.worldPosition = new Vec3(4, 6, 0);
        colliderNodeParent.worldRotation = Quat.fromAxisAngle(new Quat(), Vec3.UNIT_Z, toRadians(32));
        colliderNodeParent.parent = physicsScene.node;
        const colliderNode = new Node('collider');
        colliderNodeParent.addChild(colliderNode);
        colliderNode.worldPosition = new Vec3(100, 1.85, 0);
        colliderNode.worldRotation = Quat.fromAxisAngle(new Quat(), Vec3.UNIT_Z, toRadians(108));
        const collider = colliderNode.addComponent(CircleCollider2D);
        director.tick(defaultTickDeltaTime);
        const internalCollider = collider.impl_internal;
        expect(internalCollider).toBeDefined();
        expect(fromPx2ImplVec2(internalCollider!.translation())).toStrictEqual(new Vec2(
          100,
          1.850000023841858,
        ));
        expect(internalCollider!.rotation()).toBeCloseTo(toRadians(108), 6);
        colliderNodeParent.destroy();
      });

      it('should update translation when center changes', () => {
        const colliderNode = new Node('collider');
        colliderNode.parent = physicsScene.node;
        colliderNode.worldPosition = new Vec3(10, 20, 0);
        const collider = colliderNode.addComponent(CircleCollider2D);
        director.tick(defaultTickDeltaTime);
        const originalPos = fromPx2ImplVec2(collider.impl_internal!.translation());
        expect(originalPos.x).toBeCloseTo(10);
        expect(originalPos.y).toBeCloseTo(20);

        collider.center = new Vec2(5, 10);
        director.tick(defaultTickDeltaTime);
        const newPos = fromPx2ImplVec2(collider.impl_internal!.translation());
        expect(newPos.x).toBeCloseTo(15);
        expect(newPos.y).toBeCloseTo(30);
        colliderNode.destroy();
      });

      it('should scale center by node scale', () => {
        const colliderNode = new Node('collider');
        colliderNode.parent = physicsScene.node;
        colliderNode.worldPosition = new Vec3(0, 0, 0);
        colliderNode.worldScale = new Vec3(2, 3, 1);
        const collider = colliderNode.addComponent(CircleCollider2D);
        collider.center = new Vec2(1, 1);
        director.tick(defaultTickDeltaTime);
        const internalCollider = collider.impl_internal;
        const pos = fromPx2ImplVec2(internalCollider!.translation());
        expect(pos.x).toBeCloseTo(2);
        expect(pos.y).toBeCloseTo(3);
        colliderNode.destroy();
      });
    });

    describe('branch: with parentRigidBody', () => {
      it('should sync world position correctly when attached to same node', () => {
        const bodyNode = new Node('body');
        bodyNode.parent = physicsScene.node;
        bodyNode.worldPosition = new Vec3(50, 60, 0);
        const rigidBody = bodyNode.addComponent(RigidBody2D);
        rigidBody.type = RigidBody2DType.dynamic;
        rigidBody.enabled = false;
        const collider = bodyNode.addComponent(CircleCollider2D);
        collider.center = new Vec2(10, 20);
        director.tick(defaultTickDeltaTime);
        const internalCollider = collider.impl_internal;
        expect(internalCollider).toBeDefined();
        expect(collider.attachedRigidBody).not.toBeNull();
        const rapierPos = fromPx2ImplVec2(internalCollider!.translation());
        const expectedX = bodyNode.worldPosition.x + 10;
        const expectedY = bodyNode.worldPosition.y + 20;
        expect(rapierPos.x).toBeCloseTo(expectedX);
        expect(rapierPos.y).toBeCloseTo(expectedY);
        bodyNode.destroy();
      });

      it('should compute relative transform when collider is child of rigid body node', () => {
        const bodyNode = new Node('body');
        bodyNode.parent = physicsScene.node;
        bodyNode.worldPosition = new Vec3(10, 20, 0);
        bodyNode.worldScale = new Vec3(1, 1, 1);
        const rigidBody = bodyNode.addComponent(RigidBody2D);
        rigidBody.type = RigidBody2DType.dynamic;
        rigidBody.enabled = false;

        const childNode = new Node('child');
        childNode.parent = bodyNode;
        childNode.setPosition(5, 6, 0);
        const collider = childNode.addComponent(CircleCollider2D);
        collider.center = new Vec2(1, 2);
        director.tick(defaultTickDeltaTime);
        const internalCollider = collider.impl_internal;
        expect(internalCollider).toBeDefined();
        expect(collider.attachedRigidBody).not.toBeNull();
        const rapierPos = fromPx2ImplVec2(internalCollider!.translation());
        const expectedX = childNode.worldPosition.x + 1;
        const expectedY = childNode.worldPosition.y + 2;
        expect(rapierPos.x).toBeCloseTo(expectedX);
        expect(rapierPos.y).toBeCloseTo(expectedY);
        bodyNode.destroy();
      });

      it('should keep child collider in world position when ancestor rigid body scale changes', () => {
        /// @case
        /// 1. A circle collider is on a child node at local x = 1 under a fixed rigid body.
        /// 2. The rigid body node scale changes from 1 to 2 after the collider exists.
        /// @expect
        /// The child collider is queried at world x = 2 after the next physics tick.
        const bodyNode = new Node('scaled-body');
        bodyNode.parent = physicsScene.node;
        const rigidBody = bodyNode.addComponent(RigidBody2D);
        rigidBody.type = RigidBody2DType.fixed;

        const childNode = new Node('child-collider');
        childNode.parent = bodyNode;
        childNode.setPosition(1, 0, 0);
        const collider = childNode.addComponent(CircleCollider2D);
        collider.radius = 0.1;

        director.tick(defaultTickDeltaTime);
        const world = physicsScene.physicsWorld!;
        expect(world.castCircle({
          radius: 0.05,
          position: new Vec2(2, 1),
        }, {
          direction: new Vec2(0, -1),
          maxDistance: 2,
        })).toBeUndefined();

        bodyNode.worldScale = new Vec3(2, 2, 1);
        director.tick(defaultTickDeltaTime);

        const hit = world.castCircle({
          radius: 0.05,
          position: new Vec2(2, 1),
        }, {
          direction: new Vec2(0, -1),
          maxDistance: 2,
        });
        expect(hit).toBeDefined();
        expect(hit!.collider).toBe(collider);
        bodyNode.destroy();
      });
    });
  });

  describe('intersect', () => {
    it('should return undefined when not in world', () => {
      const colliderNode = new Node('collider');
      colliderNode.parent = physicsScene.node;
      const collider = colliderNode.addComponent(CircleCollider2D);
      collider.radius = 1;

      const result = collider.intersect({});
      expect(result).toBeUndefined();
      colliderNode.destroy();
    });

    it('should return ColliderShapeIntersection when intersecting', () => {
      const colliderNode1 = new Node('collider1');
      colliderNode1.parent = physicsScene.node;
      colliderNode1.worldPosition = new Vec3(0, 0, 0);
      const collider1 = colliderNode1.addComponent(CircleCollider2D);
      collider1.radius = 1;

      const colliderNode2 = new Node('collider2');
      colliderNode2.parent = physicsScene.node;
      colliderNode2.worldPosition = new Vec3(1.5, 0, 0);
      colliderNode2.addComponent(CircleCollider2D);

      director.tick(defaultTickDeltaTime);

      const result = collider1.intersect({});
      expect(result).toBeDefined();
      expect(result!.collider).toBeDefined();
      colliderNode1.destroy();
      colliderNode2.destroy();
    });
  });
});
