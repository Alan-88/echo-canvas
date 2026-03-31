# Web Track Quickstart

该文档对应 `tracks/web` 当前主线，只描述**当前真实有效**的 Web 启动、联调与部署入口。

## Current Default Workflow

当前默认开发方式是：

- 进入 `tracks/web`
- 优先使用 `docker compose`
- 前端改动时重建 `frontend`
- 后端改动需要生效时再单独重建 `backend`
- 默认直接通过两个端口访问，不依赖额外网关

除非容器方案失效，否则不再把 `cargo run` / `pnpm dev` 当作主流程。

## Start Dev Containers

在 `tracks/web` 目录下：

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml up -d --build frontend
```

如果这次改动包含 Rust 后端代码，再执行：

```bash
docker compose -f docker-compose.dev.yml up -d --build backend
```

注意：

- 当前默认 dev 入口文件是 `docker-compose.dev.yml`
- 不要省略 `-f docker-compose.dev.yml`
- 这样可以避免把未来公开部署用的 compose 和本地开发 compose 混用

标准重建顺序：

- 只改前端静态资源或 React 代码：只重建 `frontend`
- 改了 Rust 后端代码、共享协议、后端环境变量：重建 `backend`
- 同时改了前后端，或不确定影响范围：先重建 `backend`，再重建 `frontend`
- 先用 `docker compose -f docker-compose.dev.yml ps` 看状态，能不重启就不重启

当前开发环境容器名：

- 前端：`whiteboard-frontend-dev`
- 后端：`whiteboard-backend-dev`

默认端口映射：

- 前端：`5173 -> container:80`
- 后端：`3000 -> container:3000`

## Access Paths

默认开发联调可以按“两端口模型”理解：

- 前端容器提供 Web 入口
- 后端容器提供 HTTP API 和 WebSocket

如果你只是本地或局域网测试，可以直接映射两个端口并分别访问前后端；这也是最容易理解、最不依赖个人网关习惯的部署方式。

当前代码已经支持：

- 前端通过 `VITE_API_BASE_URL` 指向后端 HTTP 地址
- 前端通过 `VITE_WS_BASE_URL` 指向后端 WebSocket 地址
- 后端默认开放 CORS，因此前后端分端口部署不需要额外改业务代码

## Fallback Local Commands

只有在容器方案失效或你明确需要本地排查时，才使用本地命令兜底。

后端：

```bash
cd backend
cargo run
```

前端：

```bash
cd frontend
pnpm dev --host 0.0.0.0 --port 5173
```

## Environment Notes

当前 Web 线最常见的环境变量分为三类：

### Frontend network

- `VITE_API_BASE_URL`
- `VITE_WS_BASE_URL`
- `VITE_FRONTEND_ORIGIN`

如果前端和后端不走同源路径，而是分开端口或分开域名，就需要设置这几项。

### OCR

- `OCR_BASE_URL`
- `OCR_API_KEY`
- `OCR_AUTH_HEADER`
- `OCR_AUTH_SCHEME`
- `OCR_MODEL`
- `OCR_REQUEST_FORMAT`
- `OCR_TIMEOUT_MS`
- `OCR_PROVIDER`

只有在你需要 OCR / LaTeX 识别时，才需要认真填写这些项。

### Protocol / snapshot switches

- `WS_MESSAGE_CODEC`
- `ROOM_SNAPSHOT_FORMAT`
- `VITE_WS_MESSAGE_CODEC`
- `VITE_WS_LAYER_OP_CODEC`

默认值已经能正常运行。除非你明确在做协议实验，否则不建议随意改动。

## Production Copy

生产部署目录由各自环境决定。

建议将它作为独立的部署副本，而不是主开发目录。日常开发和文档更新仍应在当前工作区完成，再按需同步到部署副本。

## Optional Reverse Proxy

如果你想把前后端收敛到同一域名、统一处理 HTTPS，当然可以自行加反向代理或隧道层。

但这属于**用户自己的环境层选择**，不是这个项目仓库需要内置的默认前提。项目默认只保证双端口部署能完整工作。

## Related Docs

- 根工作区导航：[`../../QUICKSTART.md`](../../QUICKSTART.md)
- 当前项目状态：[`../../PROJECT_STATUS.md`](../../PROJECT_STATUS.md)
- 可选部署参考：[`./deploy/README.md`](./deploy/README.md)
