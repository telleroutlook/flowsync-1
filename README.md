<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FlowSync AI Studio App

FlowSync is a data-driven project management app with a Node.js (Hono) backend,
PostgreSQL persistence via Drizzle, and a React/Vite frontend. The backend supports draft-first
changes, audit logging, and rollback via audit snapshots.

**Deployment Platform:** SAP BTP (Cloud Foundry)

## Run Locally

**Prerequisites:** Node.js, PostgreSQL

1. Install dependencies:
   `npm install`
2. Copy environment variables:
   `cp .env.example .env`
3. Configure `.env`:
   - Required: `DATABASE_URL` (PostgreSQL connection string)
   - Required: `OPENAI_API_KEY`
   - Optional: `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
   - Optional: `OPENAI_MODEL` (default: `gpt-4`)
4. Setup database:
   `npm run db:push`
5. Start the servers:
   - Frontend: `npm run dev` (http://localhost:5173)
   - Backend: `npm run dev:server` (http://localhost:3000)

Vite proxies `/api` to the backend server.

### Database (PostgreSQL)
Migrations are managed via Drizzle Kit:

```bash
# Generate migration (if schema changes)
npm run db:generate

# Push schema to database
npm run db:push

# Open database studio
npm run db:studio
```

## Deploy to SAP BTP

1. Build the application:
   `npm run build:prod`

2. Create PostgreSQL service (if not exists):
   ```bash
   cf create-service postgresql db-small flowsync-postgres-db
   ```

3. Set environment variables:
   ```bash
   cf set-env flowsync-ai OPENAI_API_KEY your-api-key
   ```

4. Deploy:
   `cf push`

See [manifest.yml](./manifest.yml) for deployment configuration.

## API Notes
- Draft-first flow: `POST /api/drafts` then `POST /api/drafts/:id/apply`
- Audit log + rollback: `GET /api/audit` and `POST /api/audit/:id/rollback`
- Direct write APIs still exist for `/api/projects` and `/api/tasks` (POST/PATCH/DELETE) and are audited,
  but do not go through the draft approval flow.

## Data Export & Import

### Export
- Formats: CSV, TSV, JSON, Markdown, PDF
- Scope: Active project or All projects

### Import
- Formats: JSON, CSV, TSV
- Strategy: Append (add new tasks) or Merge by ID (overwrite tasks with matching IDs)
- Required headers for CSV/TSV (case-insensitive):
  `project,id,title,status,priority,assignee,wbs,startDate,dueDate,completion,isMilestone,predecessors,description,createdAt`

## Migration from Cloudflare Workers

If you're migrating from the Cloudflare Workers (D1) version, see [MIGRATION.md](./MIGRATION.md) for detailed steps.
