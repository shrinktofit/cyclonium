declare module 'cc' {
  interface CCObject {
    objectFlags: number;
  }
}

interface ImportMeta {
  readonly hot?: {
    readonly signalOnDispose: AbortSignal;
  };
}
