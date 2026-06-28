import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { director, Node, Scene, Vec3 } from 'cc';
import { Transform2DComponent } from '@cyclonium/core/2d';
import { Vec2 } from '@cyclonium/core/math/vec2';
import { PolygonCollider2D } from '@/colliders/polygon-collider-2d.js';
import { PhysicsWorld2DSceneComponent } from '@/physics-world-2d-scene-component.js';

const defaultTickDeltaTime = 1 / 60;

describe('PolygonCollider2D', () => {
  it('should have empty points by default', () => {
    const node = new Node();
    const collider = node.addComponent(PolygonCollider2D);
    expect(collider.points).toEqual([]);
  });

  it('should set polygon points', () => {
    const node = new Node();
    const collider = node.addComponent(PolygonCollider2D);
    const points = [
      new Vec2(0, 0),
      new Vec2(1, 0),
      new Vec2(1, 1),
      new Vec2(0, 1),
    ];
    collider.setPolygon(points);
    expect(collider.points.length).toBe(4);
  });

  it('should set polygon with indices', () => {
    const node = new Node();
    const collider = node.addComponent(PolygonCollider2D);
    const points = [
      new Vec2(0, 0),
      new Vec2(1, 0),
      new Vec2(1, 1),
      new Vec2(0, 1),
    ];
    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
    collider.setPolygon(points, indices);
    expect(collider.points.length).toBe(4);
  });

  describe('runtime transform scale', () => {
    let scene: Scene = undefined!;
    let physicsScene: PhysicsWorld2DSceneComponent = undefined!;

    beforeAll(() => {
      scene = new Scene('test-scene');
      director.runSceneImmediate(scene);
      const node = new Node('physics-scene');
      physicsScene = node.addComponent(PhysicsWorld2DSceneComponent);
      scene.addChild(node);
    });

    afterAll(() => {
      scene.destroy();
    });

    it('should update physics queries after transform scale changes', () => {
      /// @case
      /// 1. A polygon collider creates a horizontal segment at scale 1.
      /// 2. The transform scale widens the segment after the collider exists.
      /// @expect
      /// Physics queries use the widened polygon shape after the next physics tick.
      const targetNode = new Node('scaled-segment');
      targetNode.parent = physicsScene.node;
      const transform = targetNode.addComponent(Transform2DComponent);
      const collider = targetNode.addComponent(PolygonCollider2D);
      collider.setPolygon([
        new Vec2(-1, 0),
        new Vec2(1, 0),
      ], [0, 1]);

      director.tick(defaultTickDeltaTime);
      const world = physicsScene.physicsWorld!;
      expect(world.castCircle({
        radius: 0.05,
        position: new Vec2(1.5, 2),
      }, {
        direction: new Vec2(0, -1),
        maxDistance: 5,
      })).toBeUndefined();

      transform.scale = new Vec2(2, 1);
      director.tick(defaultTickDeltaTime);

      const hit = world.castCircle({
        radius: 0.05,
        position: new Vec2(1.5, 2),
      }, {
        direction: new Vec2(0, -1),
        maxDistance: 5,
      });
      expect(hit).toBeDefined();
      expect(hit!.collider).toBe(collider);

      targetNode.destroy();
    });

    it('should update physics queries after node world scale changes directly', () => {
      /// @case
      /// 1. A polygon collider creates a horizontal segment at scale 1.
      /// 2. The Cocos node world scale widens the segment without using Transform2D setters.
      /// @expect
      /// Physics queries use the widened polygon shape after the next physics tick.
      const targetNode = new Node('direct-scaled-segment');
      targetNode.parent = physicsScene.node;
      targetNode.addComponent(Transform2DComponent);
      const collider = targetNode.addComponent(PolygonCollider2D);
      collider.setPolygon([
        new Vec2(-1, 0),
        new Vec2(1, 0),
      ], [0, 1]);

      director.tick(defaultTickDeltaTime);
      const world = physicsScene.physicsWorld!;
      expect(world.castCircle({
        radius: 0.05,
        position: new Vec2(1.5, 2),
      }, {
        direction: new Vec2(0, -1),
        maxDistance: 5,
      })).toBeUndefined();

      targetNode.worldScale = new Vec3(2, 1, 1);
      director.tick(defaultTickDeltaTime);

      const hit = world.castCircle({
        radius: 0.05,
        position: new Vec2(1.5, 2),
      }, {
        direction: new Vec2(0, -1),
        maxDistance: 5,
      });
      expect(hit).toBeDefined();
      expect(hit!.collider).toBe(collider);

      targetNode.destroy();
    });
  });
});
