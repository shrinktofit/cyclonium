---
"@cyclonium/2d": major
---

Remove `SpriteRenderer.pixelsPerUnit` and size sprites from `SpriteFrame.pixelsToUnit` instead.

`SpriteRenderer` now exposes `geometryScale`, which defaults to `1` and multiplies the SpriteFrame-derived geometry size. To migrate old renderer-level scale overrides, use:

```ts
renderer.geometryScale = spriteFrame.pixelsToUnit / oldPixelsPerUnit
```

Existing scenes and prefabs with serialized non-default `_pixelsPerUnit` values are not automatically migrated to `_geometryScale`. Update each affected renderer with the formula above and resave the asset to preserve its previous geometry size.
