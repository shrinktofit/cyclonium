import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { director, Node, Scene, Vec3 } from 'cc';
import { PhysicsWorld2DSceneComponent } from '@/physics-world-2d-scene-component.js';
import { BoxCollider2D, SceneQueryFilter } from '@/index.js';
import { Vec2 } from '@cyclonium/core/math/vec2';

const defaultTickDeltaTime = 1 / 60;

describe('PhysicsWorld2D scene query', () => {
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

  describe('intersectWithCircle', () => {
    it('should return empty when no collider intersects', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(0, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const filter = new SceneQueryFilter();
      const hits = [...world!.intersectWithCircle(new Vec2(100, 0), 1, filter)];

      expect(hits.length).toBe(0);
      targetNode.destroy();
    });
  });

  describe('intersectWithBox', () => {
    it('should return empty when no collider intersects', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(0, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const filter = new SceneQueryFilter();
      const hits = [...world!.intersectWithBox(new Vec2(100, 0), new Vec2(1, 1), filter)];

      expect(hits.length).toBe(0);
      targetNode.destroy();
    });

    it('should return empty with rotated box', () => {
      const targetNode = new Node('target');
      targetNode.parent = physicsScene.node;
      targetNode.worldPosition = new Vec3(0, 0, 0);
      targetNode.addComponent(BoxCollider2D);
      director.tick(defaultTickDeltaTime);

      const world = physicsScene.physicsWorld;
      const filter = new SceneQueryFilter();
      const hits = [...world!.intersectWithBox(new Vec2(0.5, 0.5), new Vec2(1, 1), filter, Math.PI / 4)];

      expect(hits.length).toBe(0);
      targetNode.destroy();
    });
  });

  describe('SceneQueryFilter', () => {
    it('should exclude dynamics', () => {
      const filter = new SceneQueryFilter();
      expect(filter.dynamics).toBe(true);
      filter.dynamics = false;
      expect(filter.dynamics).toBe(false);
    });

    it('should exclude fixed', () => {
      const filter = new SceneQueryFilter();
      expect(filter.fixed).toBe(true);
      filter.fixed = false;
      expect(filter.fixed).toBe(false);
    });

    it('should exclude kinematics', () => {
      const filter = new SceneQueryFilter();
      expect(filter.kinematics).toBe(true);
      filter.kinematics = false;
      expect(filter.kinematics).toBe(false);
    });

    it('should exclude sensors', () => {
      const filter = new SceneQueryFilter();
      expect(filter.sensors).toBe(true);
      filter.sensors = false;
      expect(filter.sensors).toBe(false);
    });

    it('should exclude solids', () => {
      const filter = new SceneQueryFilter();
      expect(filter.solids).toBe(true);
      filter.solids = false;
      expect(filter.solids).toBe(false);
    });

    it('should add target tag', () => {
      const filter = new SceneQueryFilter();
      const result = filter.addTargetTag(5);
      expect(result).toBe(filter);
    });

    it('should allow chaining tag addition', () => {
      const filter = new SceneQueryFilter();
      const result = filter.addTargetTag(1).addTargetTag(2);
      expect(result).toBe(filter);
    });
  });
});
