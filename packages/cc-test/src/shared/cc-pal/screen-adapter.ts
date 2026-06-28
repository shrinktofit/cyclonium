export interface SafeAreaEdge {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type ConfigOrientation = 'auto' | 'landscape' | 'portrait';

export interface ScreenOptions {
  configOrientation: ConfigOrientation;
  exactFitScreen: boolean;
  isHeadlessMode: boolean;
}

export type ScreenEventType = 'window-resize' | 'orientation-change' | 'fullscreen-change';

export enum Orientation {
  PORTRAIT = 1,
  PORTRAIT_UPSIDE_DOWN = PORTRAIT << 1,
  LANDSCAPE_LEFT = PORTRAIT << 2,
  LANDSCAPE_RIGHT = PORTRAIT << 3,
  LANDSCAPE = LANDSCAPE_LEFT | LANDSCAPE_RIGHT,
  AUTO = PORTRAIT | LANDSCAPE,
}

export interface Size {
  width: number;
  height: number;
}

export interface ScreenAdapter {
  init(options: ScreenOptions, cbToRebuildFrameBuffer: () => void): void;

  isFrameRotated: boolean;

  get isProportionalToFrame(): boolean;

  set isProportionalToFrame(v: boolean);

  handleResizeEvent: boolean;

  get supportFullScreen(): boolean;

  get isFullScreen(): boolean;

  get devicePixelRatio(): number;

  get windowSize(): Size;

  set windowSize(size: Size);

  get resolution(): Size;

  get resolutionScale(): number;

  set resolutionScale(value: number);

  get orientation(): Orientation;

  set orientation(value: Orientation);

  get safeAreaEdge(): SafeAreaEdge;

  requestFullScreen(): Promise<void>;

  exitFullScreen(): Promise<void>;

  on(event: ScreenEventType, cb: (...args: unknown[]) => void, target?: unknown): void;

  once(event: ScreenEventType, cb: (...args: unknown[]) => void, target?: unknown): void;

  off(event: ScreenEventType, cb?: (...args: unknown[]) => void, target?: unknown): void;
}

export interface PalScreenAdapterModule {
  screenAdapter: ScreenAdapter;
}
