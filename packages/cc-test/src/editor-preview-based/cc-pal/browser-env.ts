import type * as ccPalEnv from '../../shared/cc-pal/env.js';

export class BrowserPalEnvController {
  constructor(
    private _frameElement: HTMLDivElement,
    private _containerElement: HTMLDivElement,
    private _canvasElement: HTMLCanvasElement,
  ) {
    // The constructor parameter properties retain the browser elements.
  }

  get pal(): ccPalEnv.PalEnvModule {
    return {
      findCanvas: this.findCanvas.bind(this),
      loadJsFile: this.loadJsFile.bind(this),
    };
  }

  findCanvas(): ccPalEnv.FindCanvasResult {
    return {
      frame: this._frameElement,
      container: this._containerElement,
      canvas: this._canvasElement,
    };
  }

  loadJsFile(path: string): Promise<void> {
    return Promise.reject(new Error(`Forbidden to load ${path}.`));
  }
}
