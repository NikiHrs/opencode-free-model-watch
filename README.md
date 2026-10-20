# opencode-free-model-watch

An OpenCode TUI plugin. At each start, it compares the model list to the previous start.
It then shows a notice for each model that became free, and for each new free model.

A model counts as free only when all of its cost entries are zero.

## Install

```sh
opencode plugin add github:NikiHrs/opencode-free-model-watch
```

Restart OpenCode after the install.

## Develop

```sh
bun install
bun test
```
