# cc-test

## Editor preview tests

Start the Vortex editor and wait for the project and extensions to finish loading.
Set `VITE_CC_TEST_EDITOR_BASE_URL` to the running editor's preview extension URL,
for example `http://127.0.0.1:12138/ext/volix.preview/`.

Browser tests load engine modules from the editor across origins. Configure the
editor's `web-server` preference `cors.allowedOrigins` to allow the Vitest browser
origin, normally `http://localhost:63315`. If Vitest chooses another port, allow
that origin as well. An isolated test editor can use `*` for this preference.
The integration fixtures run with normal Chromium web security enabled.

## Standalone tests

Set `VITE_CC_TEST_STANDALONE_ENGINE_DIR` to the compiled engine's `test-engine`
directory, or provide `standalone.dir` in the plugin options. Standalone tests
default to the HTML5 player platform with `HEADLESS: true`, including in Node.
Explicit `configure` options override these defaults.
