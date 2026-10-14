---
'@cyclonium/core': patch
'@cyclonium/editor': patch
---

Provide the typed `CCObject.objectFlags` polyfill through `@cyclonium/core/cc-polyfills/object-flag` and automatically load it from framework and editor. Editor object flags now update the engine without requiring a project-owned polyfill.
