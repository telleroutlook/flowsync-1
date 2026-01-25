# [ARCHIVED] Cloudflare Workers to SAP BTP Migration Plan

> **Status**: Completed on 2026-01-23. The codebase has been fully migrated to Node.js/PostgreSQL. This document is preserved for historical context.

## 1. Current Code Snapshot

Key points consistent with the current repository structure:

- **Backend Entry**: `worker/index.ts`
  - Hono app created directly in this file
  - `Bindings` includes `DB: D1Database` and `OPENAI_*`
  - `app.use('*')` calls `getDb(c.env.DB)` + `ensureSeedData(db)`
- **Database Layer**:
  - `worker/db/index.ts` uses `drizzle-orm/d1`
  - `worker/db/schema.ts` uses `sqliteTable`, timestamps stored as `integer` (ms), booleans as `0/1`
  - `predecessors`, `actions`, `before/after`, `payload` etc. are **JSON strings**
- **Serialization Logic**:
  - `worker/services/serializers.ts` assumes `isMilestone` is `0/1`
  - `worker/services/utils.ts` provides `toSqlBoolean`
- **Scripts**:
  - `package.json` only has `dev:worker` / `deploy` (Wrangler)
  - No Node server build / start

This means migration must explicitly handle: DB types, JSON fields, and entry point startup.

---

## 2. Migration Goals & Decisions (Best General Path)

### Selected General Route
- **Timestamps remain epoch ms**
  - Postgres uses `bigint` (`mode: 'number'`)
  - Maintain consistency between frontend/backend and service logic to avoid full-link date conversion
- **Boolean fields changed to `boolean`**
  - Completely remove `toSqlBoolean`
- **Structured fields unified to `jsonb`**
  - `tasks.predecessors`
  - `drafts.actions`
  - `audit_logs.before / audit_logs.after`
  - `observability_logs.payload`

> This route is the most robust and general functionally: minimal impact on existing business logic while fully utilizing Postgres JSON capabilities.

---

## 3. Code Changes List (By File)

### A. Extract Hono App
**Goal**: Support both Worker and Node entry points.

Suggested Structure:
```
worker/app.ts        # Create app only, no D1 dependency
worker/index.ts      # Cloudflare entry (D1 binding)
src/server.ts        # Node entry (BTP)
```

- `worker/app.ts`: Only create and export `app`
- `worker/index.ts`: Keep `getDb(c.env.DB)` + `ensureSeedData`
- `src/server.ts`:
  - Use `process.env.DATABASE_URL` to create db
  - `c.set('db', db)`
  - Inject `c.env = process.env` to ensure `worker/routes/ai.ts` `c.env.OPENAI_*` works

**Suggestion**: `ensureSeedData` should not run on every request. Execute once at `server.ts` startup (or add global guard).

---

### B. Database Layer

#### `worker/db/schema.ts`
- Use `pgTable` instead of `sqliteTable`
- Timestamp fields changed to `bigint('xxx', { mode: 'number' })`
- `isMilestone` changed to `boolean`
- JSON fields changed to `jsonb`

Fields involved:
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
- Switch to `drizzle-orm/node-postgres`
- `Pool` gets from `process.env.DATABASE_URL`

---

### C. Business Services & Serialization

Files and modification points:
- `worker/services/utils.ts`
  - Delete `toSqlBoolean`
- `worker/services/serializers.ts`
  - `isMilestone` read directly as `boolean`
  - `predecessors` read directly as `string[]`
- `worker/services/taskService.ts`
  - `isMilestone` saved directly as `boolean`
  - `predecessors` saved directly as `string[]`
- `worker/services/draftService.ts`
  - `actions` field directly accesses object array (no more `JSON.stringify/parse`)
- `worker/services/auditService.ts`
  - `before/after` changed to jsonb, read/write pass objects directly
  - `rollback` `isMilestone` no longer converts to `0/1`
- `worker/services/logService.ts`
  - `payload` changed to jsonb
- Test files update synchronously:
  - `worker/services/utils.test.ts`
  - `worker/services/serializers.test.ts`
  - `worker/services/constraintService.test.ts`

---

## 4. Drizzle Config & Migration Files

Current `drizzle.config.ts` is for D1 (sqlite + d1-http). After migrating to Postgres:

- `dialect: 'postgresql'`
- `dbCredentials.connectionString = process.env.DATABASE_URL`
- **Suggest new migration directory** (e.g. `migrations/pg`)
- **Suggest new independent config** (e.g. `drizzle.config.pg.ts`) to avoid affecting existing D1 flow

---

## 5. Build & Start Scripts (Adjust based on existing package.json)

Suggest adding:

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

Also add `tsconfig.server.json`, outputting backend to `dist-server/` to avoid conflict with Vite's `dist/`.

---

## 6. BTP Deployment Config (`manifest.yml`)

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

**Database Connection**:
- BTP will inject `VCAP_SERVICES`
- Can use `cf-env` to parse, or set `DATABASE_URL` directly via User-Provided Service

---

## 7. Data Migration Steps (General Route)

1. **Export D1 Data** (JSON/CSV)
2. **Transform Structure**:
   - JSON fields from string -> JSON object
   - `isMilestone` from `0/1` -> `true/false`
3. **Import to Postgres**:
   - `predecessors/actions/before/after/payload` write as jsonb
4. **Validation**:
   - Row count alignment
   - Key fields diff

---

## 8. Migration Execution Steps (Combined with Current Code)

1. **Extract Hono App**: New `worker/app.ts`, split entry
2. **Introduce Node Entry**: New `src/server.ts`, inject `c.env` + `db`
3. **Schema Adjustment**: `worker/db/schema.ts` -> Postgres types + jsonb
4. **Service Logic Correction**: Remove `toSqlBoolean`, JSON fields to object
5. **Drizzle Config Update**: New Postgres migration
6. **Local Verification**: `npm run dev:server`
7. **Data Migration**: D1 -> Postgres
8. **BTP Deployment**: `cf push`

---

## 9. Verification & Rollback

### Verification
- `vitest` (Existing `worker/services` tests reusable)
- API Smoke Test: `/api/projects`, `/api/tasks`, `/api/drafts`
- Data Consistency: Row counts, key fields diff

### Rollback
- Retain Cloudflare Workers deployment as fallback
- If BTP deployment fails, switch back to old entry to restore service
