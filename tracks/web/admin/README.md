# 白板服务器管理后台

本地管理界面，用于查看服务器统计信息和已保存的房间列表。

## 使用方式

### 1. 启动后端服务器

```bash
cd backend
cargo run
```

### 2. 安装管理界面依赖（首次使用）

```bash
cd admin
pnpm install
```

### 3. 启动管理界面开发服务器

```bash
cd admin
pnpm dev
```

服务器将在 `http://127.0.0.1:3001` 启动

### 4. 使用VSCode端口转发（推荐）

如果服务器在远程机器上：

1. 在VSCode中按 `Cmd+Shift+P`（Mac）或 `Ctrl+Shift+P`（Windows/Linux）
2. 输入 "Forward a Port"
3. 输入端口号：`3001`
4. 在本地浏览器打开：`http://localhost:3001`

这样你就可以在本地浏览器访问远程服务器的管理界面。

## 功能特性

### 服务器统计

- **活跃房间**：当前在内存中的房间数量
- **已保存房间**：持久化到磁盘的房间数量
- **服务器版本**：当前后端版本号

### 房间列表

显示所有已保存的房间，包括：
- 原始房间号
- 恢复Token（点击可复制）
- 保存时间
- 画布数量
- 图形总数
- 保存次数

### 自动刷新

- 页面加载时自动获取数据
- 每30秒自动刷新一次
- 可手动点击"刷新"按钮

## API端点

管理界面调用以下API：

- `GET http://localhost:3000/api/admin/stats` - 获取服务器统计
- `GET http://localhost:3000/api/admin/rooms` - 获取房间列表

## 安全性

### 为什么不需要密钥验证？

1. **管理界面只在本地打开**：直接打开本地HTML文件，不走内网穿透
2. **API端点虽然在3000端口**：但只要不暴露给公网，就很安全
3. **实际使用场景**：
   - 内网穿透只映射 `/ws` 和 `/api/room` 路由
   - `/api/admin` 不在内网穿透范围内
   - 只有本地访问 localhost:3000 才能调用管理API

### 建议的内网穿透配置

如果使用frp等内网穿透工具，建议只映射必要的路径：

```ini
[whiteboard]
type = http
local_ip = 127.0.0.1
local_port = 3000
subdomain = your-subdomain
# 只转发这些路径
locations = /,/ws,/api/room
# 不要转发 /api/admin
```

这样即使服务器在3000端口，管理API也不会被外部访问。

## 截图

![管理后台截图](screenshot.png)

## 技术栈

- 纯HTML + CSS + JavaScript
- 无需构建，直接打开即用
- 使用Fetch API调用后端
- 响应式设计，支持移动端
