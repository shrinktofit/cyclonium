/* eslint-disable @typescript-eslint/no-explicit-any */

import { prune } from '@cyclonium/algorithm/prune';
import type { EventListenerOptions } from './common.js';

export type EventCallback<TEventArgs extends any[]> = (...args: TEventArgs) => void;

enum ErrorBehavior {
  throwImmediately = 'throwImmediately',
  throwInMicrotask = 'throwInMicrotask',
}

enum Flag {
  deferError = 1 << 0,
}

export class EventEmitter<TEventArgs extends any[] = []> {
  constructor(opts?: {
    /**
     * If `true`, errors will be thrown in a microtask, otherwise they will be thrown immediately.
     */
    errorBehavior?: boolean;

    /**
     * If specified, for those callbacks which returns a promise and the promise rejects, this function will be called.
     * @error The error that the promise rejects with.
     * @args The emit arguments.
     */
    captureRejections?: (error: unknown, ...args: TEventArgs) => void;
  }) {
    let flags = 0;
    const errorBehaviorOpt = opts?.errorBehavior;
    const errorBehavior = errorBehaviorOpt ? ErrorBehavior.throwInMicrotask : ErrorBehavior.throwImmediately;
    if (errorBehavior === ErrorBehavior.throwInMicrotask) {
      flags |= Flag.deferError;
    }
    if (typeof opts?.captureRejections === 'function') {
      this._captureRejections = opts.captureRejections;
    }
    this._flags = flags;
  }

  get listenerCount() {
    const callbacks = this._callbacks;
    if (callbacks === undefined) {
      return 0;
    }
    if (typeof callbacks === 'function') {
      return 1;
    }
    return callbacks.length;
  }

  add(callback: EventCallback<TEventArgs>, options?: EventListenerOptions) {
    const signal = options?.signal;
    const once = options?.once;
    const added = this._addCallback(callback);
    if (!added) {
      return;
    }
    if (once) {
      if (!this._onceMarks) {
        const onceMark = this._onceMarks = new Set();
        onceMark.add(callback);
      }
    }
    if (signal) {
      signal.addEventListener('abort', () => {
        this.remove(callback);
      });
    }
  }

  remove(callback: EventCallback<TEventArgs>) {
    const callbacks = this._callbacks;
    const onceMarks = this._onceMarks;
    if (onceMarks) {
      onceMarks.delete(callback);
      if (onceMarks.size === 0) {
        this._onceMarks = undefined;
      }
    }
    if (callbacks === undefined) {
      return;
    }
    if (typeof callbacks === 'function') {
      if (callbacks === callback) {
        this._callbacks = undefined;
      }
      return;
    }
    const index = callbacks.indexOf(callback);
    if (index >= 0) {
      callbacks.splice(index, 1);
    }
  }

  removeAll() {
    this._callbacks = undefined;
    this._onceMarks = undefined;
  }

  emit(...args: TEventArgs) {
    const callbacks = this._callbacks;
    if (callbacks === undefined) {
      return;
    }
    if (typeof callbacks === 'function') {
      let callbackReturns: unknown;
      if (this._flags & Flag.deferError) {
        try {
          callbackReturns = callbacks.call(undefined, ...args);
        } catch (e) {
          throwListenerException(e);
        }
      } else {
        callbackReturns = callbacks.call(undefined, ...args);
      }
      this._handleCallbackReturns(callbackReturns, args);
    } else {
      const clonedCallbacks = callbacks.slice();
      for (const callback of clonedCallbacks) {
        let callbackReturns: unknown;
        if (this._flags & Flag.deferError) {
          try {
            callbackReturns = callback.call(undefined, ...args);
          } catch (e) {
            throwListenerException(e);
            continue;
          }
        } else {
          callbackReturns = callback.call(undefined, ...args);
        }
        this._handleCallbackReturns(callbackReturns, args);
      }
    }
    this._removeOnceCallbacks();
  }

  private _callbacks: undefined | EventCallback<TEventArgs> | EventCallback<TEventArgs>[] = undefined;

  private _onceMarks: Set<EventCallback<TEventArgs>> | undefined = undefined;

  private _flags: number = 0;

  private _captureRejections: ((error: unknown, ...args: TEventArgs) => void) | undefined = undefined;

  private _addCallback(callback: EventCallback<TEventArgs>) {
    const existingCallbacks = this._callbacks;
    if (existingCallbacks === undefined) {
      this._callbacks = callback;
    } else if (typeof existingCallbacks === 'function') {
      if (existingCallbacks === callback) {
        return false;
      }
      this._callbacks = [existingCallbacks, callback];
    } else {
      if (existingCallbacks.includes(callback)) {
        return false;
      }
      existingCallbacks.push(callback);
    }
    return true;
  }

  private _removeOnceCallbacks() {
    const onceMarks = this._onceMarks;
    if (!onceMarks) {
      return;
    }
    const callbacks = this._callbacks;
    assert(callbacks !== undefined);
    if (typeof callbacks === 'function') {
      this._callbacks = undefined;
    } else {
      prune(callbacks, (callback) => !onceMarks.has(callback));
    }
    this._onceMarks = undefined;
  }

  private _handleCallbackReturns(callbackReturns: unknown, emitArgs: TEventArgs) {
    const _captureRejections = this._captureRejections;
    if (!_captureRejections) {
      return;
    }
    if (callbackReturns instanceof Promise) {
      callbackReturns.catch((e) => {
        _captureRejections(e, ...emitArgs);
      });
    }
  }
}

export interface EventListenerRegistry<TEventArgs extends any[] = []> {
  add(callback: EventCallback<TEventArgs>, options?: EventListenerOptions): void;

  remove(callback: EventCallback<TEventArgs>): void;
}

export class ManagedEventEmitter<TEventArgs extends any[] = []> extends EventEmitter<TEventArgs> {
  get registry() {
    if (!this._registry) {
      this._registry = {
        add: this.add.bind(this),
        remove: this.remove.bind(this),
      };
    }
    return this._registry;
  }

  private _registry: undefined | EventListenerRegistry<TEventArgs>;
}

function throwListenerException(exception: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  Promise.resolve().then(() => {
    throw exception;
  });
}

function assert<T>(expr: T): asserts expr {
  if (!expr) {
    throw new Error(`Assertion failed`);
  }
}
