import type * as ccPalEnv from '../../shared/cc-pal/env.js';

export class BrowserPalEnvController {
  constructor(
    private _frameElement: HTMLDivElement,
    private _containerElement: HTMLDivElement,
    private _canvasElement: HTMLCanvasElement,
  ) {
  }

  findCanvas(): ccPalEnv.FindCanvasResult {
    return {
      frame: this._frameElement,
      container: this._containerElement,
      canvas: this._canvasElement,
    };
  }

  async loadJsFile(path: string): Promise<void> {
    throw new Error(`Forbidden to load ${path}.`);
  }

  get pal(): ccPalEnv.PalEnvModule {
    return {
      findCanvas: this.findCanvas.bind(this),
      loadJsFile: this.loadJsFile.bind(this),
    };
  }
}
