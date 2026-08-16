import { _decorator } from 'cc';

export function createDecoratorForSetEditableMetadata(opts: Parameters<typeof _decorator.property>[0]): PropertyDecorator {
  return (target: object, propertyKey: string | symbol, descriptor?: PropertyDescriptor) => {
    const normalizedOptions: Parameters<typeof _decorator.property>[0] = {
      ...opts,
      serializable: false,
    };
    if (normalizedOptions.visible === undefined) {
      if (typeof propertyKey === 'string' && propertyKey.startsWith('_')) {
        normalizedOptions.visible = true;
        normalizedOptions.displayName = propertyKey.slice(1);
      }
    }
    _decorator.property(normalizedOptions)(target, propertyKey, descriptor);
    _decorator.editable(target, propertyKey, descriptor);
  };
}
