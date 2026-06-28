import { TextEncoder, TextDecoder } from './index.js';
if (typeof globalThis.TextEncoder !== 'function') {
  const propertyDescriptor: PropertyDescriptor = {
    enumerable: false,
    configurable: true,
    writable: true,
  };
  Object.defineProperties(globalThis, {
    TextEncoder: { ...propertyDescriptor, value: TextEncoder },
    TextDecoder: { ...propertyDescriptor, value: TextDecoder },
  });
}
