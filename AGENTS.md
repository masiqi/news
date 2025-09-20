# Repository Guidelines

## Project Structure & Modules
- Monorepo managed by `turbo` workspaces:
  - `backend/` Cloudflare Workers (Hono, D1, R2, Queues, Workers AI). Source in `backend/src`, tests in `backend/test`, static in `backend/public`.
  - `frontend/` Next.js app (Turbopack). Standard Next structure under `frontend/`.
  - `admin/` AMIS-based admin utilities and scripts.
- Additional docs in `docs/`. See `README.md` and `PROJECT_STRUCTURE.md` for workflows.

## Build, Test, Run
- Root (Turbo):
  - `npm run dev` — start all packages in dev.
  - `npm run build` — build all workspaces.
  - `npm run test` — run tests across workspaces.
  - `npm run lint` — run linters where configured.
- Backend:
  - `cd backend && npm run dev` — local Worker via Wrangler.
  - `npm run test` — Vitest suite.
  - `npm run deploy` — deploy Worker.

## Coding Style & Naming
- TypeScript-first. Explicit types for public APIs. 2-space indentation; ~120-char line guide; no trailing whitespace.
- Filenames: `kebab-case`. Variables/functions: `camelCase`. Types/classes: `PascalCase`.
- Reuse services in `backend/src/services` and utils in `backend/src/utils`; avoid duplication.

## Testing Guidelines
- Backend uses Vitest (`backend/test` and `*.test.ts`).
- Prefer focused unit tests for parsing, routes, and AI fallback. Run: `cd backend && npm run test`.
- Keep fixtures small; mock external APIs.

## Commit & PR Guidelines
- Commits: concise, action-first (e.g., `feat: …`, `fix: …`). See `git log` for examples.
- PRs should include: purpose, linked issues, screenshots/logs (UI/AI), and local test steps.

## Security & Config
- Backend bindings via Wrangler: `DB` (D1), `R2_BUCKET` (R2), `RSS_FETCHER_QUEUE`/`AI_PROCESSOR_QUEUE` (Queues), `AI` (Workers AI), `ZHIPUAI_API_KEY` (Zhipu).
- Do not commit secrets. Use `.dev.vars` for local and Wrangler dashboard for prod.
- Handle network failures and limits; use existing retry/queue utilities.

## Agent Notes (LLM)
- Primary provider: Zhipu GLM. On error (e.g., sensitive words), fallback to Cloudflare Workers AI `@cf/openai/gpt-oss-20b` via `env.AI.run`.
- Keep responses strictly JSON as required by services; see `backend/src/services/unified-llm.service.ts` for schema.

