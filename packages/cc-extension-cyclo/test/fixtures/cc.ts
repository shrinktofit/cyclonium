type Constructor = new () => object;

interface PropertyAttributes {
  serializable?: boolean;
  visible?: boolean | (() => boolean);
  readonly?: boolean;
  type?: unknown;
  legacyProperty?: boolean;
  standalone?: boolean;
  implicitSerializable?: boolean;
  implicitVisible?: boolean;
}

const classes = new Map<string, Constructor>();
const classNames = new WeakMap<Constructor, string>();
const propertyAttributes = new WeakMap<Constructor, Map<string, PropertyAttributes>>();

export class Asset {
  name = '';
}

export class Component {}

export const CCInteger = Number;
export const CCString = String;

function updatePropertyAttributes(
  target: object,
  propertyKey: string | symbol,
  update: (attributes: PropertyAttributes) => void,
): void {
  if (classNames.has(target.constructor as Constructor)) {
    throw new Error('property decorators must run before ccclass');
  }
  if (typeof propertyKey !== 'string') {
    return;
  }

  let classProperties = propertyAttributes.get(target.constructor as Constructor);
  if (!classProperties) {
    classProperties = new Map<string, PropertyAttributes>();
    propertyAttributes.set(target.constructor as Constructor, classProperties);
  }

  const attributes = classProperties.get(propertyKey) ?? {};
  update(attributes);
  classProperties.set(propertyKey, attributes);
}

function propertyDecorator(optionsOrType?: unknown): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    updatePropertyAttributes(target, propertyKey, (attributes) => {
      attributes.legacyProperty = true;
      if (Array.isArray(optionsOrType) || typeof optionsOrType === 'function') {
        attributes.type = optionsOrType;
      } else if (typeof optionsOrType === 'object' && optionsOrType) {
        Object.assign(attributes, optionsOrType);
      }
    });
  };
}

export const _decorator = {
  ccclass(name: string) {
    return (type: Constructor): void => {
      classes.set(name, type);
      classNames.set(type, name);
    };
  },

  property(targetOrType?: unknown, propertyKey?: string | symbol) {
    if (propertyKey !== undefined) {
      propertyDecorator()(targetOrType as object, propertyKey);
      return undefined;
    }
    return propertyDecorator(targetOrType);
  },

  serializable(target: object, propertyKey: string | symbol): void {
    updatePropertyAttributes(target, propertyKey, (attributes) => {
      attributes.standalone = true;
      attributes.implicitSerializable = true;
    });
  },

  editable(target: object, propertyKey: string | symbol): void {
    updatePropertyAttributes(target, propertyKey, (attributes) => {
      attributes.standalone = true;
      attributes.implicitVisible = true;
    });
  },

  type(type: unknown): PropertyDecorator {
    return (target: object, propertyKey: string | symbol): void => {
      updatePropertyAttributes(target, propertyKey, (attributes) => {
        attributes.type = type;
      });
    };
  },
};

export const CCClass = {
  attr(target: Constructor, propertyKey: string): PropertyAttributes {
    return normalizePropertyAttributes(propertyAttributes.get(target)?.get(propertyKey));
  },

  Attr: {
    DELIMETER: '$_$',
    getClassAttrs(target: Constructor): Record<string, unknown> {
      const result: Record<string, unknown> = {};
      for (const [propertyKey, attributes] of propertyAttributes.get(target) ?? []) {
        for (const [attributeName, value] of Object.entries(normalizePropertyAttributes(attributes))) {
          result[`${propertyKey}${this.DELIMETER}${attributeName}`] = value;
        }
      }
      return result;
    },
    setClassAttr(target: Constructor, propertyKey: string, attributeName: string, value: unknown): void {
      const prototype = target.prototype;
      updatePropertyAttributes(prototype, propertyKey, (attributes) => {
        Object.assign(attributes, { [attributeName]: value });
      });
    },
  },
};

function normalizePropertyAttributes(attributes?: PropertyAttributes): PropertyAttributes {
  if (!attributes) {
    return {};
  }
  const {
    legacyProperty,
    standalone,
    implicitSerializable,
    implicitVisible,
    ...publicAttributes
  } = attributes;
  return {
    ...publicAttributes,
    serializable: publicAttributes.serializable === true || implicitSerializable
      ? true
      : standalone
        ? false
        : legacyProperty
          ? true
          : publicAttributes.serializable,
    visible: publicAttributes.visible
      ?? (implicitVisible
        ? true
        : standalone
          ? false
          : legacyProperty
            ? true
            : undefined),
  };
}

export const js = {
  getClassByName(name: string): Constructor | undefined {
    return classes.get(name);
  },
};
