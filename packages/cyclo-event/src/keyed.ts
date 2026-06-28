/* eslint-disable @typescript-eslint/no-explicit-any */

import type { EventListenerOptions } from './common.js';
import { EventEmitter } from './emitter.js';

export type EventCallback<TEventArgs extends any[]> = (...args: TEventArgs) => void;

export type EventEmitterKey = string | number;

type EventArgsMap = { [key in EventEmitterKey]: [...any[]] };

type EventArgs<TEventArgsMap extends EventArgsMap, TKey extends keyof TEventArgsMap> = TEventArgsMap[TKey];

export class KeyedEventEmitter<TEventArgsMap extends EventArgsMap> {
  constructor(opts?: {
    errorBehavior?: boolean;

    /**
     * If specified, for those callbacks which returns a promise and the promise rejects, this function will be called.
     * @error The error that the promise rejects with.
     * @key The key that the callback is registered on.
     * @args The emit arguments.
     */
    captureRejections?: (error: unknown, key: keyof TEventArgsMap, ...args: EventArgs<TEventArgsMap, keyof TEventArgsMap>) => void;
  }) {
    this._errorBehavior = opts?.errorBehavior;
    this._captureRejections = opts?.captureRejections;
  }

  add<TKey extends keyof TEventArgsMap>(key: TKey, callback: EventCallback<TEventArgsMap[TKey]>, options?: EventListenerOptions) {
    let emitter = this._emitters.get(key) as EventEmitter<TEventArgsMap[TKey]> | undefined;
    if (!emitter) {
      const emitterOpts: ConstructorParameters<typeof EventEmitter>[0] = {};
      if (this._errorBehavior) {
        emitterOpts.errorBehavior = true;
      }
      const captureRejections = this._captureRejections;
      if (captureRejections) {
        emitterOpts.captureRejections = (error: unknown, ...args: TEventArgsMap[TKey]) => {
          captureRejections(error, key as EventEmitterKey, ...args);
        };
      }
      emitter = new EventEmitter<TEventArgsMap[TKey]>(emitterOpts);
      this._emitters.set(key, emitter as EventEmitter<TEventArgsMap[keyof TEventArgsMap]>);
    }
    emitter.add(callback, options);
  }

  remove<TKey extends keyof TEventArgsMap>(key: TKey, callback: EventCallback<TEventArgsMap[TKey]>) {
    const emitter = this._emitters.get(key);
    if (emitter) {
      emitter.remove(callback as EventCallback<TEventArgsMap[keyof TEventArgsMap]>);
      if (emitter.listenerCount === 0) {
        this._emitters.delete(key);
      }
    }
  }

  removeAll(key: keyof TEventArgsMap) {
    this._emitters.delete(key);
  }

  emit<TKey extends keyof TEventArgsMap>(key: TKey, ...args: TEventArgsMap[TKey]) {
    const emitter = this._emitters.get(key);
    if (emitter) {
      emitter.emit(...args);
      if (emitter.listenerCount === 0) {
        this._emitters.delete(key);
      }
    }
  }

  listenersCountOn(key: keyof TEventArgsMap) {
    const emitter = this._emitters.get(key);
    if (emitter) {
      return emitter.listenerCount;
    }
    return 0;
  }

  private _emitters = new Map<keyof TEventArgsMap, EventEmitter<TEventArgsMap[keyof TEventArgsMap]>>();

  private _errorBehavior: boolean | undefined;

  private _captureRejections: ((error: unknown, key: EventEmitterKey, ...args: any[]) => void) | undefined;
}

export interface KeyedEventListenerRegistry<TEventArgsMap extends { [key in EventEmitterKey]: [...any[]] }> {
  add<TKey extends keyof TEventArgsMap>(key: TKey, callback: EventCallback<TEventArgsMap[TKey]>, options?: EventListenerOptions): void;

  remove<TKey extends keyof TEventArgsMap>(key: TKey, callback: EventCallback<TEventArgsMap[TKey]>): void;
}

export class ManagedKeyedEventEmitter<TEventArgsMap extends { [key in EventEmitterKey]: [...any[]] }> extends KeyedEventEmitter<TEventArgsMap> {
  get registry() {
    if (!this._registry) {
      this._registry = {
        add: this.add.bind(this),
        remove: this.remove.bind(this),
      };
    }
    return this._registry;
  }

  private _registry: undefined | KeyedEventListenerRegistry<TEventArgsMap>;
}
