# ChatUI

AI 聊天 Web 应用，支持多模型文本对话、图片生成/编辑、文件上传。

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
- `GET/POST /api/admin/api-config` — API 配置查看/更新

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
- **容器端口**: 30010 → 3000
- **Docker 网络**: ai-net（与 CPA 共享）

### 更新部署流程

```bash
# 1. 同步代码到服务器
rsync -avz --delete --exclude='.next' --exclude='node_modules' --exclude='.env' --exclude='data' --exclude='._*' \
  -e 'ssh -i AL-SGP-Key -p 21822' ./ root@8.219.160.126:/www/wwwroot/chat.rcrc.eu.org/ChatUI/

# 2. 重建并启动
ssh -i AL-SGP-Key -p 21822 root@8.219.160.126
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI
docker compose down && docker compose up -d --build

# 3. 查看日志
docker logs chatui -f
```

### GitHub

- **仓库**: https://github.com/jiasongji/ChatUI.git
- 推送需通过服务器（本地无法直连 GitHub）

## 数据库 Schema

- `User` — 用户表（email, password, role, status, inviteCodeId）
- `ChatSession` — 会话表（title, userId）
- `Message` — 消息表（role, content, model, type, imageUrl, attachments）
- `InviteCode` — 邀请码表（code, usedById, usedAt）
- `ApiConfig` — API 配置表（key, value, label）
