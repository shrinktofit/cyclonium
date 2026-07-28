import {
  HeaderStylePlatformAdapter,
  type HeaderStyleMinigameApi,
} from '../minigame-shared/index.js';

export type WechatMinigameApi = Pick<
  WechatMinigame.Wx,
  'createImage'
  | 'downloadFile'
  | 'getFileSystemManager'
  | 'loadFont'
  | 'request'
>;

export class WechatPlatformAdapter extends HeaderStylePlatformAdapter {
  constructor(api: WechatMinigameApi) {
    super('wechat', createWechatFacade(api), '其他');
  }
}

function createWechatFacade(
  api: WechatMinigameApi,
): HeaderStyleMinigameApi {
  return {
    request: (options) => api.request<ArrayBuffer>({
      url: options.url,
      method: options.method,
      dataType: '其他',
      responseType: options.responseType,
      success: (result) => {
        if (!(result.data instanceof ArrayBuffer)) {
          options.fail({
            errMsg: 'WeChat request did not return an ArrayBuffer.',
          });
          return;
        }
        options.success({
          data: result.data,
          header: normalizeWechatHeaders(result.header),
          statusCode: result.statusCode,
        });
      },
      fail: (failure) => {
        options.fail({
          errMsg: failure.errMsg,
        });
      },
    }),
    downloadFile: (options) => {
      const task = api.downloadFile({
        url: options.url,
        success: (result) => {
          options.success({
            statusCode: result.statusCode,
            tempFilePath: result.tempFilePath,
            filePath: result.filePath,
          });
        },
        fail: (failure) => {
          options.fail({
            errMsg: failure.errMsg,
          });
        },
      });
      return {
        abort: () => {
          task.abort();
        },
        onHeadersReceived: (listener) => {
          task.onHeadersReceived((result) => {
            listener({
              header: normalizeWechatHeaders(result.header),
            });
          });
        },
      };
    },
    getFileSystemManager: () => {
      const fileSystem = api.getFileSystemManager();
      return {
        readFile: (options) => {
          fileSystem.readFile({
            filePath: options.filePath,
            success: (result) => {
              if (!(result.data instanceof ArrayBuffer)) {
                options.fail({
                  errMsg: 'WeChat readFile did not return an ArrayBuffer.',
                });
                return;
              }
              options.success({
                data: result.data,
              });
            },
            fail: (failure) => {
              options.fail({
                errMsg: failure.errMsg,
              });
            },
          });
        },
        unlink: (options) => {
          fileSystem.unlink({
            filePath: options.filePath,
            success: () => {
              options.success();
            },
            fail: (failure) => {
              options.fail({
                errMsg: failure.errMsg,
              });
            },
          });
        },
      };
    },
    createImage: () => api.createImage(),
    loadFont: (path) => api.loadFont(path),
  };
}

function normalizeWechatHeaders(
  headers: WechatMinigame.IAnyObject,
): Readonly<Record<string, string | number>> {
  const normalized: Record<string, string | number> = {};
  for (const key of Object.keys(headers)) {
    const value = Reflect.get(headers, key) as unknown;
    if (typeof value === 'string' || typeof value === 'number') {
      normalized[key] = value;
    }
  }
  return normalized;
}
