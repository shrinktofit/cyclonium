import type { Component, Camera } from 'cc';
import type EventEmitter from 'node:events';

declare global {
  namespace EditorExtends {
    class ComponentManager extends EventEmitter<{
      add: [componentId: string, component: Component];
      remove: [componentId: string, component: Component];
    }> {
    }

    export const Component: InstanceType<typeof ComponentManager>;
  }

  namespace cce {
    class NodeManager {
      query(uuid: string): import('cc').Node | undefined;
    }

    export const Node: InstanceType<typeof NodeManager>;

    export class OperationManager {
      on<TEventName extends keyof Operation.EventMap>(
        type: TEventName, callback: ((...args: Operation.EventMap[TEventName]) => boolean | void | undefined),
        priority?: number,
      ): void;

      removeListener<TEventName extends keyof Operation.EventMap>(
        type: TEventName, callback: ((...args: Operation.EventMap[TEventName]) => boolean | void | undefined),
      ): void;
    }

    export const Operation: InstanceType<typeof OperationManager>;

    export namespace Operation {
      export type EventMap = {
        [x in 'mousedown' | 'mousemove' | 'mouseup' | 'mousewheel']: [OperationMouseEvent];
      } & {
        [x in 'keydown' | 'keyup']: [KeyboardEvent];
      } & {
        [x in 'onDragOver' | 'onDrop']: [DragEvent];
      };

      export type OperationMouseEvent = Omit<MouseEvent, 'type'>;
    }

    export class EngineManager {
      repaintInEditMode(): boolean;
    }

    export const Engine: InstanceType<typeof EngineManager>;

    class CameraManager {
      camera: Camera;
    }

    export const Camera: InstanceType<typeof CameraManager>;
  }
}

export import ccEditorExtension = globalThis.cce;

export function isSceneEditorEnv() {
  return typeof globalThis.cce === 'object' && globalThis.cce;
}
