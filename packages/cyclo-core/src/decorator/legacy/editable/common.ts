import { _decorator } from 'cc';

export function createDecoratorForSetEditableMetadata(opts: Parameters<typeof _decorator.property>[0]): PropertyDecorator {
  return (target: object, propertyKey: string | symbol, descriptor?: TypedPropertyDescriptor<any>) => {
    const normalizedOptions: Parameters<typeof _decorator.property>[0] = {
      ...opts,
    };
    if (normalizedOptions.visible === undefined) {
      if (typeof propertyKey === 'string' && propertyKey.startsWith('_')) {
        normalizedOptions.visible = true;
        normalizedOptions.displayName = propertyKey.slice(1);
      }
    }
    return _decorator.property(normalizedOptions)(target, propertyKey, descriptor);
  };
}
