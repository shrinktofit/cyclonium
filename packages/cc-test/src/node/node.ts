import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';

export async function evaluateScript(url: string, type?: string) {
  const forceReload = !isEngineScriptUrl(url);
  const cacheKey = crypto.createHash('md5').update(url).digest('hex');
  const cachePath = resolve('temp', 'test-caches', `${cacheKey}.js`);
  let cacheContent = '';
  let isCacheInvalid = false;
  if (forceReload) {
    isCacheInvalid = true;
  } else {
    try {
      cacheContent = await fs.readFile(cachePath, 'utf-8');
    } catch {
      isCacheInvalid = true;
    }
  }
  if (isCacheInvalid) {
    const code = await fetch(url).then((res) => res.text());
    cacheContent = code;
    await fs.mkdir(dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, cacheContent);
  }
  if (type === 'systemjs-importmap') {
    const script = document.createElement('script');
    script.src = url;
    script.type = type;
    script.append(cacheContent);
    document.body.append(script);
  } else {
    try {
      createRequire(import.meta.url)(cachePath);
    } catch (error) {
      throw new Error(`Failed to evaluate ${url}(cached at: ${cachePath})`, { cause: error });
    }
  }
}

function isEngineScriptUrl(url: string) {
  return new URL(url).pathname.startsWith('/scripting/engine/');
}

export async function polyfill() {
  const vendorFetch = globalThis.fetch;
  const ENGINE_EXTERNAL_URL_PREFIX = '/engine_external/?url=';
  globalThis.fetch = async (url, ...remainArgs) => {
    if (typeof url === 'string' && url.startsWith(ENGINE_EXTERNAL_URL_PREFIX)) {
      const encoded = `${ENGINE_EXTERNAL_URL_PREFIX}${encodeURIComponent(url.slice(ENGINE_EXTERNAL_URL_PREFIX.length))}`;
      return vendorFetch(new URL(url, window.location.href), ...remainArgs);
    }
    if (typeof url === 'string' && url.endsWith('.wasm')) {
      const wasmBinary = await fs.readFile(fileURLToPath(url));
      const body = new ArrayBuffer(wasmBinary.byteLength);
      new Uint8Array(body).set(wasmBinary);
      return new Response(body, {
        headers: {
          'Content-Type': 'application/wasm',
        },
      });
    }
    return vendorFetch(url, ...remainArgs);
  };
}
