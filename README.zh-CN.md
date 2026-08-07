# Pie

[English](README.md) | [简体中文](README.zh-CN.md)

> 一个基于 [Pi](https://github.com/earendil-works/pi) 构建的个人开源 AI Agent。

Pie 是一个实验性项目，目标是在 Pi Agent Harness 之上打造一个专注、可扩展的个人 Agent。

## 项目状态

Pie 包含可移植的 Pi 配置、扩展、提示词和主题。随着项目继续发展，接口和安装方式仍可能调整。

## 目标

- **为个人而设计：** 适配个人的工作流、工具和偏好。
- **可组合：** 保持工具、Skills、提示词和交互界面的模块化。
- **透明：** 让 Agent 的行为和配置易于理解与检查。
- **上游友好：** 尽可能通过 Pi 的公开包和扩展点进行开发。

## 基于 Pi 构建

Pie 计划使用 [`earendil-works/pi`](https://github.com/earendil-works/pi) 维护的公开包，包括 Agent Runtime、模型集成、Coding Agent SDK 和终端 UI 组件。

Pie 是一个独立项目，并非 Pi 官方项目的一部分。

## 仓库结构

- `agent/`：安装到 `~/.pi/agent` 的配置。
- `agent/extensions/`：Pi 扩展及其支持模块。
- `agent/prompts/`：可复用提示词模板。
- `agent/themes/`：终端界面的 Catppuccin 主题。
- `scripts/tests/`：针对扩展的 Node.js 测试。

## 安装

在可信任的 checkout 中运行安装脚本：

```sh
bash scripts/install.sh
```

可通过 `PI_AGENT_HOME` 安装到其他目录。安装器只复制由仓库管理的配置；Pi 运行时状态、凭据、会话、transcript 和 package cache 均保留在仓库之外。

## 验证

使用 Node.js 24 和 `jq` 运行 hermetic checks：

```sh
bash scripts/check.sh
```

本机已安装 `pi` 时，可单独运行扩展加载 smoke test：

```sh
bash scripts/pi-session-auto-title-load.smoke.sh
```

## 路线图

- 定义初始的 Agent 使用体验和配置模型。
- 构建最小可运行的 Agent Session。
- 扩展项目专属的工具、Skills 和提示词。
- 引入自动化测试和可复现的开发流程。
- 完善安装、配置和扩展开发文档。

## 开发

使用 Pi 的公开扩展 API，并确保运行时生成状态不进入版本控制。对于较大的改动，请先创建 Issue，以便尽早对齐目标和范围。

## 参与贡献

欢迎提交想法、问题报告和代码贡献。对于较大的改动，建议先创建 Issue，以便尽早对齐目标和范围。

## 开源协议

Pie 基于 [MIT License](LICENSE) 开源。
