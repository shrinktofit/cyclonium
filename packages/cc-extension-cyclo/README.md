# Cyclo Vortex extension

The Asset Pipeline authoring assets are registered by the Oh My Script extension. A consuming project must install both extensions, install `@cyclonium/core`, and make that runtime package a project peer:

```js
// oms.config.mjs
export default {
  resolve: {
    projectPeers: ['@cyclonium/core'],
  },
}
```

Cyclo imports its decorators through `#oms-peer:@cyclonium/core`. OMS therefore fails the project build when the package is missing or not listed, instead of bundling a second class registry and producing duplicate `cyclo.*` class IDs.
