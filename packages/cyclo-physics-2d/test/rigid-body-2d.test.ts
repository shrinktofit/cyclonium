import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { director, Node, Scene } from 'cc';
import { RigidBody2D, RigidBody2DType } from '@/rigid-body-2d.js';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { PhysicsWorld2DSceneComponent } from '@/physics-world-2d-scene-component.js';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { BoxCollider2D } from '@/colliders/box-collider-2d.js';
import { fromPx2ImplVec2 } from '@/exchange.js';
import { SceneQueryFilter } from '@/scene-query.js';
import { Physics2DSettings } from '@/physics-2d-settings.js';

const defaultTickDeltaTime = 1 / 60;

describe('RigidBody2D', () => {
  describe('enabling', () => {
    let scene: Scene = undefined!;
    afterAll(() => {
      scene.destroy();
    });
    beforeAll(() => {
      scene = new Scene('test-scene');
      director.runSceneImmediate(scene);
      const node = new Node(`physics-scene`);
      node.addComponent(PhysicsWorld2DSceneComponent);
      scene.addChild(node);
    });

    it('enabling', () => {
      const node = new Node();
      node.active = false;
      scene.addChild(node);
      const rigidBody = node.addComponent(RigidBody2D);
      expect(rigidBody.impl).toBeUndefined();

      node.active = true;
      expect(rigidBody.impl!.isEnabled()).toBe(true);

      rigidBody.enabled = false;
      expect(rigidBody.impl!.isEnabled()).toBe(false);

      rigidBody.enabled = true;
      expect(rigidBody.impl!.isEnabled()).toBe(true);

      node.active = false;
      expect(rigidBody.impl!.isEnabled()).toBe(false);
    });
  });

  describe('type', () => {
    it('should default to dynamic', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      expect(rigidBody.type).toBe(RigidBody2DType.dynamic);
    });

    it('should allow setting type to fixed', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.type = RigidBody2DType.fixed;
      expect(rigidBody.type).toBe(RigidBody2DType.fixed);
    });

    it('should allow setting type to kinematicPositionBased', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.type = RigidBody2DType.kinematicPositionBased;
      expect(rigidBody.type).toBe(RigidBody2DType.kinematicPositionBased);
    });

    it('should allow setting type to kinematicVelocityBased', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.type = RigidBody2DType.kinematicVelocityBased;
      expect(rigidBody.type).toBe(RigidBody2DType.kinematicVelocityBased);
    });
  });

  describe('tags', () => {
    it('should have empty tags by default', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      expect(rigidBody.tags).toEqual([]);
    });

    it('should set tags', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.tags = ['player', 'enemy'];
      expect(rigidBody.tags).toEqual(['player', 'enemy']);
    });

    it('should add unique tags', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.addTag('player');
      rigidBody.addTag('player');
      rigidBody.addTag('enemy');
      expect(rigidBody.hasTag('player')).toBe(true);
      expect(rigidBody.hasTag('enemy')).toBe(true);
    });

    it('should check hasTag correctly', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.tags = ['player'];
      expect(rigidBody.hasTag('player')).toBe(true);
      expect(rigidBody.hasTag('enemy')).toBe(false);
    });
  });

  describe('collision filters', () => {
    it('should default to collide with all types for dynamic', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      expect(rigidBody.collisionWithDynamic).toBe(true);
      expect(rigidBody.collisionWithFixed).toBe(true);
      expect(rigidBody.collisionWithKinematic).toBe(true);
    });

    it('should toggle collision with dynamic', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.collisionWithDynamic = false;
      expect(rigidBody.collisionWithDynamic).toBe(false);
    });

    it('should toggle collision with fixed', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.collisionWithFixed = false;
      expect(rigidBody.collisionWithFixed).toBe(false);
    });

    it('should toggle collision with kinematic', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.collisionWithKinematic = false;
      expect(rigidBody.collisionWithKinematic).toBe(false);
    });
  });

  describe('ccd', () => {
    it('should default ccd to false', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      expect(rigidBody.ccd).toBe(false);
    });

    it('should allow setting ccd', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.ccd = true;
      expect(rigidBody.ccd).toBe(true);
    });
  });

  describe('gravityScale', () => {
    it('should default gravityScale to 1.0', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      expect(rigidBody.gravityScale).toBe(1.0);
    });

    it('should allow setting gravityScale', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.gravityScale = 2.0;
      expect(rigidBody.gravityScale).toBe(2.0);
    });
  });

  describe('position and rotation', () => {
    it('should get and set position', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.position = new Vec2(10, 20);
      expect(rigidBody.position.x).toBe(10);
      expect(rigidBody.position.y).toBe(20);
    });

    it('should get and set rotation', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.rotation = Math.PI;
      expect(rigidBody.rotation).toBeCloseTo(Math.PI);
    });
  });

  describe('linearVelocity', () => {
    it('should default linearVelocity to zero', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      expect(rigidBody.linearVelocity.x).toBe(0);
      expect(rigidBody.linearVelocity.y).toBe(0);
    });
  });

  describe('kinematic position', () => {
    it('should allow setting next kinematic position', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.type = RigidBody2DType.kinematicPositionBased;
      rigidBody.setNextKinematicPosition(new Vec2(100, 200));
    });

    it('should allow setting next kinematic rotation', () => {
      const node = new Node();
      const rigidBody = node.addComponent(RigidBody2D);
      rigidBody.type = RigidBody2DType.kinematicPositionBased;
      rigidBody.setNextKinematicRotation(Math.PI / 2);
    });
  });

  describe('scene graph transform sync', () => {
    let scene: Scene = undefined!;
    let physicsScene: PhysicsWorld2DSceneComponent = undefined!;

    afterAll(() => {
      scene.destroy();
    });

    beforeAll(() => {
      scene = new Scene('scene-graph-transform-sync');
      director.runSceneImmediate(scene);
      const node = new Node('physics-scene');
      physicsScene = node.addComponent(PhysicsWorld2DSceneComponent);
      physicsScene.settings = createSettings();
      scene.addChild(node);
    });

    it('should require syncTransforms before querying an ancestor transform change in the same frame', () => {
      /// @case
      /// 1. A child fixed rigid body and box collider enter the physics world under a parent at y = 0.
      /// 2. The parent moves to y = 82 in the same frame.
      /// 3. A scene query runs before sync, after explicit syncTransforms, then after the next physics tick.
      /// @expect
      /// Queries stay stale before explicit syncTransforms, then observe the child collider at the updated world transform.
      const parentNode = new Node('query-parent-layer');
      parentNode.parent = physicsScene.node;
      const parentTransform = parentNode.addComponent(Transform2DComponent);
      parentTransform.localPosition = new Vec2(0, 0);
      parentTransform.localRotation = 0;

      const childNode = new Node('query-child-body');
      childNode.parent = parentNode;
      const childTransform = childNode.addComponent(Transform2DComponent);
      childTransform.localPosition = new Vec2(0, 1.330596);
      childTransform.localRotation = 0;
      const rigidBody = childNode.addComponent(RigidBody2D);
      rigidBody.type = RigidBody2DType.fixed;
      rigidBody.tags = ['terrain'];
      const collider = childNode.addComponent(BoxCollider2D);
      collider.halfExtents = new Vec2(0.5, 0.5);

      director.tick(defaultTickDeltaTime);
      expect(rigidBody.impl).toBeDefined();
      const world = physicsScene.physicsWorld!;
      const filter = new SceneQueryFilter().addTargetTag(world.getTagId('terrain'));
      const queryHalfExtents = new Vec2(0.2, 0.2);
      const initialPosition = childTransform.position.clone();
      expect([...world.intersectWithBox(initialPosition, queryHalfExtents, filter)]).toEqual([collider]);

      parentTransform.localY = 82;
      const expectedPositionAfterAncestorMove = childTransform.position.clone();
      const beforeStepImplPosition = fromPx2ImplVec2(rigidBody.impl!.translation());
      const beforeStepImplRotation = rigidBody.impl!.rotation();
      const tickBeforeLowHits = [...world.intersectWithBox(initialPosition, queryHalfExtents, filter)];
      const tickBeforeHighHits = [...world.intersectWithBox(expectedPositionAfterAncestorMove, queryHalfExtents, filter)];
      const afterQueryBeforeSyncImplPosition = fromPx2ImplVec2(rigidBody.impl!.translation());
      const afterQueryBeforeSyncImplRotation = rigidBody.impl!.rotation();

      world.syncTransforms();

      const afterSyncImplPosition = fromPx2ImplVec2(rigidBody.impl!.translation());
      const afterSyncImplRotation = rigidBody.impl!.rotation();
      const afterSyncLowHits = [...world.intersectWithBox(initialPosition, queryHalfExtents, filter)];
      const afterSyncHighHits = [...world.intersectWithBox(expectedPositionAfterAncestorMove, queryHalfExtents, filter)];

      director.tick(defaultTickDeltaTime);

      const afterStepImplPosition = fromPx2ImplVec2(rigidBody.impl!.translation());
      const afterStepImplRotation = rigidBody.impl!.rotation();
      const tickAfterLowHits = [...world.intersectWithBox(initialPosition, queryHalfExtents, filter)];
      const tickAfterHighHits = [...world.intersectWithBox(expectedPositionAfterAncestorMove, queryHalfExtents, filter)];

      expect(beforeStepImplPosition.x).toBeCloseTo(initialPosition.x);
      expect(beforeStepImplPosition.y).toBeCloseTo(initialPosition.y);
      expect(beforeStepImplRotation).toBeCloseTo(0);
      expect(afterQueryBeforeSyncImplPosition.x).toBeCloseTo(initialPosition.x);
      expect(afterQueryBeforeSyncImplPosition.y).toBeCloseTo(initialPosition.y);
      expect(afterQueryBeforeSyncImplRotation).toBeCloseTo(0);
      expect(afterSyncImplPosition.x).toBeCloseTo(expectedPositionAfterAncestorMove.x);
      expect(afterSyncImplPosition.y).toBeCloseTo(expectedPositionAfterAncestorMove.y);
      expect(afterSyncImplRotation).toBeCloseTo(0);
      expect(afterStepImplPosition.x).toBeCloseTo(expectedPositionAfterAncestorMove.x);
      expect(afterStepImplPosition.y).toBeCloseTo(expectedPositionAfterAncestorMove.y);
      expect(afterStepImplRotation).toBeCloseTo(0);
      expect([
        tickBeforeLowHits.length,
        tickBeforeHighHits.length,
        afterSyncLowHits.length,
        afterSyncHighHits.length,
        tickAfterLowHits.length,
        tickAfterHighHits.length,
      ]).toEqual([1, 0, 0, 1, 0, 1]);
      expect(tickBeforeHighHits).not.toEqual([collider]);

      parentNode.destroy();
    });

    it('should not emit or reset contact lifecycle when syncing transforms', () => {
      /// @case
      /// 1. Two overlapping colliders enter the physics world and emit their initial contact begin.
      /// 2. One collider's scale changes, then PhysicsWorld2D.syncTransforms() runs without stepping simulation.
      /// 3. The next physics tick runs while both colliders remain overlapping.
      /// @expect
      /// syncTransforms does not emit contact events, and the next tick keeps the contact lifecycle continuous.
      const fixedNode = new Node('sync-contact-fixed');
      fixedNode.parent = physicsScene.node;
      const fixedTransform = fixedNode.addComponent(Transform2DComponent);
      fixedTransform.localPosition = new Vec2(0, 0);
      const fixedBody = fixedNode.addComponent(RigidBody2D);
      fixedBody.type = RigidBody2DType.fixed;
      fixedBody.tags = ['terrain'];
      const fixedCollider = fixedNode.addComponent(BoxCollider2D);
      fixedCollider.halfExtents = new Vec2(0.5, 0.5);

      const dynamicNode = new Node('sync-contact-dynamic');
      dynamicNode.parent = physicsScene.node;
      const dynamicTransform = dynamicNode.addComponent(Transform2DComponent);
      dynamicTransform.localPosition = new Vec2(0, 0);
      const dynamicBody = dynamicNode.addComponent(RigidBody2D);
      dynamicBody.type = RigidBody2DType.dynamic;
      dynamicBody.tags = ['terrain'];
      dynamicBody.gravityScale = 0;
      const dynamicCollider = dynamicNode.addComponent(BoxCollider2D);
      dynamicCollider.halfExtents = new Vec2(0.5, 0.5);

      let beginCount = 0;
      let stayCount = 0;
      let endCount = 0;
      fixedCollider.onContactBegin.add(() => beginCount++);
      fixedCollider.onContactStay.add(() => stayCount++);
      fixedCollider.onContactEnd.add(() => endCount++);

      director.tick(defaultTickDeltaTime);
      expect(beginCount).toBe(1);
      expect(stayCount).toBe(0);
      expect(endCount).toBe(0);

      beginCount = 0;
      stayCount = 0;
      endCount = 0;
      dynamicTransform.scale = new Vec2(1.25, 1.25);
      physicsScene.physicsWorld!.syncTransforms();
      expect([beginCount, stayCount, endCount]).toEqual([0, 0, 0]);

      director.tick(defaultTickDeltaTime);
      expect(beginCount).toBe(0);
      expect(stayCount).toBe(1);
      expect(endCount).toBe(0);

      fixedNode.destroy();
      dynamicNode.destroy();
    });
  });
});

function createSettings() {
  const settings = new Physics2DSettings();
  const settingsWithTags = settings as unknown as { _tags: Record<string, number> };
  settingsWithTags._tags = { terrain: 0 };
  settings.collisionMatrix.set(0, 0, true);
  return settings;
}
