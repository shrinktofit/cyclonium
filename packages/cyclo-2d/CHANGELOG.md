# @cyclonium/2d

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
