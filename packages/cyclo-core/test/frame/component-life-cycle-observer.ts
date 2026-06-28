import { _decorator } from 'cc';
import {
  CycloComponent,
  type Coroutine,
  type CoroutineIterator,
  type StartCoroutineOptions,
} from '@/export/framework.js';

export class ComponentLifeCycleObserver extends CycloComponent {
  onUpdateCallback: ((deltaTime: number) => void) | undefined = undefined;
  onFixedUpdateCallback: ((deltaTime: number) => void) | undefined = undefined;
  onLateUpdateCallback: ((deltaTime: number) => void) | undefined = undefined;

  invokeStartCoroutine(generator: (this: ComponentLifeCycleObserver) => CoroutineIterator, opts?: StartCoroutineOptions): Coroutine {
    return this.startCoroutine(generator.call(this), opts);
  }

  invokeStopCoroutine(handle: Coroutine): void {
    this.stopCoroutine(handle);
  }

  invokeStopAllCoroutines(): void {
    this.stopAllCoroutines();
  }

  protected override onUpdate(deltaTime: number): void {
    this.onUpdateCallback?.(deltaTime);
  }

  protected override onFixedUpdate(deltaTime: number): void {
    this.onFixedUpdateCallback?.(deltaTime);
  }

  protected override onLateUpdate(deltaTime: number): void {
    this.onLateUpdateCallback?.(deltaTime);
  }
}

_decorator.ccclass('ComponentLifeCycleObserver')(ComponentLifeCycleObserver);
