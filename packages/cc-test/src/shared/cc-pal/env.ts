export interface FindCanvasResult {
  frame: HTMLDivElement;
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
}

export interface PalEnvModule {
  findCanvas(): FindCanvasResult;
  loadJsFile(path: string): Promise<void>;
}
