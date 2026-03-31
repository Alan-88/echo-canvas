# Project Status

## Current State

`v0` 已完成，可以作为个人项目公开发布。

当前仓库包含两条主线：

- `tracks/web`
  浏览器版，多人协作与自建部署主线。
- `tracks/tauri`
  桌面版，本地存档与远端大厅主线。

## Suitable For GitHub Release

- 功能已经达到“可演示、可运行、可继续扩展”的状态
- 仓库结构已完成分线整理
- 本地构建垃圾、历史保险箱、临时快照已从工作区移走
- 根入口文档已补齐
- 对外项目名已切换为 `EchoCanvas`
- 仓库许可证已确定为 `AGPL-3.0-or-later`
- Web 服务大厅已补 GitHub 源码入口

## Known Limitations

- 后端管理统计中的 `online_users` 仍是占位值
- 房间 `room_id` / `token` 的加密鉴权体系仍可继续增强
- Web 与 Tauri 仍有一部分共享边界没有抽成独立公共包
- 目前更偏向“可持续演进的 v0”，还不是完全冻结的长期维护版本
- Tauri 端还没有同步补上源码仓库入口 UI
- Tauri 仍缺少运行时 / 服务器配置界面
- Tauri 仍未补全局域网开放与本地联机入口

## Suggested GitHub Positioning

可以按下面的口径对外描述：

- 无限画布协作白板
- 支持 Web 与 Tauri 双宿主形态
- 支持本地 `.whiteboard` 存档、多人房间、Markdown/LaTeX、图层、导入导出
- 包含针对移动端触控与手写笔的专门交互优化

## Suggested Next Steps

- 为 Tauri 补上源码仓库入口
- 为 Tauri 增加运行时与服务器配置界面
- 补全 Tauri 的局域网开放与本地联机入口
- 继续收拢 Web 与 Tauri 的宿主体验
- 在真正公开前，再做一次敏感信息与私有域名检查
