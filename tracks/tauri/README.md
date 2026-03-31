# Tauri Track

该目录用于白板桌面 App 线。

当前阶段目标：

1. 先保留现有 Web 白板交互，迁入 Tauri 壳
2. 跑通“宿主内本地后端 + 单人本地存档”最小闭环
3. 保持 `tracks/web` 稳定，不在 Web 线里混做桌面改动
4. `.whiteboard` / SQLite 留到下一阶段

## 当前状态

- 已完成 Tauri 2 + React + TypeScript 最小工程初始化
- 已迁入当前 Web 白板前端代码
- 已迁入 backend / shared，并整理为 Tauri 工作区
- 已由 Tauri Rust 宿主在启动时拉起本地 Axum 服务
- 默认固定进入单人房间 `local-room`
- 已支持单文件本地存档与自动恢复
- 尚未切换 `.whiteboard` / SQLite
- 尚未做桌面端专属 UI/菜单/文件系统增强

## 目录约定

- `src/`
  - Tauri 前端入口与桌面模式 UI
- `backend/`
  - 复用后的本地 Axum 服务库/二进制
- `shared/`
  - 前后端共享消息与类型
- `src-tauri/`
  - Tauri Rust 宿主，负责启动本地后端与管理数据目录
- `notes/`
  - 架构检查点与本地开发说明
- `archive/`
  - 阶段性记录

## 当前运行模型

- 前端仍通过 HTTP / WebSocket 与后端通信
- Tauri 运行时默认连接 `127.0.0.1:3000`
- 宿主启动后会在本地 app data 目录下创建单人存档
- 当前单人存档文件名为 `single-player.whiteboard`
- `.whiteboard` 当前是单文件容器：
  - 外层固定为 MessagePack envelope
  - 内层快照 payload 仍可为 JSON 或 MessagePack
  - 内嵌图片等资源暂时直接随快照一起存入单文件
- 现阶段仍不是 SQLite；之后可以在不改扩展名的前提下升级

## 当前 UI 语义

- Tauri 单机模式下：
  - 左侧栏展示本地单人存档状态
  - 保存按钮表示保存本地快照，不再表示同步到服务器
  - 导出菜单可直接导出 `.whiteboard`
  - 不显示 Room ID / Token / Leave Room / Close Room
- Web 多房间语义仍保留在代码边界内，供后续联机模式复用

## 开发测试说明

服务器上可以完成：

- 工程初始化
- 前端代码开发
- Rust 宿主代码开发
- 基础构建校验

但以下内容必须回到本地机器测试：

- 窗口行为
- 文件系统交互
- 原生剪贴板
- 托盘、菜单、系统权限
- 真正的桌面 App 生命周期

也就是说，日常不是每次都要打包，但一旦要测 Tauri 壳本身，就需要把 `tracks/tauri` 同步到本地后运行：

```bash
pnpm tauri dev
```

## 当前架构原则

- `TODO(organize):` Tauri 与 Web 的共享边界先不硬抽；等桌面壳第一次跑通后，在下一次相关迭代回收
- 第一阶段优先追求“最小壳可运行”
- 第一阶段默认推荐继续保留本地 HTTP / WS 服务模型，而不是立刻改成纯 Tauri command
