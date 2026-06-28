import YAML from 'yaml';
import { prettifySerialized } from './prettify.js';

declare namespace EditorExtends {
  export interface IBuilderOptions {
    builder?: 'dynamic' | 'compiled';
    stringify?: boolean;
    minify?: boolean;
    noNativeDep?: boolean;
    forceInline?: boolean;
    useCCON?: boolean;
  }

  export interface IParserOptions {
    compressUuid?: boolean;
    discardInvalid?: boolean;
    dontStripDefault?: boolean;
    missingClassReporter?: any;
    missingObjectReporter?: any;
    reserveContentsForSyncablePrefab?: boolean;
    _exporting?: boolean;
    keepNodeUuid?: boolean;
    recordAssetDepends?: string[];
  }

  export interface ISerializeOptions extends IParserOptions, IBuilderOptions { }

  export function serialize(value: unknown, options?: ISerializeOptions): unknown;
}

export function serialize(value: unknown): Uint8Array | string {
  const serialized = EditorExtends.serialize(value, {
    stringify: false,
    dontStripDefault: false,
  });
  const prettified = prettifySerialized(serialized);
  const yamlSerialized = YAML.stringify(prettified);
  return yamlSerialized;
}
