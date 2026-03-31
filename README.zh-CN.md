# EchoCanvas

[English](./README.md)

EchoCanvas 是一个本地优先的白板系统，结合了多人协作、本地数据掌控，以及灵活的自部署能力。

![EchoCanvas 主工作区](./docs/images/hero-workspace.png)

- Web 与 Tauri 双宿主
- 支持自部署联机房间与本地 `.whiteboard` 存档
- 围绕手写、讨论与高频交互持续打磨使用体验

## Why EchoCanvas

EchoCanvas 的起点其实很简单：很多白板和协作工具，恰恰会在小团队最需要一起思考的时候，变得不好用。

- **协作不该被平台摩擦打断。**
  小团队讨论不应该被会议时长、账号体系、房间规则或平台订阅打断。白板应该在需要它的时候随时可用，而不是只有在某个商业平台允许的前提下才能继续使用。

- **用户应该掌控自己的数据、部署方式与扩展路径。**
  与其把存储、同步、OCR 或协作能力都锁进单一的托管平台，EchoCanvas 更强调本地优先和用户掌控。无论是完全本地使用、连接自己的服务器，还是按照自己的方式扩展工作流，这些路径都应该由用户自己决定。

这个项目最初来自一次真实的小组协作需求，后来逐渐演变成一个持续打磨的个人项目：我想做一个比手头现成工具更可控、更自由、也更适合真实讨论场景的白板。

## What It Includes

- **本地优先与数据掌控**
  支持本地 `.whiteboard` 文件，不默认依赖某个商业平台的账号体系作为唯一的数据入口。

- **自部署多人协作**
  支持多人房间协作，适合部署在自己的服务器上，也能覆盖局域网或远端连接场景，而不是只能依赖单一官方服务。

- **Web + 桌面双宿主**
  同一套白板产品同时提供 Web 与 Tauri 两种宿主形态，分别面向浏览器协作和桌面本地优先体验。

- **面向真实使用的白板工作流**
  这个项目不是一次性 Demo，而是在真实使用中反复迭代出来的工具。手写、文本、选择、触控和混合内容等高频工作流都经过持续调整。

## Architecture at a Glance

EchoCanvas 不只是一个“能画线的画板”，而是一套面向不同宿主环境展开的白板系统。它尝试把运行环境、协作方式与本地掌控拆开处理，但又不把它们做成彼此割裂的两套产品。

- **Web 宿主**
  面向浏览器访问、自部署房间和远端协作，是当前多人联机与线上部署的主要承载形态。

- **Tauri 宿主**
  面向桌面运行、本地 `.whiteboard` 文件和本地优先使用，同时也保留连接远端服务器或局域网服务的能力。

- **同一个白板核心，落在两个宿主中**
  Web 和 Tauri 不是两个互不相关的项目，而是同一套白板系统在不同运行环境下的两种宿主形态。它们共享相同的产品方向与协作语义，只是在本地能力和运行方式上有所区别。

## Visual Overview

### Tauri 本地存档大厅

![Tauri 本地存档大厅](./docs/images/tauri-lobby.jpg)

### Web 与 Tauri 同步演示

![Web 与 Tauri 同步演示](./docs/images/web-tauri-sync.gif)

## Repository Layout

- [`tracks/web`](./tracks/web)
  当前浏览器主线，也是默认开发与协作路径。
- [`tracks/tauri`](./tracks/tauri)
  当前桌面宿主线，承载本地优先与桌面能力。
- [`tracks/base`](./tracks/base)
  早期一体化基底参考线，用于回溯与对比，不作为当前主叙事。
- [`archive`](./archive)
  工作区级别迁移与跨分线记录。

## Getting Started

- 当前项目已经完成 `v0` 收口，可以继续作为长期个人项目迭代。
- 根工作区说明与常用命令：[`QUICKSTART.md`](./QUICKSTART.md)
- Web 线说明：[`tracks/web/QUICKSTART.md`](./tracks/web/QUICKSTART.md)
- Tauri 线说明：[`tracks/tauri/README.md`](./tracks/tauri/README.md)
- 当前发布状态与已知限制：[`PROJECT_STATUS.md`](./PROJECT_STATUS.md)

## Development Workflow

EchoCanvas 不是一次性设计完成后再整体实现的项目，而是在持续迭代中逐步收敛出来的。开发过程中使用了 AI-assisted workflow 来做方案探索、实现加速和问题排查，但每一轮迭代中的方向判断、取舍和最终验收仍然需要人工完成。

很多能力都是先做出可运行版本，再结合实际使用、回归测试和后续重构不断修正的。项目里的交互、联机、持久化和部署方案，基本都是沿着这种方式一步步演进出来的。

## Quick Start

- **Web**
  从 [`tracks/web/QUICKSTART.md`](./tracks/web/QUICKSTART.md) 开始。当前 Web 主线支持通过 Docker Compose 启动容器，也是默认开发路径。

- **Tauri**
  从 [`tracks/tauri/README.md`](./tracks/tauri/README.md) 开始。桌面主线可以在开发模式下运行，后续也可打包为独立 App，并以本地 `.whiteboard` 文件作为本地优先基础。

- **生产部署 / 自部署**
  当前生产部署链路已经在真实环境中使用，但反向代理、隧道、域名和环境变量配置仍然带有一定环境依赖，还没有被整理成完全通用的一键公开部署模板。

## Status and Next Steps

- EchoCanvas 当前已经达到可运行、可演示、可继续演进的 `v0` 状态。
- 现阶段的重点已经不再是证明这个想法能不能做出来，而是继续把项目整理得更干净、更适合公开发布，也更容易长期维护。
- 接下来的具体方向包括：
  - 为 Tauri 增加运行时与服务器配置界面
  - 补全 Tauri 的局域网开放与本地联机入口
  - 继续围绕同一个白板核心，收拢 Web 与 Tauri 的使用体验

## Development Defaults

- 默认 Web 开发路径：`tracks/web`
- 默认 Tauri 开发路径：`tracks/tauri`
- 线上部署目录因环境而异，公开仓库中不再固定写死
- `tracks/base` 默认只读

## License

- 仓库默认按 `AGPL-3.0-or-later` 发布
- Copyright (C) 2026 Alan Wang
- Web 端会提供源码仓库入口；Tauri 端入口后续补齐

## Notes

- 当前仓库以“一个核心白板能力，两条宿主形态”演进
- Web 与 Tauri 在前端交互层尽量保持一致
- 线上部署配置和本地私有环境变量不会提交到 GitHub
