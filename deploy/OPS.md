# ChatUI 运维手册（腾讯云香港服务器 / 宝塔面板）

> 本文档面向 `/www/wwwroot/chat.rcrc.eu.org/ChatUI` 部署目录的部署、升级、卸载清理操作。
> 镜像采用「拉取预构建」模式，**服务器无需编译**。

---

## 一、架构概览

```
宝塔 Nginx (443/https://chat.rcrc.eu.org)
        │ proxy_pass http://127.0.0.1:30010
        ▼
┌─────────────────────────────────┐
│  chatui 容器 (jiasongji/chatui) │  host 网络，PORT=30010 直监听宿主机 30010
│  - network_mode: host           │
│  - 数据卷 ./data:/app/data       │
└─────────────────────────────────┘
        │ HTTPS（公网，非容器互联）
        ▼
   CPA 上游 https://cpa.rcrc.eu.org/v1
   （openai_base_url 存于数据库 ApiConfig 表，优先级高于 .env）
```

**关键事实**：
- ChatUI 跑在 **host 网络**（`network_mode: host`），应用通过 `PORT=30010` 直接监听宿主机 30010。
- **为什么用 host 网络**：本机 Docker `daemon.json` 设了 `"iptables": false`（配合 UFW 防火墙），
  Docker 不为新建 bridge 网络生成出站 NAT/转发规则，导致 bridge 容器无法访问公网（CPA 超时）。
  host 模式直接复用宿主机网络栈出站，彻底绕开该问题。**所有需要出站公网的容器都应用 host 网络。**
- AI 上游地址以 **数据库 `ApiConfig` 表** 为准（当前 `https://cpa.rcrc.eu.org/v1`），
  `.env` 里的 `OPENAI_BASE_URL` 仅作 fallback。CPA 不在本机，**不可**用 `http://cliproxyapi:8317/v1`。
- 宝塔 Nginx 反代到 `127.0.0.1:30010`。

---

## 二、目录结构（清理后的可移植最小集）

```
/www/wwwroot/chat.rcrc.eu.org/ChatUI/
├── docker-compose.server.yml   # 唯一部署编排文件
├── .env                        # 实际配置（含密钥，勿外传）
├── .env.example                # 配置模板
├── data/                       # 持久化数据（迁移时务必带走）
│   ├── prod.db                 # SQLite（用户/会话/消息/ApiConfig）
│   └── uploads/                # 上传文件
└── OPS.md                      # 本文档
```

> **可移植性**：把上面这些文件原样打包，复制到另一台服务器的相同路径
> `/www/wwwroot/chat.rcrc.eu.org/ChatUI/`，执行 `docker-compose -f docker-compose.server.yml up -d`
> 即可直接启动（镜像会自动拉取，数据库/上传文件原样可用）。
> 不需要源码、Dockerfile、node_modules、.next。

---

## 三、首次部署

```bash
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI

# 1. 准备 .env（从模板复制后修改必填项）
cp .env.example .env
nano .env
#   必填：SESSION_SECRET（openssl rand -hex 32）/ ADMIN_EMAIL / ADMIN_PASSWORD / OPENAI_API_KEY

# 2. 启动（自动拉取 jiasongji/chatui:latest，无需编译）
docker-compose -f docker-compose.server.yml up -d

# 3. 验证
docker ps | grep chatui                              # 应为 healthy
curl -I http://127.0.0.1:30010/api/auth/me          # HTTP 401 为正常（未登录）
```

> 注意：本服务器 Docker 26.1.4，仅支持**连字符版** `docker-compose`（v2.27.1），`docker compose` 子命令不可用。

---

## 四、升级（拉取最新镜像，秒级）

镜像由 GitHub Actions 自动构建：`push main` → 发布 `jiasongji/chatui:latest`（约 5-9 分钟）。

```bash
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI

# 一行升级（先备份再拉取更新）
tar czf /tmp/chatui-data-backup-$(date +%F-%H%M).tar.gz data/   # 备份数据
docker-compose -f docker-compose.server.yml pull                # 拉取最新镜像
docker-compose -f docker-compose.server.yml up -d               # 重建容器（数据不丢）
docker logs -f chatui                                            # 观察启动
```

数据卷 `./data` 不会被 `up -d` 清空，**用户/会话/上传文件全部保留**。

---

## 五、卸载 / 清理

### 5.1 完全卸载（容器 + 镜像 + 目录）

```bash
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI

# 1. 停止并删除容器
docker-compose -f docker-compose.server.yml down

# 2. 删除镜像（可选，释放 ~790MB）
docker rmi jiasongji/chatui:latest

# 3. 删除部署目录（⚠️ 含数据库，删前务必备份/导出）
cd /www/wwwroot/chat.rcrc.eu.org
tar czf /root/chatui-full-backup-$(date +%F).tar.gz ChatUI/    # 备份
rm -rf ChatUI/
```

### 5.2 仅清理残留（保留运行中的服务）

```bash
# 清理悬挂镜像（升级后旧层）
docker image prune -f

# 清理 macOS AppleDouble 垃圾文件（._*）和 .DS_Store（若有）
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI
find . -name '._*' -delete
find . -name '.DS_Store' -delete
```

---

## 六、宝塔 Nginx 反向代理（必读注意事项）

站点：`chat.rcrc.eu.org`，反代到 `http://127.0.0.1:30010`。
配置位置：`/www/server/panel/vhost/nginx/proxy/chat.rcrc.eu.org/`

### 6.1 必须配置的三项（否则 AI 功能 502/504）

AI 流式对话与图片生成耗时长（图片 30-90 秒，复杂场景 5 分钟）。Nginx 默认 60s 超时会直接 502。

```nginx
location / {
    proxy_pass http://127.0.0.1:30010;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # ⚠️ 这三项缺一不可
    proxy_read_timeout 600s;     # 读超时调大（默认 60s 会 502）
    proxy_send_timeout 600s;     # 发送超时同步调大
    proxy_buffering off;         # 关闭缓冲，否则流式响应会等完整才返回
}
```

> **常见问题**：图片生成总是 502？99% 是 `proxy_read_timeout` 太短，改 `600s` 即可。

### 6.2 WebSocket 支持

ChatUI 当前为 HTTP 短/长连接 + 流式响应（SSE 风格），`proxy_buffering off` 已足够。
若启用 WS 功能，需额外加：
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### 6.3 宝塔操作步骤

1. 宝塔面板 → 网站 → 找到 `chat.rcrc.eu.org` → 设置 → 反向代理
2. 添加反代：目标 `http://127.0.0.1:30010`
3. **进入配置文件**，在 `location /` 内手动补上上面的三个超时/缓冲参数
4. 保存并重载 Nginx（宝塔会自动 `nginx -t && reload`）

### 6.4 SSL

宝塔站点 → SSL → 申请/续签 Let's Encrypt，强制 HTTPS。
容器不感知 SSL，由 Nginx 终结 TLS 后用 HTTP 转给容器。

---

## 七、数据备份与迁移

```bash
# 备份（数据库 + 上传文件）
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI
tar czf /root/chatui-backup-$(date +%F).tar.gz data/

# 恢复
tar xzf /root/chatui-backup-YYYY-MM-DD.tar.gz
docker-compose -f docker-compose.server.yml restart
```

### 迁移到新服务器（同路径即用）

```bash
# 源服务器打包
cd /www/wwwroot/chat.rcrc.eu.org
tar czf chatui-migrate.tar.gz \
  ChatUI/docker-compose.server.yml \
  ChatUI/.env ChatUI/.env.example ChatUI/OPS.md \
  ChatUI/data/

# 传到新服务器相同路径
scp chatui-migrate.tar.gz newserver:/www/wwwroot/chat.rcrc.eu.org/
ssh newserver 'cd /www/wwwroot/chat.rcrc.eu.org && tar xzf chatui-migrate.tar.gz && \
  cd ChatUI && docker-compose -f docker-compose.server.yml up -d'
```

---

## 八、修改 AI 配置（API Key / Base URL / 模型）

**优先**：管理后台 `/admin/api-config` 修改（保存即时生效，自动失效缓存）。

手动方式（改数据库）：
```bash
docker exec chatui sqlite3 /app/data/prod.db \
  "UPDATE ApiConfig SET value='新值' WHERE key='openai_base_url';"
docker-compose -f docker-compose.server.yml restart
```

配置优先级：**数据库 ApiConfig 表 > .env 环境变量 > 代码默认值**。

---

## 九、常用运维命令速查

```bash
cd /www/wwwroot/chat.rcrc.eu.org/ChatUI

docker-compose -f docker-compose.server.yml up -d        # 启动
docker-compose -f docker-compose.server.yml down          # 停止
docker-compose -f docker-compose.server.yml restart       # 重启
docker-compose -f docker-compose.server.yml pull && \
docker-compose -f docker-compose.server.yml up -d         # 升级
docker-compose -f docker-compose.server.yml logs -f       # 日志
docker ps | grep chatui                                   # 状态
docker exec -it chatui sh                                 # 进容器调试
```

---

## 十、自动更新策略（手动，未启用 Watchtower）

**当前决策：不部署 Watchtower，采用手动更新。** 理由：掌控升级时机、避免业务高峰意外重启。

- 镜像 `jiasongji/chatui:latest` 随每次 `push main` 自动发布到 Docker Hub（GitHub Actions）。
- `docker-compose.server.yml` 中 `pull_policy: always` 仅在执行 `up`/`pull` 时拉取，**不会主动轮询**，安全。
- 升级走第四节流程（`pull && up -d`）。

> 如未来需要自动更新，可单独部署 Watchtower 容器（仅监控 chatui），示例：
> ```yaml
> # /www/wwwroot/chat.rcrc.eu.org/watchtower/docker-compose.yml
> services:
>   watchtower:
>     image: containrrr/watchtower
>     container_name: watchtower
>     restart: unless-stopped
>     volumes: ["/var/run/docker.sock:/var/run/docker.sock"]
>     command: --interval 43200 --cleanup chatui   # 12h 检查，仅 chatui
> ```

---

## 十一、Docker Hub Access Token 轮换计划

CI/CD 推送镜像用的 Docker Hub Token（`github-actions-chatui`，配置在 GitHub repo Secrets）需要定期轮换以降低泄露风险。

### 凭证清单

| 凭证 | 位置 | 用途 |
|------|------|------|
| `DOCKERHUB_USERNAME` = `jiasongji` | GitHub repo Secrets | CI 登录用户名 |
| `DOCKERHUB_TOKEN` = `dckr_pat_...` | GitHub repo Secrets | CI 推送镜像的 Access Token |

### 轮换周期

- **常规**：每 90 天轮换一次。
- **强制**：Token 疑似泄露、人员变动、CI 报 401/403 时立即轮换。

### 轮换步骤

1. **创建新 Token**：https://hub.docker.com/settings/security → New Access Token
   - Description：`github-actions-chatui-YYYYMM`（如 `github-actions-chatui-202609`）
   - Permissions：**Read, Write, Delete**
2. **更新 GitHub Secret**：
   ```bash
   # 本地 gh CLI 已认证，直接更新（替换 <新token>）
   printf '%s' "<新token>" | gh secret set DOCKERHUB_TOKEN -R jiasongji/ChatUI
   ```
3. **验证**：触发一次构建确认能推送
   ```bash
   gh workflow run docker-publish.yml -R jiasongji/ChatUI   # 手动触发
   gh run watch -R jiasongji/ChatUI                          # 观察结果
   ```
4. **删除旧 Token**：回 Docker Hub → 删除上一个 `github-actions-chatui-*` Token。

### 轮换记录

| 日期 | Token 描述 | 操作人 | 备注 |
|------|-----------|--------|------|
| 2026-06-24 | `github-actions-chatui` | 自动化 | 首次创建（本次部署） |

> 下次轮换到期日：**2026-09-22**

---

## 十二、故障排查

| 现象 | 排查 |
|------|------|
| 容器 unhealthy / 起不来 | `docker logs chatui`；检查 `.env` 必填项、`data/` 权限；host 模式下确认 30010 未被占用 |
| **API 超时 / 后台登录超时** | **见下方「API 超时专项」**——多半是容器出站网络问题 |
| AI 对话报错 | 查日志；确认上游 `https://cpa.rcrc.eu.org/v1` 可达；后台 `/admin/api-config` 测试连接 |
| 图片生成 502 | 99% 是 Nginx `proxy_read_timeout` < 600s（见第六节） |
| 升级后数据丢失 | 不应发生；`./data` 是挂载卷。检查 `docker-compose.server.yml` 的 volumes 行 |
| 容器名冲突无法启动 | `docker rm -f chatui` 后重新 `up -d` |

### API 超时专项（容器出站网络）

**症状**：前端 API 接口一直超时、后台登录也超时，但接口配置本身没问题。

**首选诊断**（对比宿主机 vs 容器出站）：
```bash
# 宿主机能通 CPA 吗？（正常应返回 HTTP 401，没带 key）
curl -sS -m 10 -o /dev/null -w 'host->CPA: HTTP %{http_code}\n' https://cpa.rcrc.eu.org/v1/models

# 容器能通 CPA 吗？
docker exec chatui curl -sS -m 10 -o /dev/null -w 'container->CPA: HTTP %{http_code}\n' https://cpa.rcrc.eu.org/v1/models
```

- 宿主机通、容器不通 → **容器出站网络问题**（本机最常见根因）。
- 两者都不通 → CPA 上游或 DNS 问题，检查 `getent hosts cpa.rcrc.eu.org` 和 CPA 服务本身。

**根因（本机）**：`/etc/docker/daemon.json` 设了 `"iptables": false`，Docker 不为新建 bridge 网络生成
出站 NAT/转发规则，bridge 容器无法访问公网。

**根治**：用 **host 网络**（`docker-compose.server.yml` 已配置 `network_mode: host` + `PORT=30010`），
容器直接复用宿主机网络栈，绕开 bridge iptables 问题。**切勿改回 bridge + 端口映射**，否则会复发。

