# @cyclonium/core

## 1.0.3

### Patch Changes

- 3e1008f: Publish internal workspace dependencies and peers with caret ranges instead of exact versions. Preserve local workspace linking and each dependency's current minimum compatible version.
- Updated dependencies [3e1008f]
  - @cyclonium/abort-controller@0.0.103
  - @cyclonium/algorithm@1.0.1
  - @cyclonium/math@0.0.105

## 1.0.2

### Patch Changes

- 8d3cd9f: Provide the typed `CCObject.objectFlags` polyfill through `@cyclonium/core/cc-polyfills/object-flag` and automatically load it from framework and editor. Editor object flags now update the engine without requiring a project-owned polyfill.

## 1.0.1

### Patch Changes

- 486645f: Add `ModelRendererSorting` to connect Cocos `ModelRenderer` components to Cyclo sorting layers, and expose the `disallowMultiple` component decorator from Cyclo Core.

## 1.0.0

### Major Changes

- 84ebc9a: Split Cyclonium's persistence and Inspector property decorators into explicit, composable behaviors.

  `@stored` now only persists a property, while `@editable` only exposes it to the Inspector. Use both decorators when a property must be persisted and edited:

  ```ts
  @stored
  @editable
  property = value
  ```

  The ambiguous `serializable` compatibility decorator and public export have been removed. Migrate persistence-only properties to `@stored`, Inspector-only properties to `@editable`, and properties requiring both behaviors to `@stored @editable`.

  All existing `@editable` options and underscore-prefixed property display names remain supported.

## 0.0.105

### Patch Changes

- 4f36762: Share fixed-rate time accumulation between component and physics updates, run physics at its configured rate, honor each physics step's delta time, and clamp overloaded update input before accumulation while preserving prior fractional time.

## 0.0.104

### Patch Changes

- Updated dependencies [9c91746]
  - @cyclonium/math@0.0.104

## 0.0.103

### Patch Changes

- Updated dependencies [2ab6f2b]
- Updated dependencies [438a8bd]
  - @cyclonium/math@0.0.103
  - @cyclonium/algorithm@1.0.0

## 0.0.102

### Patch Changes

- 1f0c093: Bump Cyclonium packages to 0.0.102.
- Updated dependencies [1f0c093]
  - @cyclonium/abort-controller@0.0.102
  - @cyclonium/algorithm@0.0.102
  - @cyclonium/math@0.0.102

## 0.0.101

### Patch Changes

- cb7f174: Bump Cyclonium packages to 0.0.101.
- Updated dependencies [cb7f174]
  - @cyclonium/abort-controller@0.0.101
  - @cyclonium/algorithm@0.0.101
  - @cyclonium/math@0.0.101
