import { Component, director, Node } from 'cc';
import { cycloBuiltinClass } from '../decorator/legacy/legacy-general-decorator.ts';
import { AbortController, AbortSignal } from '@cyclonium/abort-controller';
import { addFrameTask, TaskPriority } from './tasking.ts';
import { CoroutineRunner, stopCoroutine as stopCoroutineRecord, type Coroutine, type CoroutineIterator, type StartCoroutineOptions } from './coroutine.ts';
import { retainIf } from '@cyclonium/algorithm/retain-if';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';

class ComponentScheduler {
  enableComponent(component: CycloComponent) {
    const index = this._fixedUpdateRegistry.findIndex(({ component: c }) => c === component);
    if (index < 0) {
      this._fixedUpdateRegistry.push({ component, enabled: true });
    } else {
      this._fixedUpdateRegistry[index].enabled = true;
    }
  }

  disableComponent(component: CycloComponent) {
    const index = this._fixedUpdateRegistry.findIndex(({ component: c }) => c === component);
    if (index >= 0) {
      this._fixedUpdateRegistry[index].enabled = false;
    }
  }

  prune() {
    retainIf(this._fixedUpdateRegistry, ({ enabled }) => enabled);
    retainIf(this._coroutineUpdateRegistry, ({ enabled }) => enabled);
  }

  invokeFixedUpdate(deltaTime: number) {
    for (const { component, enabled } of this._fixedUpdateRegistry) {
      if (enabled) {
        invokeComponentFixedUpdate(component, deltaTime);
      }
    }
  }

  enableCoroutineUpdate(component: CycloComponent) {
    const index = this._coroutineUpdateRegistry.findIndex(({ component: c }) => c === component);
    if (index < 0) {
      this._coroutineUpdateRegistry.push({ component, enabled: true });
    } else {
      this._coroutineUpdateRegistry[index].enabled = true;
    }
  }

  disableCoroutineUpdate(component: CycloComponent) {
    const index = this._coroutineUpdateRegistry.findIndex(({ component: c }) => c === component);
    if (index >= 0) {
      this._coroutineUpdateRegistry[index].enabled = false;
    }
  }

  invokeCoroutineUpdate(deltaTime: number) {
    const count = this._coroutineUpdateRegistry.length;
    for (let i = 0; i < count; i++) {
      const { component, enabled } = this._coroutineUpdateRegistry[i];
      if (enabled) {
        invokeComponentCoroutineUpdate(component, deltaTime);
      }
    }
  }

  private _fixedUpdateRegistry: Array<{
    component: CycloComponent;
    enabled: boolean;
  }> = [];

  private _coroutineUpdateRegistry: Array<{
    component: CycloComponent;
    enabled: boolean;
  }> = [];
}

const globalComponentScheduler = new ComponentScheduler();

let invokeComponentFixedUpdate: (component: CycloComponent, deltaTime: number) => void;
let invokeComponentCoroutineUpdate: (component: CycloComponent, deltaTime: number) => void;

@cycloBuiltinClass({ abstract: true })
export class CycloComponent extends Component {
  static of<TThis extends abstract new (...args: never[]) => CycloComponent>(this: TThis, componentOrNode: CycloComponent | Node): InstanceType<TThis> {
    const instance = (componentOrNode instanceof Component ? componentOrNode.node : componentOrNode).getComponent(this as unknown as new (...args: unknown[]) => InstanceType<TThis>);
    if (!instance) {
      throw new Error(`Component ${this.name} is not attached to entity ${componentOrNode.name}.`);
    }
    return instance;
  }

  static ofOrNull<TThis extends abstract new (...args: never[]) => CycloComponent>(this: TThis, componentOrNode: CycloComponent | Node): InstanceType<TThis> | null {
    return (componentOrNode instanceof Component ? componentOrNode.node : componentOrNode).getComponent(this as unknown as new (...args: unknown[]) => InstanceType<TThis>) ?? null;
  }

  static existsOn<TThis extends abstract new (...args: never[]) => CycloComponent>(this: TThis, componentOrNode: CycloComponent | Node): boolean {
    return !!((componentOrNode instanceof Component ? componentOrNode.node : componentOrNode).getComponent(this as unknown as new (...args: unknown[]) => InstanceType<TThis>));
  }

  /**
     * @internal
     */
  _invokeFixedUpdate(deltaTime: number) {
    this.onFixedUpdate(deltaTime);
  }

  /**
     * @internal
     */
  _invokeCoroutineUpdate(deltaTime: number): void {
    if (!this._coroutines) {
      return;
    }

    if (!this.node.activeInHierarchy) {
      this.stopAllCoroutines();
      return;
    }

    this._coroutines.update(deltaTime);
    this._clearCoroutinesIfEmpty();
  }

  protected get destroyingSignal(): AbortSignal {
    return (this._destroyingController ??= new AbortController()).signal;
  }

  protected get disablingSignal(): AbortSignal {
    return (this._disablingController ??= new AbortController()).signal;
  }

  protected onAwake() {}

  protected onEnabled() {}

  protected onDisabled() {}

  protected override onDestroy(): void {
    this.stopAllCoroutines();
    this._destroyingController?.abort();
    this._destroyingController = undefined;
  }

  protected onStart() {}

  protected onUpdate(_deltaTime: number) {}

  protected onFixedUpdate(_deltaTime: number) {}

  protected onLateUpdate(_deltaTime: number) {}

  protected onFrameEnd() {}

  /**
   * Starts a coroutine owned by this component.
   * @param coroutine - Coroutine iterator to start.
   * @param opts - Optional start options, including an abort signal that can stop the coroutine.
   * @returns An opaque coroutine handle that can be passed to `stopCoroutine`.
   * @description
   * The coroutine starts immediately and runs until its first yield before this
   * method returns. Component `enabled = false` does not pause it; it is stopped
   * when the owning node becomes inactive in hierarchy or when the component is destroyed.
   * Coroutines resume after all component `onUpdate` calls and before fixed updates.
   * @example
   * ```ts
   * protected override onStart(): void {
   *   this.startCoroutine(this.destroyLater());
   * }
   *
   * private *destroyLater(): CoroutineIterator {
   *   yield waitFor(1);
   *   this.node.destroy();
   * }
   * ```
   */
  protected startCoroutine(coroutine: CoroutineIterator, opts?: StartCoroutineOptions): Coroutine {
    const coroutines = this._coroutines ??= new CoroutineRunner();
    const handle = coroutines.start(coroutine, opts);
    if (!coroutines.empty) {
      globalComponentScheduler.enableCoroutineUpdate(this);
    }
    this._clearCoroutinesIfEmpty();
    return handle;
  }

  /**
   * Stops a coroutine handle.
   * @param coroutine - Coroutine handle returned by `startCoroutine`.
   * @description
   * Stopping marks the coroutine so it will not resume on later frames. If this
   * is called while that same coroutine is currently executing, it does not abort
   * the current call stack; code after the stop call keeps running until the
   * coroutine yields or returns.
   */
  protected stopCoroutine(coroutine: Coroutine): void {
    if (this._coroutines) {
      this._coroutines.stop(coroutine);
    } else {
      stopCoroutineRecord(coroutine);
    }
    this._clearCoroutinesIfEmpty();
  }

  /**
   * Stops all coroutines owned by this component.
   * @description
   * Existing coroutines are marked as stopped and will not resume on later frames.
   * Calling this from inside a coroutine does not abort the current call stack;
   * the currently executing body keeps running until it yields or returns.
   * Coroutines started during stop cleanup are treated as new coroutines and are
   * not included in the batch being stopped.
   */
  protected stopAllCoroutines(): void {
    const coroutines = this._coroutines;
    if (!coroutines) {
      return;
    }

    this._coroutines = undefined;
    globalComponentScheduler.disableCoroutineUpdate(this);
    coroutines.stopAll();
  }

  protected override onLoad(): void {
    this.onAwake();
  }

  /**
   * @internal
   */
  protected override onEnable(): void {
    globalComponentScheduler.enableComponent(this);
    this.onEnabled();
  }

  /**
   * @internal
   */
  protected override onDisable(): void {
    globalComponentScheduler.disableComponent(this);
    if (!this.node.activeInHierarchy) {
      this.stopAllCoroutines();
    }
    this.onDisabled();
    this._disablingController?.abort();
    this._disablingController = undefined;
  }

  protected override start(): void {
    this.onStart();
  }

  protected override lateUpdate(deltaTime: number): void {
    this.onLateUpdate(deltaTime);
    this.onFrameEnd();
  }

  /**
   * @deprecated
   */
  protected override update(deltaTime: number): void {
    this.onUpdate(deltaTime);
  }

  private _coroutines: CoroutineRunner | undefined = undefined;

  private _disablingController: AbortController | undefined = undefined;

  private _destroyingController: AbortController | undefined = undefined;

  private _clearCoroutinesIfEmpty(): void {
    if (this._coroutines?.empty) {
      this._coroutines = undefined;
      globalComponentScheduler.disableCoroutineUpdate(this);
    }
  }

  static {
    invokeComponentFixedUpdate = (component: CycloComponent, deltaTime: number) => {
      if (component.onFixedUpdate !== CycloComponent.prototype.onFixedUpdate) {
        component.onFixedUpdate(deltaTime);
      }
    };

    invokeComponentCoroutineUpdate = (component: CycloComponent, deltaTime: number) => {
      component._invokeCoroutineUpdate(deltaTime);
    };
  }
}

class CoroutineUpdateTask {
  update(deltaTime: number) {
    globalComponentScheduler.invokeCoroutineUpdate(deltaTime);
  }
}

class FixedUpdateTask {
  maxSteps = 2;

  update(deltaTime: number) {
    const scene = director.getScene();
    if (!scene) {
      this._accumulatedTime = 0;
      return;
    }

    const fixedTimeStep = this._fixedTimeStep;
    const maxSteps = this.maxSteps;
    const accumulatedTime = this._accumulatedTime + deltaTime;
    const expectedSteps = Math.floor(accumulatedTime / fixedTimeStep);
    const overloading = expectedSteps > maxSteps;
    const previousOverloading = this._overloading;
    this._overloading = overloading;

    let actualSteps = 0;
    if (overloading) {
      actualSteps = maxSteps;
      this._accumulatedTime = 0;
      if (overloading !== previousOverloading) {
        this._emitOverloadingBegin(expectedSteps);
      }
    } else {
      actualSteps = expectedSteps;
      this._accumulatedTime = accumulatedTime - actualSteps * fixedTimeStep;
      if (overloading !== previousOverloading) {
        this._emitOverloadingEnd();
      }
    }

    for (let i = 0; i < actualSteps; i++) {
      globalComponentScheduler.invokeFixedUpdate(fixedTimeStep);
    }
  }

  private _fixedTimeStep = 1 / 60;
  private _accumulatedTime = 0;
  private _overloading = false;

  private _emitOverloadingBegin(expectedSteps: number) {
    // todo
    void expectedSteps;
  }

  private _emitOverloadingEnd() {
    // todo
  }
}

if (!EDITOR_NOT_IN_PREVIEW) {
  const fixedUpdatePriority = TaskPriority.before(TaskPriority.predefined.componentsLateUpdate);

  addFrameTask({
    thisArg: new CoroutineUpdateTask(),

    priority: TaskPriority.between(fixedUpdatePriority, TaskPriority.predefined.componentsLateUpdate),

    fn: CoroutineUpdateTask.prototype.update,
  });

  addFrameTask({
    thisArg: new FixedUpdateTask(),

    priority: fixedUpdatePriority,

    fn: FixedUpdateTask.prototype.update,
  });

  addFrameTask({
    thisArg: undefined,

    priority: TaskPriority.after(TaskPriority.predefined.componentsLateUpdate),

    fn: () => {
      globalComponentScheduler.prune();
    },
  });
}
