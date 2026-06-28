import * as ccPalScreenAdapter from '../../shared/cc-pal/screen-adapter.js';
import type { CanvasOptions } from '../../runtime/internal-shared.js';

const orientationMap: Record<ccPalScreenAdapter.ConfigOrientation, ccPalScreenAdapter.Orientation> = {
  auto: ccPalScreenAdapter.Orientation.AUTO,
  landscape: ccPalScreenAdapter.Orientation.LANDSCAPE,
  portrait: ccPalScreenAdapter.Orientation.PORTRAIT,
};

class Size implements ccPalScreenAdapter.Size {
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  width: number;
  height: number;

  get x(): number {
    return this.width;
  }

  set x(value: number) {
    this.width = value;
  }

  get y(): number {
    return this.height;
  }

  set y(value: number) {
    this.height = value;
  }

  set(size: ccPalScreenAdapter.Size): void {
    this.width = size.width;
    this.height = size.height;
  }
}

interface BrowserScreenAdapterOptions {
  frame: HTMLElement;
  canvas: HTMLCanvasElement;
  configureCanvas?: (opts?: CanvasOptions) => void;
  getDevicePixelRatio: () => number;
}

class BrowserScreenAdapter implements ccPalScreenAdapter.ScreenAdapter {
  constructor(private _options: BrowserScreenAdapterOptions) {
  }

  init(options: ccPalScreenAdapter.ScreenOptions, cbToRebuildFrameBuffer: () => void): void {
    this._cbToUpdateFrameBuffer = cbToRebuildFrameBuffer;
    this._orientation = orientationMap[options.configOrientation];
    this._syncFromCanvas();
    this._eventEmitter.emit('window-resize', this._windowSize.width, this._windowSize.height);
  }

  get isFrameRotated(): boolean {
    return this._isFrameRotated;
  }

  set isFrameRotated(v: boolean) {
    this._isFrameRotated = v;
  }

  get isProportionalToFrame(): boolean {
    return this._isProportionalToFrame;
  }

  set isProportionalToFrame(v: boolean) {
    this._isProportionalToFrame = v;
  }

  get handleResizeEvent(): boolean {
    return this._shouldHandleResizeEvents;
  }

  set handleResizeEvent(v: boolean) {
    this._shouldHandleResizeEvents = v;
  }

  get supportFullScreen(): boolean {
    return this._supportsFullScreen;
  }

  get isFullScreen(): boolean {
    return this._isFullScreen;
  }

  get devicePixelRatio(): number {
    return this._options.getDevicePixelRatio();
  }

  get windowSize(): ccPalScreenAdapter.Size {
    this._syncFromCanvas();
    return new Size(this._windowSize.width, this._windowSize.height);
  }

  set windowSize(size: ccPalScreenAdapter.Size) {
    this._windowSize.set(size);
    const dpr = this.devicePixelRatio;
    this._options.configureCanvas?.({
      id: this._options.canvas.id,
      devicePixelRatio: dpr,
      size: {
        width: size.width / dpr,
        height: size.height / dpr,
      },
    });
    this._syncFromCanvas();
    this._cbToUpdateFrameBuffer?.();
    this._eventEmitter.emit('window-resize', this._windowSize.width, this._windowSize.height);
  }

  get resolution(): ccPalScreenAdapter.Size {
    const windowSize = this.windowSize;
    this._resolution.x = windowSize.width * this._resolutionScale;
    this._resolution.y = windowSize.height * this._resolutionScale;
    return this._resolution;
  }

  get resolutionScale(): number {
    return this._resolutionScale;
  }

  set resolutionScale(value: number) {
    if (this._resolutionScale === value) {
      return;
    }
    this._resolutionScale = value;
    this._cbToUpdateFrameBuffer?.();
  }

  get orientation(): ccPalScreenAdapter.Orientation {
    return this._orientation;
  }

  set orientation(value: ccPalScreenAdapter.Orientation) {
    if (this._orientation === value) {
      return;
    }
    this._orientation = value;
    this._eventEmitter.emit('orientation-change', value);
  }

  get safeAreaEdge(): ccPalScreenAdapter.SafeAreaEdge {
    return this._safeAreaEdge;
  }

  requestFullScreen(): Promise<void> {
    return Promise.resolve();
  }

  exitFullScreen(): Promise<void> {
    return Promise.resolve();
  }

  on(event: ccPalScreenAdapter.ScreenEventType, cb: (...args: unknown[]) => void, target?: unknown): void {
    this._eventEmitter.on(event, cb, target);
  }

  once(event: ccPalScreenAdapter.ScreenEventType, cb: (...args: unknown[]) => void, target?: unknown): void {
    this._eventEmitter.once(event, cb, target);
  }

  off(event: ccPalScreenAdapter.ScreenEventType, cb?: (...args: unknown[]) => void, target?: unknown): void {
    this._eventEmitter.off(event, cb, target);
  }

  private _isFrameRotated = false;
  private _isProportionalToFrame = false;
  private _shouldHandleResizeEvents = true;
  private _supportsFullScreen = false;
  private _isFullScreen = false;
  private _windowSize = new Size(1, 1);
  private _resolutionScale = 1;
  private _resolution = new Size(1, 1);
  private _orientation = ccPalScreenAdapter.Orientation.AUTO;
  private _cbToUpdateFrameBuffer: (() => void) | undefined;
  private _safeAreaEdge: ccPalScreenAdapter.SafeAreaEdge = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };

  private _eventEmitter = new EventEmitter<Record<ccPalScreenAdapter.ScreenEventType, (...args: unknown[]) => void>>();

  private _syncFromCanvas(): void {
    this._windowSize.set(new Size(this._options.canvas.width, this._options.canvas.height));
  }
}

class EventEmitter<TEventMap extends Record<string, (...args: unknown[]) => void>> {
  constructor() {
  }

  on(event: keyof TEventMap, cb: TEventMap[keyof TEventMap], target?: unknown): void {
    this._listeners[event] = this._listeners[event] || [];
    this._listeners[event].push({ callback: cb, target, once: false });
  }

  once(event: keyof TEventMap, cb: TEventMap[keyof TEventMap], target?: unknown): void {
    this._listeners[event] = this._listeners[event] || [];
    this._listeners[event].push({ callback: cb, target, once: true });
  }

  emit(event: keyof TEventMap, ...args: Parameters<TEventMap[keyof TEventMap]>): void {
    const listeners = [...(this._listeners[event] ?? [])];
    listeners.forEach(({ callback, target, once }) => {
      callback.call(target, ...args);
      if (once) {
        this.off(event, callback, target);
      }
    });
  }

  off(event: keyof TEventMap, cb?: TEventMap[keyof TEventMap], target?: unknown): void {
    this._listeners[event] = this._listeners[event]?.filter((listener) => {
      if (cb !== undefined && listener.callback !== cb) {
        return true;
      }
      if (target !== undefined && listener.target !== target) {
        return true;
      }
      return false;
    });
  }

  private _listeners: {
    [key in keyof TEventMap]?: Array<{
      callback: TEventMap[keyof TEventMap];
      target?: unknown;
      once?: boolean;
    }>;
  } = {};
}

export class BrowserPalScreenAdapterController {
  constructor(options: BrowserScreenAdapterOptions) {
    this._screenAdapter = new BrowserScreenAdapter(options);
  }

  private _screenAdapter: BrowserScreenAdapter;

  get pal(): ccPalScreenAdapter.PalScreenAdapterModule {
    return {
      screenAdapter: this._screenAdapter,
    };
  }
}
