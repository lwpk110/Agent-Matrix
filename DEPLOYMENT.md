# 生产环境部署指南 (Production Deployment Guide)
## AI Agent Control Plane & Security Audit Gateway

本文档提供在生产服务器（Linux / Kubernetes / Docker / Systemd）上部署 **AI 智能体运行时控制平面与安全审计网关** 的完整操作方案。

---

## 1. 架构与端口规划 (Port Architecture)

| 服务名称 | 进程 / 技术栈 | 默认端口 | 协议 | 外部暴露 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Web 控制平面 HUD** | Vite / React SPA (Node.js) | `3000` | HTTP / WS | 是 (Nginx 反向代理) | 赛博朋克控制看板 |
| **安全审计网关** | Python FastAPI / Uvicorn | `7788` | HTTP / WebSocket | 仅内网 / 本地环回 | 接收 PreToolUse 并挂起阻断 |

---

## 2. Docker & Docker Compose 容器化部署

### 2.1 创建 `Dockerfile` (前端 Web HUD)
```dockerfile
# 阶段 1: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 阶段 2: 静态提供与运行
FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

### 2.2 创建 `docker-compose.yml`
```yaml
version: '3.8'

services:
  # 安全审计网关服务
  gateway:
    image: python:3.11-slim
    container_name: agent-control-gateway
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./gateway.py:/app/gateway.py:ro
    ports:
      - "127.0.0.1:7788:7788"
    command: >
      bash -c "pip install --no-cache-dir fastapi uvicorn websockets pydantic &&
               python3 gateway.py"
    environment:
      - PYTHONUNBUFFERED=1

  # Web 看板控制平面
  dashboard:
    build: .
    container_name: agent-control-hud
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      - gateway
```

启动命令：
```bash
docker compose up -d
docker compose logs -f
```

---

## 3. Linux Systemd 守护进程部署 (原生 Linux 主机)

若在生产开发机或 Jump Server 本地原生运行，可配置 Systemd 守护进程确保断开重启。

### 3.1 创建 `/etc/systemd/system/agent-gateway.service`
```ini
[Unit]
Description=AI Agent Security Audit Gateway (Port 7788)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/agent-control-plane
ExecStart=/usr/bin/python3 /opt/agent-control-plane/gateway.py
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

激活并启动网关守护进程：
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agent-gateway.service
sudo systemctl status agent-gateway.service
```

---

## 4. Nginx 反向代理配置 (支持 WebSocket 升级)

在公网或内网域名接入时，Nginx 需要配置正确的 `Upgrade` 头以支持双向 WebSocket 遥测通信：

```nginx
server {
    listen 80;
    server_name agent-matrix.internal.corp;

    # 1. 前端 Web HUD 静态代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 2. WebSocket 遥测与拦截总线代理
    location /ws {
        proxy_pass http://127.0.0.1:7788/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # 3. HTTP 钩子接口代理 (供 Claude Code 转发)
    location /hook/ {
        proxy_pass http://127.0.0.1:7788/hook/;
        proxy_set_header Host $host;
        proxy_read_timeout 180s;
    }
}
```

测试并重载 Nginx：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. 安全加固与不变量规则配置 (Security Hardening)

### 5.1 敏感文件模式匹配清单 (`gateway.py`)
在 `gateway.py` 中的 `SENSITIVE_PATTERNS` 维护团队白/黑名单规则：
```python
SENSITIVE_PATTERNS = [
    "auth.ts",                # 认证核心链路
    "k8s/prod-secrets.yaml",   # 生产集群 Secret
    "schema.prisma",          # 数据库迁移底表
    "migrations/",            # 数据库版本变更
    ".env",                   # 环境变量密钥
    "rm -rf",                 # 毁灭性删除命令
    "DROP TABLE",             # SQL 破坏性语句
    "eval(",                  # 动态代码执行
]
```

### 5.2 审计超时与默认拒绝原则 (Fail-Closed)
- 网关等待人工审批的默认超时时间为 `120s`。
- 一旦超时，网关自动返回 HTTP 408 并默认终止工具调用（**Fail-Closed 原则**），杜绝挂起导致的未经授权放行。

---

## 6. 健康检查与故障排查 (Troubleshooting)

### 6.1 测试网关健康状态
```bash
curl -i http://localhost:7788/docs
```
返回 HTTP 200 即代表 FastAPI 网关就绪。

### 6.2 模拟 Claude Code 触发审批阻断
```bash
curl -X POST http://localhost:7788/hook/pre \
  -H "Content-Type: application/json" \
  -d '{"tool": "FileEdit", "args": {"file": "src/auth/oauth2.ts"}}'
```
终端将输出 `[GATEWAY BLOCKED]`，此时网页端会瞬间唤出红黄色审批抽屉。在网页端点击【批准放行】后，此 curl 命令将立刻收到 HTTP 200 返回：
```json
{"status": "approved", "injectedPrompt": null}
```
