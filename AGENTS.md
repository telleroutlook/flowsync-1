# Repository Guidelines

## Project Structure & Module Organization
- `src/server.ts` is the Node.js entry point for the Hono backend.
- `worker/` contains backend routes, services, and database schemas (migrated from Cloudflare Workers).
- `App.tsx` hosts the main UI state and page layout.
- `index.tsx` is the React entry point; `index.html` is the Vite HTML shell.
- `components/` contains UI modules (PascalCase files like `GanttChart.tsx`).
- `services/` contains external integrations (e.g., `aiService.ts`).
- `types.ts` centralizes shared TypeScript types and enums.
- `migrations/` contains Drizzle/PostgreSQL migration files.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server (frontend).
- `npm run dev:server` — start the Node.js backend server (Hono + Postgres).
- `npm run build:prod` — build both frontend and backend for production.
- `npm run start:prod` — start the production server.
- `npm test` — run unit tests via Vitest.
- `npm run db:push` — push Drizzle schema changes to the database.
- `npm run db:studio` — open Drizzle Studio to inspect the database.

## Architecture & Tech Stack
- **Backend**: Node.js + Hono (was Cloudflare Workers).
- **Database**: PostgreSQL (via Drizzle ORM).
- **Frontend**: React + Vite.
- **Deployment**: SAP BTP (Cloud Foundry) via `manifest.yml`.

## Coding Style & Naming Conventions
- TypeScript + React with ES modules (`"type": "module"`).
- Indentation uses 2 spaces; JSX uses React’s `react-jsx` transform.
- Component files are `PascalCase.tsx`; helpers/services are `camelCase.ts`.
- Prefer named exports for components in `components/` and keep types in `types.ts`.
- Path alias `@/*` resolves from the repo root (see `tsconfig.json`).

## Testing Guidelines
- Testing framework: **Vitest**.
- Tests are co-located with source files (e.g., `components/ChatInterface.test.tsx`, `worker/services/utils.test.ts`).
- Ensure all business logic in `worker/services/` is covered by tests.
- Use `npm test` to run the suite.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (e.g., `feat: add gantt zoom`, `fix: pg migration`).
- PRs should include a clear description, how to test, and UI screenshots/GIFs for visual changes.
- Link related issues/tickets when applicable.

## Security & Configuration Tips
- Set `OPENAI_API_KEY` and `DATABASE_URL` in `.env` for local development.
- Do not commit secrets or local env files.
- Keep external calls isolated in `services/` and validate inputs before use.

## Data Export & Import
- Export/Import headers are standardized (see README for the canonical header list).
- Import supports Append or Merge by ID; prefer Merge when re-syncing existing tasks.
