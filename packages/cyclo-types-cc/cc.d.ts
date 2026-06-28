/// <reference types="./node_modules/@cocos/creator-types/engine.d.ts" />

declare module 'cc' {
  export namespace componentEditorTraits {
    export interface BoundingComponent extends Component {
      [BoundingComponent.Tags.getBoundingBox](): geometry.AABB | undefined;
    }

    export namespace BoundingComponent {
      function is(component: Component): component is BoundingComponent;

      export namespace Tags {
        export const getBoundingBox: unique symbol;
      }
    }
  }
}
