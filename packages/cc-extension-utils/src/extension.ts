import { objectAssignDeep, type RecursivePartial } from './utils/object-assign-deep.js';

export interface ExtensionContributions {
  'asset-db'?: {
    'script'?: string;

    'asset-handler'?: {
      handler: string;
      name: string;
      extnames: string[];
    }[];

    'mount'?: {
      path: string;
      readonly?: boolean;
    };

    'global-hook'?: ('beforePreStart' | 'afterPreStart')[];
  };

  'builder'?: string;

  'footer'?: {
    right?: string;
  };

  'inspector'?: {
    section?: {
      asset?: Record<string, string>;
      node?: Record<string, string>;
    };
  };

  'menu'?: {
    path?: string;
    label?: string;
    message?: string;
    group?: string;
    order?: number;
  }[];

  'messages'?: Record<string, {
    methods: string[];
  }>;

  'scene'?: {
    script: string;
  };

  'server'?: string;
}

export { type RecursivePartial };

export function mergeContributions(a: ExtensionContributions, b: RecursivePartial<ExtensionContributions>) {
  objectAssignDeep(a, b);
}
