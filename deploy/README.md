# ChatUI 部署指南

一条命令部署到任意服务器。

## 快速开始

### 1. 准备

```bash
mkdir chatui && cd chatui
curl -O https://raw.githubusercontent.com/jiasongji/ChatUI/main/deploy/docker-compose.yml
curl -O https://raw.githubusercontent.com/jiasongji/ChatUI/main/deploy/.env.example
cp .env.example .env
```

### 2. 配置

编辑 `.env`，**必填项**：

```bash
SESSION_SECRET=            # openssl rand -hex 32 生成
ADMIN_EMAIL=               # admin@example.com
ADMIN_PASSWORD=            # 你的安全密码
OPENAI_API_KEY=            # sk-xxx
OPENAI_BASE_URL=           # https://api.openai.com/v1（或你的代理地址）
```

### 3. 启动

```bash
docker compose up -d
```

访问 `http://localhost:3000`，使用管理员账号登录。

## 配置参考

### 必填变量

| 变量 | 说明 |
|------|------|
| `SESSION_SECRET` | Session 加密密钥（`openssl rand -hex 32`） |
| `ADMIN_EMAIL` | 管理员邮箱（首次启动自动创建） |
| `ADMIN_PASSWORD` | 管理员密码 |
| `OPENAI_API_KEY` | OpenAI 兼容 API 密钥 |

### 可选变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API 接口地址 |
| `APP_NAME` | `ChatUI` | 应用名称 |
| `APP_URL` | `http://localhost:3000` | 应用公网地址 |
| `DEFAULT_CHAT_MODEL` | `gpt-5.4-mini` | 默认聊天模型 |
| `DEFAULT_IMAGE_MODEL` | `gpt-image-2` | 默认图片模型 |
| `ALLOWED_CHAT_MODELS` | `gpt-5.4-mini,gpt-5.4,gpt-5.5` | 可用聊天模型（逗号分隔） |
| `ALLOWED_IMAGE_MODELS` | `gpt-image-2` | 可用图片模型（逗号分隔） |
| `DATABASE_URL` | `file:/app/data/prod.db` | SQLite 数据库路径 |

### AI 接口提供商

| 提供商 | `OPENAI_BASE_URL` |
|--------|-------------------|
| OpenAI 官方 | `https://api.openai.com/v1` |
| Azure OpenAI | `https://<resource>.openai.azure.com/...` |
| Ollama（本地） | `http://localhost:11434/v1` |
| 同机 Docker 容器 | `http://<容器名或127.0.0.1>:<端口>/v1`（host 网络用 127.0.0.1） |
| 自建代理 | 你的接口地址 |

## 运维命令

```bash
docker logs -f chatui                         # 查看日志
docker compose pull && docker compose up -d   # 更新版本
docker compose down                            # 停止服务
tar czf backup-$(date +%F).tar.gz data/       # 备份数据
```

## Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name chat.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_buffering off;
    }
}
```

## Docker 网络配置（可选）

默认部署（`ports: 3000:3000`）无需特殊网络配置。若 AI 提供商是同主机的另一个容器：

- **host 网络（最省心）**：`network_mode: host`，`OPENAI_BASE_URL` 用 `http://127.0.0.1:<端口>/v1`。
  适合服务器开了 UFW / Docker `iptables:false` 导致 bridge 出站受限的环境。
- **共享网络**：两容器接入同一自定义网络，用容器名访问：

```yaml
services:
  chatui:
    image: jiasongji/chatui:latest
    environment:
      - OPENAI_BASE_URL=http://<ai容器名>:<端口>/v1
    networks: [shared]
networks:
  shared:
    external: true
```

## 系统要求

- Docker 20.10+
- Docker Compose V2
- 512MB+ 内存
