# @cyclonium/physics-2d

## 1.0.1

### Patch Changes

- Updated dependencies [486645f]
  - @cyclonium/core@1.0.1
  - @cyclonium/debug-draw@1.0.1

## 1.0.0

### Patch Changes

- 84ebc9a: Split Cyclonium's persistence and Inspector property decorators into explicit, composable behaviors.

  `@stored` now only persists a property, while `@editable` only exposes it to the Inspector. Use both decorators when a property must be persisted and edited:

  ```ts
  @stored
  @editable
  property = value
  ```

  The ambiguous `serializable` compatibility decorator and public export have been removed. Migrate persistence-only properties to `@stored`, Inspector-only properties to `@editable`, and properties requiring both behaviors to `@stored @editable`.

  All existing `@editable` options and underscore-prefixed property display names remain supported.

- Updated dependencies [84ebc9a]
  - @cyclonium/core@1.0.0
  - @cyclonium/debug-draw@1.0.0

## 0.1.0

### Minor Changes

- 4f36762: Share fixed-rate time accumulation between component and physics updates, run physics at its configured rate, honor each physics step's delta time, and clamp overloaded update input before accumulation while preserving prior fractional time.

### Patch Changes

- 4f36762: Distribute position-based kinematic targets across all substeps in a physics step batch.
- Updated dependencies [4f36762]
  - @cyclonium/core@0.0.105
  - @cyclonium/debug-draw@0.0.105

## 0.0.104

### Patch Changes

- @cyclonium/core@0.0.104
- @cyclonium/debug-draw@0.0.104

## 0.0.103

### Patch Changes

- Updated dependencies [438a8bd]
  - @cyclonium/algorithm@1.0.0
  - @cyclonium/core@0.0.103
  - @cyclonium/debug-draw@0.0.103
  - @cyclonium/event@0.0.103

## 0.0.102

### Patch Changes

- 1f0c093: Bump Cyclonium packages to 0.0.102.
- Updated dependencies [1f0c093]
  - @cyclonium/algorithm@0.0.102
  - @cyclonium/core@0.0.102
  - @cyclonium/debug-draw@0.0.102
  - @cyclonium/event@0.0.102
  - @cyclonium/rapier2d@0.0.102
  - @cyclonium/web-assembly@0.0.102

## 0.0.101

### Patch Changes

- cb7f174: Bump Cyclonium packages to 0.0.101.
- Updated dependencies [cb7f174]
  - @cyclonium/algorithm@0.0.101
  - @cyclonium/core@0.0.101
  - @cyclonium/debug-draw@0.0.101
  - @cyclonium/event@0.0.101
  - @cyclonium/rapier2d@0.0.101
  - @cyclonium/web-assembly@0.0.101
