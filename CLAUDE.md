# ChatUI

AI 聊天 Web 应用，支持多模型文本对话、图片生成/编辑、文件上传、管理后台、API连接测试。

## 技术栈

- **框架**: Next.js 16 (App Router, Turbopack)
- **数据库**: SQLite (Prisma ORM, `file:/app/data/prod.db`)
- **AI 接口**: OpenAI 兼容 API（通过 CPA 代理 `cliproxyapi:8317/v1`）
- **认证**: 自建 session-based 认证，bcryptjs 加密密码
- **UI**: Tailwind CSS + 自定义组件
- **配置**: DB优先（ApiConfig表 > 环境变量），30秒缓存

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页（重定向到 /login） |
| `/login` | 登录 |
| `/register` | 注册（需邀请码） |
| `/chat` | 聊天界面 |
| `/admin/users` | 用户管理 |
| `/admin/invite-codes` | 邀请码管理 |
| `/admin/api-config` | API 配置管理 |

## API 路由

### 认证
- `POST /api/auth/login` — 登录
- `POST /api/auth/register` — 注册（需邀请码）
- `POST /api/auth/logout` — 登出
- `GET /api/auth/me` — 获取当前用户信息

### 聊天
- `POST /api/chat` — AI 对话（支持文件附件上传）
- `GET/POST /api/sessions` — 会话列表/创建
- `GET/DELETE /api/sessions/[id]` — 获取/删除单个会话
- `GET /api/messages` — 消息列表

### 图片
- `POST /api/images` — AI 图片生成/编辑（form-data，支持上传参考图）

### 模型
- `GET /api/models` — 获取可用模型列表

### 上传文件
- `GET /api/uploads/[filename]` — 获取上传的文件

### 管理员
- `GET /api/admin/users` — 用户列表
- `GET /api/admin/users/[id]` — 用户详情
- `POST /api/admin/users/[id]/approve` — 审批用户
- `POST /api/admin/users/[id]/disable` — 禁用用户
- `GET/POST /api/admin/invite-codes` — 邀请码列表/创建
- `DELETE /api/admin/invite-codes/[id]` — 删除邀请码
- `GET/POST /api/admin/api-config` — API 配置查看/更新/连接测试

## AI 模型

- **聊天模型**: gpt-5.4-mini（默认）, gpt-5.4, gpt-5.5
- **图片模型**: gpt-image-2（默认，仅此一个）

## 环境变量

见 `.env.example` 或 `deploy/.env.example`，关键变量：
- `OPENAI_API_KEY` — CPA 的 API 密钥（也存于数据库 ApiConfig 表）
- `OPENAI_BASE_URL` — CPA 地址（默认 `http://cliproxyapi:8317/v1`）
- `SESSION_SECRET` — Session 加密密钥
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — 管理员初始账号
- `DATABASE_URL` — SQLite 数据库路径

**配置优先级**: 数据库 ApiConfig > 环境变量 > 代码默认值

## 用户系统

- 新注册用户需邀请码 + 管理员审批后才可使用
- 角色: admin / 普通用户
- 状态: pending / approved / disabled

## 部署

### 服务器部署路径
- **服务器**: 阿里云新加坡 8.219.160.126:21822
- **项目路径**: `/www/wwwroot/chat.rcrc.eu.org/ChatUI`
- **域名**: https://chat.rcrc.eu.org
- **容器端口**: 30010 → 3000（用 `docker-compose.server.yml`）
- **Docker 网络**: ai-net（与 CPA 共享）
- **镜像**: `jiasongji/chatui:latest`（拉取模式，由 GitHub Actions 自动构建发布）
- **注意**: 服务器 Docker 26.1.4，需用连字符版 `docker-compose`（非 `docker compose`）

### CI/CD 流程

镜像由 GitHub Actions 自动构建发布（`.github/workflows/docker-publish.yml`）：
- push 到 main → 自动构建 `jiasongji/chatui:latest`（amd64 + arm64）
- 打 `v*` tag → 额外发布语义化版本号
- 所需密钥：`DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`（仓库 Secrets）

### 更新部署流程

```bash
# 1. 推送代码到 GitHub（gh CLI 已认证，直接推即可触发自动构建）
cd ChatUI
git add -A && git commit -m "..." && git push origin main
# → GitHub Actions 自动构建发布镜像（约 5-8 分钟）

# 2. 服务器拉取最新镜像并重启（秒级，不编译，用连字符版 docker-compose）
ssh -i AL-SGP_8.219.160.126_id_ed25519 -p 21822 root@8.219.160.126 \
  "cd /www/wwwroot/chat.rcrc.eu.org/ChatUI && docker-compose -f docker-compose.server.yml pull && docker-compose -f docker-compose.server.yml up -d"

# 3. 查看日志
docker logs chatui -f
```

### GitHub

- **仓库**: https://github.com/jiasongji/ChatUI.git
- 本地 gh CLI 已认证为 jiasongji，可直接推送（无需服务器中转）

## 用户界面功能

### 聊天客户端 (ChatClient)
- 多模型切换（聊天/图片模式）
- 文件上传（聊天模式支持多文件，图片模式支持参考图）
- 上下文管理（30条限制，接近上限时提醒）
- 失败重试：发送失败时显示"重试"按钮，保存上下文重新发送
- 滚动导航：长对话时浮动显示"回到顶部"和"回到最新"按钮（定位在滚动区域外部）
- 暗色/亮色主题切换
- 浏览器通知（发送完成/失败时通知）

### 管理后台
- 用户管理：审批/禁用用户
- 邀请码管理：生成/删除邀请码
- API 配置管理：修改 API Key、Base URL、模型列表等（保存后即时生效）
- 连接测试：验证 API Key 和 Base URL 是否正确，显示可用模型列表

## 数据库 Schema

- `User` — 用户表（email, password, role, status, inviteCodeId）
- `ChatSession` — 会话表（title, userId）
- `Message` — 消息表（role, content, model, type, imageUrl, attachments）
- `InviteCode` — 邀请码表（code, usedById, usedAt）
- `ApiConfig` — API 配置表（key, value, label）
