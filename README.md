# ChatUI

AI Chat Web 应用，支持文本对话和图片生成。ChatGPT 风格 UI，暗色/亮色主题，响应式设计（手机/平板/电脑）。

## 功能特性

- **文本对话** — 支持 GPT 系列模型，多轮上下文记忆
- **图片生成** — 支持 gpt-image-2，5 种宽高比选择（1:1 / 4:3 / 3:4 / 16:9 / 9:16）
- **暗色/亮色主题** — 一键切换，自动跟随系统偏好
- **响应式设计** — 完美适配手机、平板、电脑
- **用户审批机制** — 新注册用户需管理员审批
- **管理后台** — 用户管理、审批、编辑、禁用

## 技术栈

- **框架**: Next.js 16 (App Router, standalone 输出模式)
- **数据库**: SQLite (Prisma ORM)
- **AI 接口**: OpenAI 兼容 API
- **认证**: 自建 session-based 认证 (bcryptjs)
- **UI**: Tailwind CSS 3, @tailwindcss/typography, react-markdown
- **部署**: Docker

## 页面路由

| 路径 | 说明 |
|------|------|
| `/` | 首页（重定向到聊天） |
| `/login` | 登录 |
| `/register` | 注册 |
| `/chat` | 聊天界面 |
| `/admin/users` | 管理员用户管理 |

## 环境变量

见 `.env.example`，关键变量：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | AI 接口密钥 |
| `OPENAI_BASE_URL` | AI 接口地址 |
| `SESSION_SECRET` | Session 加密密钥 (≥32字符) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 管理员初始账号 |
| `DATABASE_URL` | SQLite 数据库路径 |
| `DEFAULT_CHAT_MODEL` | 默认聊天模型 |
| `DEFAULT_IMAGE_MODEL` | 默认图片模型 |
| `ALLOWED_CHAT_MODELS` | 允许的聊天模型 (逗号分隔) |
| `ALLOWED_IMAGE_MODELS` | 允许的图片模型 (逗号分隔) |

## 本地开发

```bash
# 安装依赖
npm install

# 初始化数据库
DATABASE_URL="file:./data/dev.db" npx prisma db push
DATABASE_URL="file:./data/dev.db" ADMIN_EMAIL="admin@test.com" ADMIN_PASSWORD="Admin123456" npx tsx prisma/seed.ts

# 启动开发服务器
DATABASE_URL="file:./data/dev.db" SESSION_SECRET="your-secret-key-at-least-32-characters-long" \
OPENAI_API_KEY="sk-xxx" OPENAI_BASE_URL="http://localhost:9999/v1" \
npm run dev
```

## Docker 部署

```bash
# 创建 .env 文件
cp .env.example .env
# 编辑 .env 填入配置

# 构建并启动
docker compose build
docker compose up -d

# 查看日志
docker logs -f chatui
```

### Nginx 反代

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 600s;
}
```

## 常用命令

```bash
# 停止
docker compose down

# 更新构建
docker compose build --no-cache && docker compose up -d

# 备份数据
tar -czf backup-$(date +%F).tar.gz data
```

## License

MIT
