# Repository Guidelines

## Project Structure & Module Organization
- `App.tsx` hosts the main UI state and page layout.
- `index.tsx` is the React entry point; `index.html` is the Vite HTML shell.
- `components/` contains UI modules (PascalCase files like `GanttChart.tsx`).
- `services/` contains external integrations (e.g., `aiService.ts`).
- `types.ts` centralizes shared TypeScript types and enums.
- `metadata.json` stores app metadata used by the project.

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server for local development.
- `npm run dev:worker` — start the Cloudflare Worker locally.
- `npm run build` — create a production build in `dist/`.
- `npm run preview` — serve the production build locally.
- `npm run deploy` — deploy the Worker via Wrangler.

## Coding Style & Naming Conventions
- TypeScript + React with ES modules (`"type": "module"`).
- Indentation uses 2 spaces; JSX uses React’s `react-jsx` transform.
- Component files are `PascalCase.tsx`; helpers/services are `camelCase.ts`.
- Prefer named exports for components in `components/` and keep types in `types.ts`.
- Path alias `@/*` resolves from the repo root (see `tsconfig.json`).

## Testing Guidelines
- No automated test setup is present yet.
- When adding tests, document the framework and add a script (e.g., `npm test`).
- Use descriptive test names and co-locate with source (e.g., `components/Foo.test.tsx`).

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (e.g., `feat: add gantt zoom`).
- PRs should include a clear description, how to test, and UI screenshots/GIFs for visual changes.
- Link related issues/tickets when applicable.

## Security & Configuration Tips
- Set `OPENAI_API_KEY` in `.env.local` for AI API access.
- Do not commit secrets or local env files.
- Keep external calls isolated in `services/` and validate inputs before use.

## Data Export & Import
- Export/Import headers are standardized (see README for the canonical header list).
- Import supports Append or Merge by ID; prefer Merge when re-syncing existing tasks.
