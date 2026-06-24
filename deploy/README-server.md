# ChatUI 服务器部署（拉取镜像模式）

适用于新服务器快速部署，以及现有服务器的运维。镜像由 GitHub Actions 自动构建发布，**服务器无需编译能力**。

---

## 新服务器部署（3 步，约 2 分钟）

### 前置要求
- Docker 20.10+
- Docker Compose（连字符版 `docker-compose` 或子命令 `docker compose`，二者其一可用即可）
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
docker compose up -d      # 或 docker-compose up -d
```

访问 `http://<服务器IP>:3000`，用 `.env` 中的管理员账号登录。

> 上游 AI API（OpenAI 兼容）地址在 `OPENAI_BASE_URL` 配置；若 AI 提供商是同主机的另一个容器，
> 可改用容器名/内网地址。生产环境推荐 AI 提供商走公网 HTTPS。

---

## 生产服务器运维（host 网络模式）

生产服务器路径：`/www/wwwroot/chat.rcrc.eu.org/ChatUI`，用专用配置 `docker-compose.server.yml`。

**网络模式：host。** 应用通过 `PORT=30010` 直接监听宿主机 30010，Nginx 反代到 `127.0.0.1:30010`。
> 选用 host 网络是为了绕开本机 Docker `daemon.json` 的 `"iptables": false`：该设置下 Docker 不为
> 新建 bridge 网络生成出站规则，bridge 容器无法访问公网（曾导致 API 超时）。host 模式直接用宿主机
> 网络栈出站，彻底规避。详见 `OPS.md` 第十二节「API 超时专项」。

> 注意：该服务器 Docker 26.1.4，仅支持**连字符版** `docker-compose`（v2.27.1），`docker compose` 子命令不可用。

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
        proxy_pass http://127.0.0.1:3000;   # 默认部署为 3000；生产 host 模式为 30010
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
