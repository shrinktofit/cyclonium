import './preflight.js';
import { applyGameCanvasStyle, applyGameContainerStyle, applyGameDivStyle, type ResolvedCanvasOptions } from './internal-canvas-layout.js';
import { Downloader, type DownloadOptions } from '../runtime/downloader.js';
import { internalInjections } from 'virtual:cyclo-cc-test/internal-injections';
import { internalShared, type CanvasOptions } from '../runtime/internal-shared.js';
import { evaluateScript } from '../util.js';
import { loadSystemJSImportMap, resolveBuiltinPipelineURL } from './import-map.js';

declare global {
  let System: {
    resolve(id: string, parentUrl?: string): string;
    instantiate(id: string, parentUrl?: string): Promise<unknown>;
    setResolutionDetailMapCallback: (callback: () => Promise<unknown>) => void;
    import(id: string, parentUrl?: string): Promise<Record<string, unknown>>;
  };
}

export interface InitOptionsEditorPreviewBased {
  baseURL: string;
  canvas?: CanvasOptions;
}

export async function init(opts: InitOptionsEditorPreviewBased) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  polyfill(opts);

  const gameDiv = document.createElement('div');
  gameDiv.id = 'GameDiv';
  document.body.appendChild(gameDiv);

  const gameContainer = document.createElement('div');
  gameContainer.id = 'Cocos3dGameContainer';
  gameDiv.appendChild(gameContainer);

  const gameCanvas = document.createElement('canvas');
  let resolvedCanvasOptions: ResolvedCanvasOptions | undefined;
  internalShared.canvas = gameCanvas;
  internalShared.configureCanvas = createCanvasConfigurator(gameDiv, gameContainer, gameCanvas, opts.canvas, (options) => {
    resolvedCanvasOptions = options;
  });
  internalShared.configureCanvas();
  gameContainer.appendChild(gameCanvas);

  const baseURL = new URL(opts.baseURL);

  const evalCCScript = async (url: string, type?: string) => {
    return await evaluateScript(new URL(url, baseURL).href, type);
  };

  await evalCCScript('/scripting/engine/bin/.cache/dev/preview/import-map.json', 'systemjs-importmap');
  await evalCCScript('/scripting/x/import-map.json', 'systemjs-importmap');
  await evalCCScript('/scripting/import-map-global', 'systemjs-importmap');
  await evalCCScript('/scripting/systemjs/system.js');
  const systemJsPrototype = System.constructor.prototype;
  const virtualPalModules = new Set([
    'pal/env',
    'pal/screen-adapter',
  ]);
  const vendorResolve = systemJsPrototype.resolve ?? System.resolve;
  systemJsPrototype.resolve = function (id: string, parentUrl?: string) {
    if (virtualPalModules.has(id)) {
      return id;
    }
    return vendorResolve.call(this, id, parentUrl);
  };

  const vendorSystemInstantiate = systemJsPrototype.instantiate;
  systemJsPrototype.instantiate = async function (id: string, parentUrl?: string) {
    if (id === 'pal/env') {
      const { BrowserPalEnvController } = await import('./cc-pal/browser-env.js');
      const palEnvController = new BrowserPalEnvController(gameDiv, gameContainer, gameCanvas);
      return createSystemJsModule(palEnvController.pal);
    }

    if (id === 'pal/screen-adapter') {
      const { BrowserPalScreenAdapterController } = await import('./cc-pal/browser-screen-adapter.js');
      const palScreenAdapterController = new BrowserPalScreenAdapterController({
        frame: gameDiv,
        canvas: gameCanvas,
        configureCanvas: internalShared.configureCanvas,
        getDevicePixelRatio: () => {
          return resolvedCanvasOptions?.devicePixelRatio ?? window.devicePixelRatio;
        },
      });
      return createSystemJsModule(palScreenAdapterController.pal);
    }

    if (id.startsWith('virtual:///prerequisite-imports/')) {
      return [
        [],
        () => {
          return {
            execute: () => {},
          };
        },
      ];
    }
    if (!id.startsWith(baseURL.href)) {
      return vendorSystemInstantiate.call(this, id, parentUrl);
    }
    await evalCCScript(id);
    return this.getRegister();
  };
  System.setResolutionDetailMapCallback(() => {
    const url = new URL('/scripting/x/resolution-detail-map.json', baseURL);
    return fetch(url).then(async (response) => {
      return JSON.parse(await response.text());
    }).then(function (json) {
      return { json, url: url.href };
    }).catch((err) => {
      console.error(err);
      return { json: {}, url: url.href };
    });
  });
  await evalCCScript('/scripting/engine/bin/.cache/dev/preview/bundled/index.js');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cc = await System.import('cc') as Record<string, any>;
  const builtinPipelineURL = internalInjections.headless
    ? ''
    : await resolveEditorPreviewBuiltinPipelineURL(baseURL);

  cc.game.constructor.prototype._loadCCEScripts = async function () {
    if (!internalInjections.headless) {
      return await System.import(builtinPipelineURL);
    }
    return Promise.resolve();
  };

  const internalDownloader = new Downloader({
    baseURL: baseURL.href,
  });

  await System.import('q-bundled:///fs/exports/gfx-webgl2.js');
  await System.import('q-bundled:///fs/exports/custom-pipeline.js');
  const { effectSettings } = (await System.import('q-bundled:///fs/cocos/core/effect-settings.js')) as {
    effectSettings: {
      _data: ArrayBuffer;
      init: (path: string) => Promise<void>;
    };
  };
  effectSettings.init = async function (path: string | null | undefined) {
    if (!path) {
      return;
    }
    const arrayBuffer = await internalDownloader.downloadArrayBuffer(path);
    this._data = arrayBuffer;
  };

  for (const [ext, downloadHandler] of Object.entries(createDownloadHandlers(internalDownloader))) {
    cc.assetManager.downloader.register(ext, callbackfy(downloadHandler));
  }
  cc.assetManager.downloader.register('bundle', callbackfy(async (nameOrUrl: string, opts?: DownloadOptions & {
    version?: string;
  }) => {
    const downloader = cc.assetManager.downloader;
    const bundleName = cc.path.basename(nameOrUrl);
    let url = nameOrUrl;
    const REGEX = /^(?:\w+:\/\/|\.+\/).+/;
    if (!REGEX.test(url)) {
      if (downloader.remoteBundles.indexOf(bundleName) !== -1) {
        url = `${downloader.remoteServerAddress}remote/${bundleName}`;
      } else {
        url = `assets/${bundleName}`;
      }
    }
    const version = opts?.version || downloader.bundleVers[bundleName];
    const config = `${url}/config.${version ? `${version}.` : ''}json`;
    const configJson = await internalDownloader.downloadJson(config, opts) as BundleConfigOptions;
    const configJsonModified: BundleConfigOptions = {
      ...configJson,
      base: `${url}/`,
    };
    return configJsonModified;
  }));

  return {
    'import'(id: string) {
      return System.import(id).catch((err) => {
        console.error('Failed to import ' + id + ', %o', err);
        throw err;
      });
    },
  };
}

type CompletionCallback<T> = (err: unknown, res: T | null) => void;

function createSystemJsModule(exports: object): [[], (exportFn: (key: string, value: unknown) => void) => {
  execute(): void;
}] {
  return [
    [],
    (exportFn: (key: string, value: unknown) => void) => {
      return {
        execute: () => {
          for (const [key, value] of Object.entries(exports)) {
            exportFn(key, value);
          }
        },
      };
    },
  ];
}

function callbackfy<T, TArgs extends unknown[]>(promise: (...args: TArgs) => Promise<T>) {
  return (...argsAndCallback: [...TArgs, CompletionCallback<T>]) => {
    const args = argsAndCallback.slice(0, argsAndCallback.length - 1) as TArgs;
    const callback = argsAndCallback[argsAndCallback.length - 1] as CompletionCallback<T>;
    const p = promise(...args);
    p.then(
      (res) => {
        callback(null, res);
      }, (err) => {
        callback(err, null);
      },
    );
    return p;
  };
}

type BundleConfigOptions = Record<string, unknown>;
async function resolveEditorPreviewBuiltinPipelineURL(baseURL: URL): Promise<string> {
  const xImportMapURL = new URL('/scripting/x/import-map.json', baseURL);
  const xImportMap = await loadSystemJSImportMap(xImportMapURL);
  return resolveBuiltinPipelineURL(xImportMap, xImportMapURL);
}

function createDownloadHandlers(internalDownloader: Downloader) {
  const downloadJson = internalDownloader.downloadJson.bind(internalDownloader);
  const downloadImage = internalDownloader.downloadImage.bind(internalDownloader);
  const downloadArrayBuffer = internalDownloader.downloadArrayBuffer.bind(internalDownloader);
  const downloadText = internalDownloader.downloadText.bind(internalDownloader);
  const downloadScript = internalDownloader.downloadScript.bind(internalDownloader);
  return {
    '.png': downloadImage,
    '.jpg': downloadImage,
    '.jpeg': downloadImage,
    '.bmp': downloadImage,
    '.gif': downloadImage,
    '.ico': downloadImage,
    '.webp': downloadImage,
    '.tiff': downloadImage,
    '.image': downloadImage,

    '.pvr': downloadArrayBuffer,
    '.pkm': downloadArrayBuffer,
    '.astc': downloadArrayBuffer,

    '.txt': downloadText,
    '.xml': downloadText,
    '.vsh': downloadText,
    '.fsh': downloadText,
    '.atlas': downloadText,
    '.tmx': downloadText,
    '.tsx': downloadText,

    '.json': downloadJson,
    '.ExportJson': downloadJson,
    '.plist': downloadText,

    '.fnt': downloadText,
    '.binary': downloadArrayBuffer,
    '.bin': downloadArrayBuffer,
    '.dbbin': downloadArrayBuffer,
    '.skel': downloadArrayBuffer,
    '.js': downloadScript,

    'default': downloadText,
  };
}

function polyfill(opts: InitOptionsEditorPreviewBased) {
  polyfillCanvasSelectors();

  const vendorFetch = globalThis.fetch;
  const ENGINE_EXTERNAL_URL_PREFIX = '/engine_external/?url=';
  globalThis.fetch = async (url, ...remainArgs) => {
    if (typeof url === 'string' && url.startsWith(ENGINE_EXTERNAL_URL_PREFIX)) {
      const encoded = `${ENGINE_EXTERNAL_URL_PREFIX}${encodeURIComponent(url.slice(ENGINE_EXTERNAL_URL_PREFIX.length))}`;
      return vendorFetch(new URL(encoded, opts.baseURL), ...remainArgs);
    }
    return vendorFetch(url, ...remainArgs);
  };
}

function polyfillCanvasSelectors() {
  const vendorGetElementById = document.getElementById.bind(document);
  document.getElementById = ((elementId: string) => {
    if (elementId === 'GameCanvas') {
      return getCurrentGameCanvas() ?? vendorGetElementById(elementId);
    }
    return vendorGetElementById(elementId);
  }) as typeof document.getElementById;

  const vendorQuerySelector = document.querySelector.bind(document);
  document.querySelector = ((selectors: string) => {
    if (selectors === '#GameCanvas') {
      return getCurrentGameCanvas() ?? vendorQuerySelector(selectors);
    }
    return vendorQuerySelector(selectors);
  }) as typeof document.querySelector;
}

function getCurrentGameCanvas(): HTMLCanvasElement | undefined {
  const canvas = internalShared.canvas;
  if (canvas && canvas.id !== 'GameCanvas') {
    return canvas;
  }
}

function createCanvasConfigurator(
  gameDiv: HTMLElement,
  gameContainer: HTMLElement,
  gameCanvas: HTMLCanvasElement,
  defaultOptions?: CanvasOptions,
  onConfigured?: (options: ResolvedCanvasOptions) => void,
): (opts?: CanvasOptions) => void {
  const resolvedDefaultOptions = resolveCanvasOptions(gameCanvas, defaultOptions);
  return (opts?: CanvasOptions) => {
    const resolvedOptions = mergeCanvasOptions(resolvedDefaultOptions, opts);
    applyCanvasOptions(gameDiv, gameContainer, gameCanvas, resolvedOptions);
    onConfigured?.(resolvedOptions);
  };
}

function resolveCanvasOptions(canvas: HTMLCanvasElement, opts?: CanvasOptions): ResolvedCanvasOptions {
  return {
    id: opts?.id ?? 'GameCanvas',
    devicePixelRatio: opts?.devicePixelRatio ?? window.devicePixelRatio,
    size: {
      width: opts?.size?.width ?? canvas.width,
      height: opts?.size?.height ?? canvas.height,
    },
  };
}

function mergeCanvasOptions(defaultOptions: ResolvedCanvasOptions, opts?: CanvasOptions): ResolvedCanvasOptions {
  return {
    id: opts?.id ?? defaultOptions.id,
    devicePixelRatio: opts?.devicePixelRatio ?? defaultOptions.devicePixelRatio,
    size: {
      width: opts?.size?.width ?? defaultOptions.size.width,
      height: opts?.size?.height ?? defaultOptions.size.height,
    },
  };
}

function applyCanvasOptions(
  gameDiv: HTMLElement,
  gameContainer: HTMLElement,
  gameCanvas: HTMLCanvasElement,
  opts: ResolvedCanvasOptions,
): void {
  gameCanvas.id = opts.id;
  gameCanvas.width = Math.round(opts.size.width * opts.devicePixelRatio);
  gameCanvas.height = Math.round(opts.size.height * opts.devicePixelRatio);
  applyGameDivStyle(gameDiv, opts.size);
  applyGameContainerStyle(gameContainer);
  applyGameCanvasStyle(gameCanvas);
}
