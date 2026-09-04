# @cyclonium/2d

## 3.1.0

### Minor Changes

- 486645f: Add `ModelRendererSorting` to connect Cocos `ModelRenderer` components to Cyclo sorting layers, and expose the `disallowMultiple` component decorator from Cyclo Core.

### Patch Changes

- Updated dependencies [486645f]
  - @cyclonium/core@1.0.1
  - @cyclonium/editor@1.0.1

## 3.0.0

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
  - @cyclonium/editor@1.0.0

## 2.0.2

### Patch Changes

- Updated dependencies [4f36762]
  - @cyclonium/core@0.0.105
  - @cyclonium/editor@0.0.105

## 2.0.1

### Patch Changes

- a1c79ac: Fix sortable renderers and sorting groups to respect the configured sorting layer order instead of comparing stable layer IDs.

## 2.0.0

### Major Changes

- e46185f: Remove `SpriteRenderer.pixelsPerUnit` and size sprites from `SpriteFrame.pixelsToUnit` instead.

  `SpriteRenderer` now exposes `geometryScale`, which defaults to `1` and multiplies the SpriteFrame-derived geometry size. To migrate old renderer-level scale overrides, use:

  ```ts
  renderer.geometryScale = spriteFrame.pixelsToUnit / oldPixelsPerUnit;
  ```

  Existing scenes and prefabs with serialized non-default `_pixelsPerUnit` values are not automatically migrated to `_geometryScale`. Update each affected renderer with the formula above and resave the asset to preserve its previous geometry size.

### Patch Changes

- 832cd5e: Fix SpriteRenderer's default effect so SpriteFrame UVs render upright instead of being flipped vertically.

## 1.1.0

### Minor Changes

- e91a401: Rename the packaged assets metadata manifest to `.meta.json` and update the `./assets-meta` export to the new path.

## 1.0.0

### Major Changes

- e149bd5: BREAKING: `Sprite` now aliases Cocos `SpriteFrame` instead of `Texture2D`, and `SpriteRenderer.sprite` accepts `SpriteFrame | undefined`.
  `SpriteRenderer` now uses the assigned `SpriteFrame`'s pivot, rect size, and UVs when building its simple quad.

  Migrate direct `Texture2D` assignments by wrapping the texture in a `SpriteFrame`:

  ```ts
  const sprite = new SpriteFrame();
  sprite.reset({ texture });
  renderer.sprite = sprite;
  ```

## 0.0.104

### Patch Changes

- @cyclonium/core@0.0.104
- @cyclonium/editor@0.0.104

## 0.0.103

### Patch Changes

- @cyclonium/core@0.0.103
- @cyclonium/editor@0.0.103

## 0.0.102

### Patch Changes

- 1f0c093: Bump Cyclonium packages to 0.0.102.
- Updated dependencies [1f0c093]
  - @cyclonium/core@0.0.102
  - @cyclonium/editor@0.0.102

## 0.0.101

### Patch Changes

- cb7f174: Bump Cyclonium packages to 0.0.101.
- Updated dependencies [cb7f174]
  - @cyclonium/core@0.0.101
  - @cyclonium/editor@0.0.101
