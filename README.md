<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FlowSync AI Studio App

FlowSync is a data-driven project management app with a Cloudflare Worker (Hono) backend,
D1 persistence via Drizzle, and a React/Vite frontend. The backend supports draft-first
changes, audit logging, and rollback via audit snapshots.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set `OPENAI_API_KEY` in `.env.local`.
   - Optional: `OPENAI_BASE_URL` (full chat completions URL; default `https://api.openai.com/v1/chat/completions`)
   - Optional: `OPENAI_MODEL` (default `GLM-4.7`)
3. Start the frontend and Worker:
   - `npm run dev`
   - `npm run dev:worker`

Vite proxies `/api` to the Worker (default `http://127.0.0.1:8788`).

### Database (D1)
Migrations live in the project root at `migrations/` to match Wrangler's expectations.
Drizzle uses `drizzle.config.ts` and reads Cloudflare credentials from environment variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_D1_DATABASE_ID` (optional, defaults to current database id)

Generate a migration (if schema changes):
`npx drizzle-kit generate --config drizzle.config.ts --name <name>`

Apply migrations:
- Local: `npx wrangler d1 migrations apply flowsync --local`
- Remote: `npx wrangler d1 migrations apply flowsync --remote`

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
