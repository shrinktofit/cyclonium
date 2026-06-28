declare global {
  namespace Editor {
    namespace Clipboard {
      export function write(type: string, text: string): void;
    }

    namespace Project {
      export const path: string;
    }

    namespace Selection {
      export function getSelected(type: string): string[];
    }
  }
}

export import globalEditor = globalThis.Editor;
