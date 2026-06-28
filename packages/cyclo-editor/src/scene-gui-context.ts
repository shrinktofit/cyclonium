import { Handles, type HandleContext } from '@cyclonium/handles';

export class SceneGuiContext {
  constructor(...args: ConstructorParameters<typeof Handles>) {
    this._handles = new Handles(...args);
  }

  get handles() {
    return this._handles;
  }

  destroy_internal() {
    this._handles.destroy_internal();
  }

  startFrame_internal(opts: HandleContext.FrameStartOptions) {
    this._handles.startFrame_internal(opts);
  }

  endFrame_internal() {
    this._handles.endFrame_internal();
  }

  private _handles: Handles;
}
