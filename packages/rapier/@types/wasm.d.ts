declare module "*?wasm-binary" {
  const binary: ArrayBuffer;
  export default binary;
}

declare module "cc/env" {
  export const HTML5: boolean;
}