import { CycloComponent } from './component.ts';

export enum PredefinedExecutionOrder {
  earlier = -100,

  physics = -50,

  normal = 0,

  notSoLate = 10,

  later = 50,

  rendering = 200,
}

export function setExecutionOrder(componentClass: new (...args: never[]) => CycloComponent, value: number): void {
  (componentClass as unknown as { _executionOrder: number })._executionOrder = value;
}

export function getExecutionOrder(componentClass: new (...args: never[]) => CycloComponent): number {
  return (componentClass as unknown as { _executionOrder: number })._executionOrder || PredefinedExecutionOrder.normal;
}
