import { HandleInputContext, HandleMouseButton, type HandleHostInput } from './handle-input.js';
import { HandleRenderer } from './handle-renderer.js';
import { Node } from 'cc';

export class HandleContext {
  constructor(hostInput: HandleHostInput, opts: {
    renderer: {
      node: Node;
    };
  }) {
    this._inputContext = new HandleInputContext(hostInput);
    this._pushScope('');
    this._renderer = new HandleRenderer(opts.renderer);
  }

  get now() {
    return this._now;
  }

  get input() {
    return this._inputContext;
  }

  get renderer() {
    return this._renderer;
  }

  destroy_internal() {
    this._renderer.destroy_internal();
  }

  forEach<T>(
    iterable: ReadonlyArray<T>,
    keyGenerator: (item: T) => string,
    callback: (item: T, index: number) => void,
  ) {
    for (const [index, item] of iterable.entries()) {
      const key = keyGenerator(item);
      this._pushScope(key);
      try {
        callback(item, index);
      } finally {
        this._popScope();
      }
    }
  }

  allocateSequentialKey() {
    const scope = this._currentScope[this._currentScope.length - 1];
    const sequentialId = scope.nextSequentialIndex++;
    return `${scope.key}/${sequentialId}` as HandleKey;
  }

  pushScope(key: string) {
    this._pushScope(key);
  }

  popScope() {
    this._popScope();
  }

  startFrame_internal(opts: HandleContext.FrameStartOptions) {
    this._now = Date.now();
    this._inputContext.startFrame_internal(opts);
    this._renderer.startFrame();
  }

  endFrame_internal() {
    for (const callback of this._endFrameCallbacks) {
      callback();
    }
    this._endFrameCallbacks.length = 0;
    this._currentScope.length = 1;
    this._inputContext.endFrame_internal();
    this._renderer.endFrame();
  }

  queueFrameEndTask_internal(callback: () => void) {
    this._endFrameCallbacks.push(callback);
  }

  private readonly _currentScope: Scope[] = [];
  private _inputContext: HandleInputContext;
  private _now: number = Date.now();
  private _endFrameCallbacks: (() => void)[] = [];
  private _renderer: HandleRenderer;

  private _pushScope(key: string) {
    this._currentScope.push({ key, nextSequentialIndex: 0 });
  }

  private _popScope() {
    if (this._currentScope.length <= 1) {
      throw new Error('Mismatched scope push/pop');
    }
    this._currentScope.pop();
  }
}

export declare namespace HandleContext {
  export import MouseButton = HandleMouseButton;

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface FrameStartOptions {
    // nothing for now.
  }
}

Object.defineProperties(HandleContext, {
  MouseButton: {
    value: HandleMouseButton,
    writable: true,
    enumerable: false,
    configurable: true,
  },
});

export type HandleKey = string & {
  readonly __handleKey: unique symbol;
};

export function HandleKey(): HandleKey {
  return '' as HandleKey;
}

interface Scope {
  key: string;
  nextSequentialIndex: number;
}
