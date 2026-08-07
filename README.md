# Pie

[English](README.md) | [简体中文](README.zh-CN.md)

> A personal, open-source AI agent built with [Pi](https://github.com/earendil-works/pi).

Pie is an experimental project for building a focused and extensible personal agent on top of the Pi agent harness.

## Status

Pie contains portable Pi configuration, extensions, prompts, and themes. Its interfaces and installation process may still change as the project grows.

## Goals

- **Personal by design:** Adapt to an individual's workflows, tools, and preferences.
- **Composable:** Keep tools, skills, prompts, and interfaces modular.
- **Transparent:** Make agent behavior and configuration understandable and inspectable.
- **Upstream-friendly:** Use Pi through its public packages and extension points whenever possible.

## Built with Pi

Pie plans to build on the public packages maintained by [`earendil-works/pi`](https://github.com/earendil-works/pi), including its agent runtime, model integrations, coding-agent SDK, and terminal UI components.

Pie is an independent project and is not an official part of the Pi project.

## Repository layout

- `agent/`: configuration installed into `~/.pi/agent`.
- `agent/extensions/`: Pi extensions and their supporting modules.
- `agent/prompts/`: reusable prompt templates.
- `agent/themes/`: Catppuccin themes for the terminal UI.
- `scripts/tests/`: focused Node.js tests for the extensions.

## Installation

Run the installer from a trusted checkout:

```sh
bash scripts/install.sh
```

Set `PI_AGENT_HOME` to install into another destination. The installer copies only the repository-owned configuration and leaves Pi runtime state, credentials, sessions, transcripts, and package caches outside this repository.

## Validation

Run the hermetic checks with Node.js 24 and `jq`:

```sh
bash scripts/check.sh
```

When the `pi` executable is installed, run the extension loader smoke test separately:

```sh
bash scripts/pi-session-auto-title-load.smoke.sh
```

## Roadmap

- Define the initial agent experience and configuration model.
- Build a minimal runnable agent session.
- Expand project-specific tools, skills, and prompts.
- Introduce automated tests and reproducible development workflows.
- Document installation, configuration, and extension authoring.

## Development

Use Pi's public extension APIs and keep runtime-generated state out of version control. Open an issue before substantial changes so the intended scope can be aligned early.

## Contributing

Ideas, bug reports, and contributions are welcome. Please open an issue before starting a substantial change so the intended scope can be aligned early.

## License

Pie is licensed under the [MIT License](LICENSE).
