# Pie

[English](README.md) | [简体中文](README.zh-CN.md)

> 一个基于 [Pi](https://github.com/earendil-works/pi) 构建的个人开源 AI Agent。

Pie 是一个实验性项目，目标是在 Pi Agent Harness 之上打造一个专注、可扩展的个人 Agent。

## 项目状态

Pie 目前处于早期开发阶段。随着首个可运行版本逐步成形，接口、项目结构和安装方式都可能发生变化。

## 目标

- **为个人而设计：** 适配个人的工作流、工具和偏好。
- **可组合：** 保持工具、Skills、提示词和交互界面的模块化。
- **透明：** 让 Agent 的行为和配置易于理解与检查。
- **上游友好：** 尽可能通过 Pi 的公开包和扩展点进行开发。

## 基于 Pi 构建

Pie 计划使用 [`earendil-works/pi`](https://github.com/earendil-works/pi) 维护的公开包，包括 Agent Runtime、模型集成、Coding Agent SDK 和终端 UI 组件。

Pie 是一个独立项目，并非 Pi 官方项目的一部分。

## 路线图

- 定义初始的 Agent 使用体验和配置模型。
- 构建最小可运行的 Agent Session。
- 添加项目专属的工具、Skills 和提示词。
- 引入自动化测试和可复现的开发流程。
- 完善安装、配置和扩展开发文档。

## 开发

开发环境说明将随首个实现一同加入。在此之前，可以通过 Issue 讨论需求、设计决策和贡献提案。

## 参与贡献

欢迎提交想法、问题报告和代码贡献。对于较大的改动，建议先创建 Issue，以便尽早对齐目标和范围。

## 开源协议

Pie 基于 [MIT License](LICENSE) 开源。
