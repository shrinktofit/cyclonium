---
'@cyclonium/2d': major
---

BREAKING: `Sprite` now aliases Cocos `SpriteFrame` instead of `Texture2D`, and `SpriteRenderer.sprite` accepts `SpriteFrame | undefined`.
`SpriteRenderer` now uses the assigned `SpriteFrame`'s pivot, rect size, and UVs when building its simple quad.

Migrate direct `Texture2D` assignments by wrapping the texture in a `SpriteFrame`:

```ts
const sprite = new SpriteFrame();
sprite.reset({ texture });
renderer.sprite = sprite;
```
