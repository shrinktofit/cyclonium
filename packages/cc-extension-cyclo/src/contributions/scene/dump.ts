/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Asset, CCClass, Component, js } from 'cc';
import type { Dump } from '../../dump/dump.js';
import { logger } from '../../logger.js';
import './patch-dump-defines.js';

declare const cce: {
  Dump: {
    encode: {
      encodeObject: (obj: unknown, attrs: Record<string, unknown>, owner?: Record<PropertyKey, unknown>, key?: string) => Dump;
    };
    decode: {
      decodePatch: (path: string, patch: Dump, target: unknown) => void;
    };
  };
};

export function dumpEncode(value: unknown) {
  if (value instanceof Component) {
    return dumpEncodeComponent(value as unknown as Record<PropertyKey, unknown>);
  } else if (value instanceof Asset) {
    return encodeAsset(value as unknown as Record<PropertyKey, unknown>);
  }
  throw new Error(`Can not dump ${value}`);
}

export function applyDumpPatch(target: unknown, patch: Dump, path: string) {
  cce.Dump.decode.decodePatch(path, patch, target);
}

function dumpEncodeComponent(input: Record<PropertyKey, unknown>) {
  const constructor = input.constructor;
  if (typeof constructor !== 'function') {
    throw new Error(`Can not dump ${constructor} since it has no constructor.`);
  }
  const attrs = CCClass.Attr.getClassAttrs(constructor);
  return encodeObject(input, attrs);
}

function encodeAsset(input: Record<PropertyKey, unknown>) {
  const constructor = input.constructor;
  if (typeof constructor !== 'function') {
    throw new Error(`Can not dump ${constructor} since it has no constructor.`);
  }
  if (!('__props__' in constructor) || !Array.isArray(constructor.__props__)) {
    throw new Error(`Can not dump ${constructor} since it has no __props__`);
  }

  const data: Dump = {
    value: {
      uuid: encodeObject(input.uuid, { default: null, visible: false }, input),
      name: encodeObject(input.name, { default: null, visible: false }, input),
    },
    default: undefined,
    type: getTypeName(constructor),
    readonly: false,
    visible: true,
    extends: getTypeInheritanceChain(constructor),
  };

  constructor.__props__.forEach((key: string) => {
    if (!data.value) {
      return;
    }

    try {
      if (key in input) {
        const attrs = CCClass.attr(input, key);
        const dumpData = encodeObject(input[key], attrs, input, key);
        if (dumpData.type !== 'Unknown') {
          data.value[key] = dumpData;
        }
      }
    } catch (error) {
      logger.warn(error);
      delete data.value[key];
    }
  });

  return data;
}

function encodeObject(input: unknown, attrs: Record<string, unknown>, owner?: Record<PropertyKey, unknown>, key?: string) {
  return cce.Dump.encode.encodeObject(input, attrs, owner, key);
}

function getTypeName(constructor: Function) {
  return js.getClassName(constructor) || 'Unknown';
}

function getTypeInheritanceChain(constructor: Function) {
  return CCClass.getInheritanceChain(constructor)
    .map((chain: Function) => {
      return getTypeName(chain);
    })
    .filter(Boolean);
}
