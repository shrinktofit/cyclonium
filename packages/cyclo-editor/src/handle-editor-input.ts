import { Vec2 } from '@cyclonium/core/math/vec2';
import { HandleContext, type HandleHostInput, type HandleHostMouseInput } from '@cyclonium/handles';
import { ccEditorExtension } from './cce.js';
import { geometry, screen } from 'cc';

export class HandleEditorInput implements HandleHostInput {
  get mouse(): HandleHostMouseInput {
    return this._mouse;
  }

  destroy() {
    this._mouse.destroy();
  }

  private _mouse = new HandleEditorMouseInput();
}

class HandleEditorMouseInput implements HandleHostMouseInput {
  constructor() {
    const signal = this._controllerOnAbort.signal;
    const intervalId = setInterval(() => {
      if (signal.aborted) {
        clearInterval(intervalId);
        return;
      }
      if (typeof ccEditorExtension.Operation !== 'object' || !ccEditorExtension.Operation) {
        return;
      }
      clearInterval(intervalId);
      for (const mouseEventType of ['mousedown', 'mousemove', 'mouseup', 'mousewheel'] as const) {
        HandleEditorMouseInput._addInputEventListener(
          mouseEventType,
          this._onMouseEvent.bind(this, mouseEventType),
          { signal: signal },
        );
      }
    });
  }

  get wantCapture() {
    return this._wantCapture;
  }

  set wantCapture(value: boolean) {
    this._wantCapture = value;
  }

  get position() {
    return this._position;
  }

  get buttons() {
    return this._buttons;
  }

  get altKey() {
    return this._altKey;
  }

  get ctrlKey() {
    return this._ctrlKey;
  }

  get shiftKey() {
    return this._shiftKey;
  }

  mouseRay() {
    const camera = ccEditorExtension.Camera.camera;
    camera.screenPointToRay(this._position.x, this._position.y, this._mouseRay);
    return this._mouseRay;
  }

  destroy() {
    this._controllerOnAbort.abort();
  }

  private static _addInputEventListener<TEventName extends keyof ccEditorExtension.Operation.EventMap>(
    type: TEventName,
    callback: (...args: ccEditorExtension.Operation.EventMap[TEventName]) => boolean,
    opts?: {
      signal?: AbortSignal;
    },
  ) {
    ccEditorExtension.Operation.on(type, callback, 999);
    opts?.signal?.addEventListener('abort', () => {
      ccEditorExtension.Operation.removeListener(type, callback);
    });
  }

  private _controllerOnAbort = new AbortController();
  private _wantCapture = false;
  private readonly _position = new Vec2();
  private _buttons = 0;
  private _altKey = false;
  private _ctrlKey = false;
  private _shiftKey = false;

  private _mouseRay = new geometry.Ray();

  private _onMouseEvent(eventType: keyof ccEditorExtension.Operation.EventMap, event: ccEditorExtension.Operation.OperationMouseEvent): boolean {
    let buttons = 0;
    if (event.buttons & (1 << 0)) {
      buttons |= (1 << HandleContext.MouseButton.left);
    }
    if (event.buttons & (1 << 1)) {
      buttons |= (1 << HandleContext.MouseButton.right);
    }
    if (event.buttons & (1 << 2)) {
      buttons |= (1 << HandleContext.MouseButton.middle);
    }
    this._buttons = buttons;
    // Web use top 0, cocos use bottom 0
    this._position.set(event.x, screen.windowSize.height - event.y);
    this._altKey = event.altKey;
    this._ctrlKey = event.ctrlKey;
    this._shiftKey = event.shiftKey;

    if (eventType === 'mousewheel') {
      return true;
    }
    ccEditorExtension.Engine.repaintInEditMode();

    if (!this._wantCapture) {
      return true;
    }
    return false;
  }
}
