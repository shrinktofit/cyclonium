export function applyLegacyDecorators<T extends object>(targetClass: new (...args: never[]) => T, options: {
  classDecorators?: ClassDecorator[];
  propertyDecorators?: Partial<Record<Extract<keyof T, string>, PropertyDecorator[]>>;
}) {
  const { classDecorators, propertyDecorators } = options;
  if (propertyDecorators) {
    (Object.entries(propertyDecorators) as [Extract<keyof T, string>, PropertyDecorator[]][]).forEach(([propertyName, decorators]) => {
      decorators.forEach((decorator) => decorator(targetClass.prototype, propertyName));
    });
  }
  if (classDecorators) {
    classDecorators.forEach((decorator) => decorator(targetClass));
  }
}
