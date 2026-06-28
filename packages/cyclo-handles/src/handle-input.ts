import { Vec2 } from '@cyclonium/core/math/vec2';
import type { HandleContext } from './handle-context.js';
import type { geometry } from 'cc';

export enum HandleMouseButton {
  left = 0,
  right = 1,
  middle = 2,
}

export class HandleInputContext {
  constructor(private _hostInput: HandleHostInput) {

  }

  get mousePosition() {
    return this._hostInput.mouse.position;
  }

  mouseButtonDown(button: HandleMouseButton) {
    return (this._hostInput.mouse.buttons & (1 << button)) !== 0;
  }

  mouseRay() {
    return this._hostInput.mouse.mouseRay();
  }

  get mouseAltKey() {
    return this._hostInput.mouse.altKey;
  }

  get mouseCtrlKey() {
    return this._hostInput.mouse.ctrlKey;
  }

  get mouseShiftKey() {
    return this._hostInput.mouse.shiftKey;
  }

  startFrame_internal(_opts: HandleContext.FrameStartOptions) {
    this._hostInput.mouse.wantCapture = false;
  }

  endFrame_internal() {
    // ...
  }

  captureMouse() {
    this._hostInput.mouse.wantCapture = true;
  }
}

export interface HandleHostInput {
  readonly mouse: HandleHostMouseInput;
}

export interface HandleHostMouseInput {
  wantCapture: boolean;
  readonly position: Vec2;
  readonly buttons: number;
  mouseRay(): geometry.Ray;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
}
