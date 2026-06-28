import { Node } from 'cc';
import { CycloComponent } from '@cyclonium/core/framework';
import type { PhysicsWorld2D } from './physics-world-2d.js';
import { cycloBuiltinClass } from '@cyclonium/core/internal';
import { getPhysicsWorld } from './physics-world-registry.js';

export const invokeOnSyncTransforms: (component: PhysicsComponent2DBase, forceTransform: boolean, forceScale: boolean) => void = (
  component,
  forceTransform,
  forceScale,
) => {
  // @ts-expect-error protected hook invoker
  return component.onSyncTransforms(forceTransform, forceScale);
};

export const invokeOnAfterStep: (component: PhysicsComponent2DBase) => void = (component) => {
  // @ts-expect-error protected hook invoker
  return component.onAfterPhysicsStep();
};

@cycloBuiltinClass({ abstract: true })
export abstract class PhysicsComponent2DBase extends CycloComponent {
  protected get world() {
    return this._physicsWorld;
  }

  protected abstract onAttachToWorld(world: PhysicsWorld2D): void;

  protected abstract onDetachFromWorld(world: PhysicsWorld2D): void;

  protected onSyncTransforms(_forceTransform: boolean, _forceScale: boolean): void {}

  protected onAfterPhysicsStep(): void {}

  protected override onAwake(): void {
    if (!this._attached) {
      this._tryAttach();
    }
  }

  protected override onStart(): void {
    if (!this._attached) {
      this._tryAttach();
    }
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this._tryDetach();
  }

  protected override onEnabled(): void {
    if (!this._firstEnabled) {
      return;
    }
    this._firstEnabled = false;
    this.node.on(Node.EventType.PARENT_CHANGED, this._handleAncestorChange, this);
    this._tryAttach();
  }

  private _physicsWorld: PhysicsWorld2D | null = null;
  private _firstEnabled = true;
  private _attached = false;

  private _handleAncestorChange() {
    if (this.node) {
      this._tryAttach();
    } else {
      this._tryDetach();
    }
  }

  private _tryAttach() {
    const node = this.node;
    const physicsWorld = getPhysicsWorld(node.scene);
    if (physicsWorld === this._physicsWorld) {
      return;
    }
    this._tryDetach();
    if (physicsWorld) {
      this._physicsWorld = physicsWorld;
      this._attached = true;
      this.onAttachToWorld(physicsWorld);
      physicsWorld.listenersOnWillDestroy.add(() => this._tryDetach(), { signal: this.destroyingSignal });
    }
  }

  private _tryDetach() {
    if (!this._physicsWorld) {
      return;
    }
    this._attached = false;
    this.onDetachFromWorld(this._physicsWorld);
    this._physicsWorld = null;
  }
}
