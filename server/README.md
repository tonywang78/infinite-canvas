# 平台服务端（cool-admin Midway）

PostgreSQL + cool-admin。业务模块：用户认证、积分账本、模型渠道/价目、生成代理、提示词同步、站点配置。

包管理与仓库前端一致，使用 **bun**。

## 本地启动

```bash
# 在仓库根目录或本目录
docker compose -f server/docker-compose.yml up -d
cd server
bun install
bun run dev
```

默认 API：`http://127.0.0.1:8001`  
默认库：`127.0.0.1:5433` / `infinite_canvas` / `postgres` / `123456`（映射到容器 5432，避免和本机 Postgres 抢端口）

首次启动会初始化管理员（cool-admin 默认账号见官方文档，通常为 `admin` / `123456`）。

## 边界默认值（可用环境变量覆盖）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `REGISTER_GIFT_POINTS` | 100 | 注册赠送积分 |
| `MAX_CONCURRENT_TASKS` | 3 | 单用户并发任务 |
| `MAX_UPLOAD_BYTES` | 20971520 | 上传上限约 20MB |
| `TASK_TIMEOUT_MS` | 600000 | 10 分钟超时退预扣 |
| `TEMP_FILE_TTL_HOURS` | 24 | 临时文件保留 |
| `SECRETS_MASTER_KEY` | 开发占位 | 渠道密钥加密主密钥，生产必须更换 |
