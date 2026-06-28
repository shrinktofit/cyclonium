import type { Scene } from 'cc';
import type { PhysicsWorld2D } from './physics-world-2d.js';
import { assert } from '@cyclonium/core/utils';

/// This file serves as de-circle dependency.

const sceneToWorld = new Map<Scene, PhysicsWorld2D>();
const worldToScene = new Map<PhysicsWorld2D, Scene>();

export function registerPhysicsWorld(scene: Scene, world: PhysicsWorld2D) {
  if (sceneToWorld.has(scene)) {
    throw new Error('Physics world already registered for a scene.');
  }
  if (worldToScene.has(world)) {
    throw new Error('The scene already has a physics world registered.');
  }
  sceneToWorld.set(scene, world);
  worldToScene.set(world, scene);
}

export function unregisterPhysicsWorld(world: PhysicsWorld2D) {
  const scene = worldToScene.get(world);
  if (!scene) {
    throw new Error('No physics world registered for the scene.');
  }
  sceneToWorld.delete(scene);
  assert(worldToScene.delete(world));
}

export function getPhysicsWorld(scene: Scene) {
  return sceneToWorld.get(scene);
}
