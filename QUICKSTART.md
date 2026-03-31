# Workspace Quickstart

根目录现在是总项目目录，默认不要直接把这里当成可执行工程。

## Tracks

- `tracks/web`
  当前 Web 主开发线。后续 Web 代码、文档、部署适配默认都在这里继续演进。
- `tracks/base`
  历史基底参考线。用于回溯和对比，不作为默认开发目标。
- `tracks/tauri`
  Tauri 桌面应用开发线。

## Default Working Path

如果任务没有特别说明，默认进入：

```bash
cd tracks/web
```

## Web Development

优先使用长期运行的 dev 容器：

```bash
cd tracks/web
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml up -d --build frontend
```

需要后端代码生效时，再单独重建：

```bash
cd tracks/web
docker compose -f docker-compose.dev.yml up -d --build backend
```

标准重建顺序：

- 只改前端静态资源或 React 代码：只重建 `frontend`
- 改了 Rust 后端代码、共享协议、后端环境变量：重建 `backend`
- 同时改了前后端，或不确定影响范围：先重建 `backend`，再重建 `frontend`
- 先用 `docker compose -f docker-compose.dev.yml ps` 看状态，能不重启就不重启

仅在容器方案失效时，才使用本地命令兜底。

后端兜底启动：

```bash
cd tracks/web/backend
cargo run
```

前端兜底启动：

```bash
cd tracks/web/frontend
pnpm dev --host 0.0.0.0 --port 5173
```

更完整的 Web 启动与历史说明，见：

- [`tracks/web/QUICKSTART.md`](./tracks/web/QUICKSTART.md)
- [`tracks/web/deploy/README.md`](./tracks/web/deploy/README.md)

## Deployment

生产部署目录由各自环境决定。

它不应与当前开发工作区强绑定；建议在独立的部署目录中进行构建、运行和上线验证。

## Tauri Development

```bash
cd tracks/tauri
pnpm install
pnpm tauri dev
```

更多背景见：

- [`README.md`](./README.md)
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md)
