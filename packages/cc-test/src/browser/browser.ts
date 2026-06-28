export async function evaluateScript(url: string, type?: string) {
  const scriptElement = document.createElement('script');
  const promise = new Promise<void>((resolve, reject) => {
    if (type === 'systemjs-importmap') {
      resolve();
    }
    scriptElement.onload = () => {
      resolve();
    };
    scriptElement.onerror = (err) => {
      reject(new Error(`Failed to evaluate ${url}`, { cause: err }));
    };
  });
  if (type) {
    scriptElement.type = type;
  }
  scriptElement.src = url;
  document.body.append(scriptElement);
  await promise;
}

export async function polyfill() {
  // ...
}
