---
"@cyclonium/core": major
"@cyclonium/2d": patch
"@cyclonium/physics-2d": patch
---

Split Cyclonium's persistence and Inspector property decorators into explicit, composable behaviors.

`@stored` now only persists a property, while `@editable` only exposes it to the Inspector. Use both decorators when a property must be persisted and edited:

```ts
@stored
@editable
property = value
```

The ambiguous `serializable` compatibility decorator and public export have been removed. Migrate persistence-only properties to `@stored`, Inspector-only properties to `@editable`, and properties requiring both behaviors to `@stored @editable`.

All existing `@editable` options and underscore-prefixed property display names remain supported.
