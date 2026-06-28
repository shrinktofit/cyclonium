declare global {
  namespace globalThis {
    export namespace TTWebAssembly {
      export function compile(path: string): Promise<WebAssembly.Module>;
      export function instantiate(path: string, imports?: WebAssembly.Imports): Promise<WebAssembly.Instance>;
      export import CompileError = WebAssembly.CompileError;
      export import Exports = WebAssembly.Exports;
      export import ImportObject = WebAssembly.Imports;
      export import Instance = WebAssembly.Instance;
      export import Memory = WebAssembly.Memory;
      export import Module = WebAssembly.Module;
      export import Table = WebAssembly.Table;
    }
  }
}

export import MinigameWebAssembly = globalThis.TTWebAssembly;
