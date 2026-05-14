# AL-SGP (ChatUI)

AI 聊天 Web 应用，支持文本对话和图片生成。

## 项目结构

当前目录 `/Users/mac/Desktop/Srv/AL-SGP` 是**构建输出/部署目录**，仅包含 `.next` 构建产物。
源代码位于 `/Users/mac/Desktop/Dev/AL-SGP`。

## 技术栈

- **框架**: Next.js (App Router, standalone 输出模式)
- **数据库**: SQLite (Prisma ORM, `file:/app/data/prod.db`)
- **AI 接口**: OpenAI 兼容 API（代理地址 `cliproxyapi:8317/v1`）
- **认证**: 自建 session-based 认证，bcryptjs 加密密码
- **UI**: MUI (Material UI)
- **配置**: `next.config.mjs`

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/login` | 登录 |
| `/register` | 注册 |
| `/chat` | 聊天界面 |
| `/admin/users` | 管理员用户管理 |

## API 路由

### 认证
- `POST /api/auth/login` — 登录
- `POST /api/auth/register` — 注册
- `POST /api/auth/logout` — 登出
- `GET /api/auth/me` — 获取当前用户信息

### 聊天
- `POST /api/chat` — AI 对话（流式响应）
- `GET/POST /api/sessions` — 会话列表/创建
- `GET/DELETE /api/sessions/[id]` — 获取/删除单个会话
- `GET/POST /api/messages` — 消息列表/发送

### 图片生成
- `POST /api/images` — AI 图片生成

### 管理员
- `GET /api/admin/users` — 用户列表
- `GET /api/admin/users/[id]` — 用户详情
- `POST /api/admin/users/[id]/approve` — 审批用户
- `POST /api/admin/users/[id]/disable` — 禁用用户

## AI 模型配置

- **默认聊天模型**: gpt-5.4-mini
- **可选聊天模型**: gpt-5.4-mini, gpt-5.4, gpt-5.5
- **默认图片模型**: gpt-image-2
- **可选图片模型**: gpt-image-2

## 环境变量

见 `.env.example`，关键变量：
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` — AI 接口配置
- `SESSION_SECRET` — Session 加密密钥
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — 管理员初始账号
- `DATABASE_URL` — SQLite 数据库路径
- `DEFAULT_CHAT_MODEL` / `DEFAULT_IMAGE_MODEL` — 默认模型
- `ALLOWED_CHAT_MODELS` / `ALLOWED_IMAGE_MODELS` — 允许的模型列表

## 用户角色

系统有用户审批机制：新注册用户需管理员审批后才可使用。
管理员可通过 `/admin/users` 页面管理用户的审批和禁用状态。

## 部署

- 使用 Docker 部署（有 `.dockerignore`）
- Next.js standalone 模式，可直接用 `node .next/standalone/server.js` 运行
- 数据持久化：`data/` 目录（SQLite 数据库文件）
