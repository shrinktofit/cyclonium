declare module '@editor/asset-db' {
  export class VirtualAsset {
  }

  export class Asset extends VirtualAsset {
    source: string;
    saveToLibrary(extension: string, data: unknown): Promise<void>;
  }
}
