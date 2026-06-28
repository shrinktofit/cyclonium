import { CCObject, Component, director, Node, System } from 'cc';
import EventEmitter from 'node:events';
import { SceneGuiContext } from './scene-gui-context.js';
import { HandleEditorInput } from './handle-editor-input.js';
import { isSceneEditorEnv } from './cce.js';
import { globalEditor } from './editor-global.js';

export class ComponentEditor<TTarget extends Component = Component> {
  constructor(target: TTarget) {
    this._target = target;
  }

  get target() {
    if (!this._target) {
      throw new Error(`Target is not set`);
    }
    return this._target as TTarget;
  }

  destroy() {
    this.onDestroy();
    this._target = undefined;
  }

  invokeOnAttached_internal() {
    this.onAttached();
  }

  invokeOnDetached_internal() {
    this.onDetached();
  }

  invokeOnSceneGUI_internal(ctx: SceneGuiContext) {
    this.onSceneGUI(ctx);
  }

  protected onAttached(): void {

  }

  protected onDetached(): void {

  }

  protected onDestroy(): void {
  }

  protected onSceneGUI(ctx: SceneGuiContext): void {
    void ctx;
  }

  private _target: TTarget | undefined = undefined;
}

const componentEditorTypeRegistry = new WeakMap<new (...args: never[]) => Component, {
  editorClass: new (target: Component) => ComponentEditor<Component>;
}>();

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ComponentEditor {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace LegacyDecorators {
    export function attachTo<TTarget extends Component>(targetComponentClass: new (...args: never[]) => TTarget) {
      return (componentEditorClass: new (target: TTarget) => ComponentEditor<TTarget>) => {
        componentEditorTypeRegistry.set(targetComponentClass, {
          editorClass: componentEditorClass as unknown as new (target: Component) => ComponentEditor<Component>,
        });
      };
    }
  }
}

class ComponentEditorSystem extends System {
  constructor(opts: {
    handlesRenderRoot: Node;
  }) {
    super();
    this._controllerOnDestroy = new AbortController();
    this._handleInput = new HandleEditorInput();
    this._sceneGuiContext = new SceneGuiContext(this._handleInput, {
      renderer: {
        node: opts.handlesRenderRoot,
      },
    });
  }

  addComponent(component: Component) {
    const componentType = component.constructor;
    const componentEditorType = componentEditorTypeRegistry.get(componentType as new (...args: never[]) => Component);
    if (!componentEditorType) {
      return;
    }
    const componentEditor = new componentEditorType.editorClass(component);
    this._componentEditors.set(component, componentEditor);
    componentEditor.invokeOnAttached_internal();
  }

  removeComponent(component: Component) {
    const componentEditor = this._componentEditors.get(component);
    if (componentEditor) {
      componentEditor.invokeOnDetached_internal();
      componentEditor.destroy();
      this._componentEditors.delete(component);
    }
  }

  override destroy(): void {
    this._sceneGuiContext.destroy_internal();
    this._controllerOnDestroy.abort();
    this._handleInput.destroy();
    for (const componentEditor of this._componentEditors.values()) {
      componentEditor.invokeOnDetached_internal();
      componentEditor.destroy();
    }
    this._componentEditors.clear();
  }

  override update(_deltaTime: number): void {
    const sceneGuiContext = this._sceneGuiContext;
    sceneGuiContext.startFrame_internal({});
    const selectedNodes = getSelectedNodes();
    try {
      for (const [component, componentEditor] of this._componentEditors) {
        const node = component.node;
        if (!selectedNodes.includes(node.uuid)) {
          continue;
        }
        sceneGuiContext.handles.pushScope(component.uuid);
        try {
          componentEditor.invokeOnSceneGUI_internal(sceneGuiContext);
        } finally {
          sceneGuiContext.handles.popScope();
        }
      }
    } finally {
      sceneGuiContext.endFrame_internal();
    }
  }

  private _componentEditors: Map<Component, ComponentEditor> = new Map();
  private _handleInput: HandleEditorInput;
  private _sceneGuiContext: SceneGuiContext;
  private _controllerOnDestroy: AbortController;
}

function getSelectedNodes() {
  return globalEditor.Selection.getSelected('node');
}

const handlesRenderRootNodeName = '::handles-render-root::';

export async function startComponentEditor() {
  if (!isSceneEditorEnv()) {
    return;
  }

  const handlesRenderRoot = new Node(handlesRenderRootNodeName);
  const flags = CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
  handlesRenderRoot.objectFlags |= flags;
  director.addPersistRootNode(handlesRenderRoot);
  const componentEditorSystem = new ComponentEditorSystem({
    handlesRenderRoot,
  });
  director.registerSystem('component-editors', componentEditorSystem, System.Priority.MEDIUM);
  import.meta.hot?.signalOnDispose.addEventListener('abort', () => {
    componentEditorSystem.destroy();
    director.unregisterSystem(componentEditorSystem);
    handlesRenderRoot.destroy();
  });

  (async () => {
    try {
      for await (const [_, component] of EventEmitter.on(EditorExtends.Component, 'add', {
        signal: import.meta.hot?.signalOnDispose,
      })) {
        componentEditorSystem.addComponent(component);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
      // nop
      } else {
        throw err;
      }
    }
  })().catch(console.error.bind(console));

  (async () => {
    try {
      for await (const [_, component] of EventEmitter.on(EditorExtends.Component, 'remove', {
        signal: import.meta.hot?.signalOnDispose,
      })) {
        componentEditorSystem.removeComponent(component);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
      // nop
      } else {
        throw err;
      }
    }
  })().catch(console.error.bind(console));
}
