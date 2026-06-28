export type DownloadOptions = Record<string, unknown>;

export class Downloader {
  constructor(opts: {
    baseURL: string;
  }) {
    this._baseURL = new URL(opts.baseURL);
  }

  async downloadArrayBuffer(url: string) {
    const response = await this._fetchWithCheckedResponse(url);
    return await response.arrayBuffer();
  }

  async downloadText(url: string) {
    const response = await this._fetchWithCheckedResponse(url);
    return await response.text();
  }

  async downloadImage(url: string) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      if (window.location.protocol !== 'file:') {
        img.crossOrigin = 'anonymous';
      }

      function onLoad() {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        resolve(img);
      }

      function onError(err: ErrorEvent) {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
        reject(err);
      }

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);
      img.src = new URL(url, this._baseURL).toString();
      return img;
    });
  }

  async downloadJson(url: string, opts?: DownloadOptions) {
    const response = await this._fetchWithCheckedResponse(url);
    return await response.json();
  }

  async downloadScript(url: string) {
    throw new Error('Script download is not supported.');
  }

  private _baseURL: URL;

  private async _fetchWithCheckedResponse(url: string) {
    const response = await fetch(new URL(url, this._baseURL));
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}. Http status: ${response.status}(${response.statusText}), Message: ${await response.text()}`);
    }
    return response;
  }
}
