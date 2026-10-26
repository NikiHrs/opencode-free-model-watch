# opencode-free-model-watch

An OpenCode TUI plugin. At each start, it compares the model list to the previous start.
It then shows a notice for each model that became free, and for each new free model.

A model counts as free only when all of its cost entries are zero.

## Install

```sh
opencode plugin github:NikiHrs/opencode-free-model-watch
```

Add `-g` to install in the global config. Restart OpenCode after the install.

Requirements:

- An OpenCode version with TUI plugin support (plugin API `@opencode/plugin` 2.x)
- Bun, which OpenCode uses to load TUI plugins

## How it works

- On the first start, the plugin records a baseline and shows how many free
  models it tracks.
- On the first start of each later day, it compares the current model list to
  the most recent start and shows a report when models became free.
- State is stored with OpenCode plugin storage on your machine. The plugin
  sends no data anywhere.

To silence the plugin, remove its entry from the `plugins` list in your
OpenCode config. To re-baseline, clear the `free-models` entry from OpenCode
plugin storage.

## Develop

```sh
bun install
bun test
bunx tsc --noEmit
```

## License

[MIT](LICENSE)
