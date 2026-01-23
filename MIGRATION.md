# Cloudflare Workers to SAP BTP Migration Guide

## Overview

This document describes the migration from Cloudflare Workers (D1/SQLite) to SAP BTP (PostgreSQL).

## Key Changes

### 1. Database Layer

**From (SQLite/D1):**
- `drizzle-orm/d1` driver
- `sqliteTable` with `text` and `integer` columns
- JSON stored as text strings
- Booleans stored as `0/1` integers

**To (PostgreSQL):**
- `drizzle-orm/node-postgres` driver
- `pgTable` with `text`, `bigint`, `boolean`, and `jsonb` columns
- JSON stored as native `jsonb` type
- Booleans stored as native `boolean` type

### 2. Schema Changes

See `worker/db/schema.ts` for the updated PostgreSQL schema:

```typescript
// Before (SQLite)
isMilestone: integer('is_milestone').notNull().default(0),
predecessors: text('predecessors'),

// After (PostgreSQL)
isMilestone: boolean('is_milestone').notNull().default(false),
predecessors: jsonb('predecessors').$type<string[]>(),
```

### 3. Application Entry Points

**Cloudflare Workers:** `worker/index.ts`
- Uses D1 database binding
- Runs on Cloudflare Workers runtime

**SAP BTP:** `src/server.ts`
- Uses PostgreSQL connection via `DATABASE_URL`
- Runs on Node.js runtime
- Compatible with SAP BTP Cloud Foundry

### 4. Build Scripts

```bash
# Development (local with PostgreSQL)
npm run dev:server

# Production build
npm run build:prod

# Production start
npm run start:prod
```

## Migration Steps

### 1. Database Migration

#### Step 1: Generate PostgreSQL Migration

```bash
# Uses the updated drizzle.config.ts (configured for PostgreSQL)
npm run db:generate
```

#### Step 2: Export Data from D1

Use the Cloudflare Dashboard or Wrangler to export your D1 data:

```bash
wrangler d1 exports <DATABASE_NAME> --output=export.json
```

#### Step 3: Transform Data

Convert the exported data to PostgreSQL format:
- JSON fields: Parse text strings → JSON objects
- Boolean fields: Convert `0/1` → `false/true`

#### Step 4: Import to PostgreSQL

```bash
psql $DATABASE_URL < migrations/pg/0001_init.sql
psql $DATABASE_URL < transformed_data.sql
```

### 2. Deploy to SAP BTP

#### Step 1: Create PostgreSQL Service

```bash
cf create-service postgresql db-small flowsync-postgres-db
```

#### Step 2: Bind Service to Application

The service binding is already configured in `manifest.yml`:
```yaml
services:
  - flowsync-postgres-db
```

#### Step 3: Deploy

```bash
cf push
```

### 3. Environment Variables

Ensure the following environment variables are set in SAP BTP:

- `DATABASE_URL`: Automatically injected by service binding
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_BASE_URL`: (Optional) Custom OpenAI endpoint
- `OPENAI_MODEL`: (Optional) Model to use
- `NODE_ENV`: Set to `production`

## Verification

### 1. Health Check

```bash
curl https://your-app-url.cfapps.<region>.hana.ondemand.com/api/projects
```

### 2. Run Tests

```bash
npm run test:run
```

### 3. Data Validation

- Verify row counts match between D1 and PostgreSQL
- Check key fields (projects, tasks, drafts)
- Test JSON fields (predecessors, actions, payload)
- Verify boolean fields (isMilestone)

## Rollback

If issues occur, you can:

1. Keep Cloudflare Workers deployment as a fallback
2. Route traffic back to Workers using SAP BTP routing
3. Fix issues and redeploy to BTP

## Code Changes Summary

### Modified Files

- `worker/db/schema.ts` - PostgreSQL schema
- `worker/db/pg.ts` - New PostgreSQL connection
- `worker/services/utils.ts` - Removed `toSqlBoolean`
- `worker/services/serializers.ts` - Updated for boolean/jsonb
- `worker/services/taskService.ts` - Removed `toSqlBoolean` and `JSON.stringify`
- `worker/services/draftService.ts` - Removed `JSON.stringify/parse`
- `worker/services/auditService.ts` - Removed `JSON.stringify/parse`
- `worker/services/logService.ts` - Removed `JSON.stringify`
- `worker/app.ts` - Extracted Hono app creation
- `src/server.ts` - New Node.js entry point for BTP

### New Files

- `manifest.yml` - SAP BTP deployment manifest
- `tsconfig.server.json` - TypeScript config for server
- `.env.example` - Environment variable template

## Support

For issues or questions, refer to:
- [SAP BTP Documentation](https://help.sap.com/viewer/product/SAP_BTP/Cloud/en-US)
- [Drizzle ORM PostgreSQL Guide](https://orm.drizzle.team/docs/postgresql)
- [Cloud Foundry Node.js Buildpack](https://github.com/cloudfoundry/nodejs-buildpack)
