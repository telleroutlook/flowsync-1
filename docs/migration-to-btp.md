# Cloudflare Workers to SAP BTP Migration Plan (针对当前代码优化)

## 1. 现状快照 (Current Code Snapshot)

与当前仓库结构一致的关键点：

- **后端入口**: `worker/index.ts`
  - Hono app 直接在该文件创建
  - `Bindings` 包含 `DB: D1Database` 与 `OPENAI_*`
  - `app.use('*')` 中 `getDb(c.env.DB)` + `ensureSeedData(db)`
- **数据库层**:
  - `worker/db/index.ts` 使用 `drizzle-orm/d1`
  - `worker/db/schema.ts` 使用 `sqliteTable`，时间戳存 `integer` (ms)，布尔存 `0/1`
  - `predecessors`、`actions`、`before/after`、`payload` 等为 **JSON 字符串**
- **序列化逻辑**:
  - `worker/services/serializers.ts` 假设 `isMilestone` 为 `0/1`
  - `worker/services/utils.ts` 提供 `toSqlBoolean`
- **脚本**:
  - `package.json` 仅有 `dev:worker` / `deploy` (Wrangler)
  - 无 Node server build / start

这意味着迁移必须显式处理：DB 类型、JSON 字段、入口启动方式。

---

## 2. 迁移目标与决策 (Best General Path)

### 选择的通用路线
- **时间戳保持 epoch ms**
  - Postgres 使用 `bigint`（`mode: 'number'`）
  - 维持前后端与服务逻辑一致，避免全链路日期转换
- **布尔字段改为 `boolean`**
  - 彻底移除 `toSqlBoolean`
- **结构化字段统一改为 `jsonb`**
  - `tasks.predecessors`
  - `drafts.actions`
  - `audit_logs.before / audit_logs.after`
  - `observability_logs.payload`

> 这条路线在功能上最稳健、最通用：对现有业务逻辑影响最小，同时充分利用 Postgres 的 JSON 能力。

---

## 3. 代码改动清单（按文件）

### A. Hono 入口抽离
**目标**: 同时支持 Worker 与 Node 两个入口。

建议结构：
```
worker/app.ts        # 仅创建 app，不依赖 D1
worker/index.ts      # Cloudflare entry (D1 绑定)
src/server.ts        # Node entry (BTP)
```

- `worker/app.ts`: 只创建并导出 `app`
- `worker/index.ts`: 保留 `getDb(c.env.DB)` + `ensureSeedData`
- `src/server.ts`:
  - 使用 `process.env.DATABASE_URL` 创建 db
  - `c.set('db', db)`
  - 注入 `c.env = process.env`，确保 `worker/routes/ai.ts` 的 `c.env.OPENAI_*` 可用

**建议**：`ensureSeedData` 不要每个请求运行。可在 `server.ts` 启动时执行一次（或加全局 guard）。

---

### B. 数据库层

#### `worker/db/schema.ts`
- 使用 `pgTable` 替代 `sqliteTable`
- 时间戳字段改为 `bigint('xxx', { mode: 'number' })`
- `isMilestone` 改为 `boolean`
- JSON 字段改为 `jsonb`

涉及字段：
- `projects.createdAt / updatedAt`
- `tasks.createdAt / startDate / dueDate / updatedAt`
- `drafts.createdAt`
- `auditLogs.timestamp`
- `observabilityLogs.createdAt`
- `tasks.predecessors`
- `drafts.actions`
- `auditLogs.before / auditLogs.after`
- `observabilityLogs.payload`

#### `worker/db/index.ts`
- 切换为 `drizzle-orm/node-postgres`
- `Pool` 从 `process.env.DATABASE_URL` 获取

---

### C. 业务服务与序列化

涉及文件与修改点：
- `worker/services/utils.ts`
  - 删除 `toSqlBoolean`
- `worker/services/serializers.ts`
  - `isMilestone` 直接读取 `boolean`
  - `predecessors` 直接读取 `string[]`
- `worker/services/taskService.ts`
  - `isMilestone` 直接保存 `boolean`
  - `predecessors` 直接保存 `string[]`
- `worker/services/draftService.ts`
  - `actions` 字段直接存取对象数组（不再 `JSON.stringify/parse`）
- `worker/services/auditService.ts`
  - `before/after` 改为 jsonb，读写直接传对象
  - `rollback` 中 `isMilestone` 不再转 `0/1`
- `worker/services/logService.ts`
  - `payload` 改为 jsonb
- 测试文件同步更新：
  - `worker/services/utils.test.ts`
  - `worker/services/serializers.test.ts`
  - `worker/services/constraintService.test.ts`

---

## 4. Drizzle 配置与迁移文件

当前 `drizzle.config.ts` 为 D1（sqlite + d1-http）。迁移到 Postgres 后：

- `dialect: 'postgresql'`
- `dbCredentials.connectionString = process.env.DATABASE_URL`
- **建议新建迁移目录**（如 `migrations/pg`）
- **建议新增独立 config**（如 `drizzle.config.pg.ts`），避免影响现有 D1 流程

---

## 5. 构建与启动脚本（按现有 package.json 调整）

建议新增：

```json
"scripts": {
  "dev": "vite",
  "dev:worker": "wrangler dev",
  "dev:server": "tsx watch src/server.ts",
  "build:server": "tsc -p tsconfig.server.json",
  "build": "npm run build:server && vite build",
  "start:prod": "node dist-server/server.js"
}
```

同时新增 `tsconfig.server.json`，将后端输出到 `dist-server/`，避免与 Vite 的 `dist/` 冲突。

---

## 6. BTP 部署配置 (`manifest.yml`)

```yaml
---
applications:
  - name: flowsync-ai
    memory: 512M
    disk_quota: 1024M
    buildpacks:
      - nodejs_buildpack
    command: npm run start:prod
    services:
      - flowsync-postgres-db
    env:
      NODE_ENV: production
```

**数据库连接**:
- BTP 会注入 `VCAP_SERVICES`
- 可用 `cf-env` 解析，或通过 User-Provided Service 直接设置 `DATABASE_URL`

---

## 7. 数据迁移步骤（通用路线）

1. **导出 D1 数据**（JSON/CSV 均可）
2. **转换结构**：
   - JSON 字段从字符串 -> JSON 对象
   - `isMilestone` 从 `0/1` -> `true/false`
3. **导入 Postgres**：
   - `predecessors/actions/before/after/payload` 以 jsonb 方式写入
4. **校验**：
   - 行数对齐
   - 关键字段 diff

---

## 8. 迁移执行步骤（结合当前代码）

1. **抽离 Hono app**: 新增 `worker/app.ts`，拆分入口
2. **引入 Node entry**: 新增 `src/server.ts`，注入 `c.env` + `db`
3. **Schema 调整**: `worker/db/schema.ts` -> Postgres 类型 + jsonb
4. **服务逻辑修正**: 去掉 `toSqlBoolean`，JSON 字段改为对象
5. **Drizzle 配置更新**: 新增 Postgres migration
6. **本地验证**: `npm run dev:server`
7. **数据迁移**: D1 -> Postgres
8. **BTP 部署**: `cf push`

---

## 9. 验证与回滚

### 验证
- `vitest` (已有 `worker/services` 测试可复用)
- API 冒烟测试：`/api/projects`、`/api/tasks`、`/api/drafts`
- 数据一致性：行数、关键字段 diff

### 回滚
- 保留 Cloudflare Workers 部署作为回退
- BTP 部署失败时切回旧入口即可恢复服务
