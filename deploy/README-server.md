# ChatUI 服务器部署（拉取镜像模式）

适用于新服务器快速部署，以及现有阿里云服务器的运维。镜像由 GitHub Actions 自动构建发布，**服务器无需编译能力**。

---

## 新服务器部署（3 步，约 2 分钟）

### 前置要求
- Docker 20.10+
- Docker Compose v2（`docker compose version` 能正常输出）
- 512MB+ 内存

### 步骤

```bash
# 1. 准备目录与配置
mkdir -p /opt/chatui && cd /opt/chatui

curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/jiasongji/ChatUI/main/deploy/docker-compose.yml
curl -fsSL -o .env.example \
  https://raw.githubusercontent.com/jiasongji/ChatUI/main/deploy/.env.example

cp .env.example .env

# 2. 填写必填配置（SESSION_SECRET / ADMIN_* / OPENAI_API_KEY）
nano .env
#   生成 session 密钥：openssl rand -hex 32

# 3. 启动（自动拉取镜像，无需编译）
docker compose up -d
```

访问 `http://<服务器IP>:3000`，用 `.env` 中的管理员账号登录。

> 如果 AI API（如 CLIProxyAPI）也在 Docker 中，编辑 `docker-compose.yml` 启用 `ai-net` 网络，并将 `OPENAI_BASE_URL` 设为 `http://cliproxyapi:8317/v1`。

---

## 现有阿里云服务器运维

服务器路径：`/www/wwwroot/chat.rcrc.eu.org/ChatUI`

> 阿里云服务器用专用配置文件 `docker-compose.server.yml`（端口 `30010:3000`，接入 `ai-net` 外部网络与 CPA 互联）。
> 注意：该服务器 Docker 26.1.4，需用**连字符版** `docker-compose`（`docker compose` 子命令不可用）。

```bash
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI
DC="docker-compose -f docker-compose.server.yml"

# 更新到最新版（秒级，自动拉取最新镜像）
$DC pull && $DC up -d

# 查看日志
docker logs -f chatui

# 重启
$DC restart

# 停止
$DC down
```

---

## Nginx 反向代理（必读）

AI 对话流式响应与图片生成耗时较长（图片生成 30-90 秒，复杂场景 5 分钟），反代**必须调大超时并关闭缓冲**，否则频繁 502/504：

```nginx
server {
    listen 443 ssl;
    server_name chat.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;   # 阿里云服务器为 30010
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # ⚠️ 三项必须配置
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_buffering off;
    }
}
```

> 图片生成总是 502？99% 是 `proxy_read_timeout` 太短，改为 `600s`。

---

## 数据持久化与备份

```bash
# 备份（数据库 + 上传文件）
tar czf chatui-backup-$(date +%F).tar.gz data/

# 恢复
tar xzf chatui-backup-2026-05-15.tar.gz
```

数据存储在 `./data/`：
```
data/
├── prod.db          # SQLite（用户、会话、消息、配置）
└── uploads/         # 上传文件
```

---

## 版本发布流程（开发者）

```bash
# 1. 代码合并到 main → GitHub Actions 自动构建发布 jiasongji/chatui:latest（约 5-8 分钟）
# 2. 服务器执行 docker compose pull && up -d 更新

# 打正式版本标签（可选）：
git tag v1.2.0
git push origin v1.2.0
# → 自动额外发布 jiasongji/chatui:1.2.0 / 1.2 / 1
```
