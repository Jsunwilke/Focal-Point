# Repository Guidelines

## Project Structure & Module Organization
- `src/` — React app source. Key areas: `components/` (UI), `pages/` (views), `hooks/`, `services/` (data + side-effects), `contexts/`, `utils/`, `styles/`.
- `public/` — Static assets and `index.html`.
- `functions/` — Firebase Cloud Functions (Node 20). Deploy and emulate separately.
- `prisma/` — Prisma schema (`schema.prisma`, PostgreSQL via `DATABASE_URL`).
- Firebase config: `firebase.json`, `firestore.rules`, `storage.rules`.

## Build, Test, and Development Commands
- Frontend
  - `npm install` — Install root deps.
  - `npm start` — Run CRA dev server.
  - `npm run build` — Production build.
  - `npm run build:prod` — Build with `.env.production` (via `env-cmd`).
  - `npm test` — Jest in watch mode.
  - `npm run lint` / `npm run lint:fix` — ESLint checks/fixes under `src/`.
- Cloud Functions
  - `cd functions && npm install` — Install function deps.
  - `npm run serve` — Start Functions emulator.
  - `npm run deploy` — Deploy Functions only.

## Coding Style & Naming Conventions
- JavaScript/React: 2‑space indent, semicolons, double quotes.
- Components: PascalCase filenames (e.g., `Header.js`, `VersionHistoryModal.js`) with matching `.css` when present.
- Hooks: camelCase prefixed with `use` (e.g., `useFirebaseConnection.js`).
- Services/contexts: descriptive camelCase with clear suffixes (e.g., `photoCritiqueService.js`, `AuthContext.js`).
- Linting: React App ESLint rules; keep imports ordered and avoid unused vars.

## Testing Guidelines
- Framework: Jest + React Testing Library via CRA.
- Location: co‑locate tests next to sources or under `src/__tests__/`.
- Naming: `*.test.js` or `*.spec.js` (e.g., `Header.test.js`).
- Focus: utilities, hooks, and components with logic. Aim for stable smoke tests on complex pages.
- Run: `npm test` (press `a` to run all).

## Commit & Pull Request Guidelines
- Commits: short, imperative subject (e.g., "fix: proofing header"). Include scope when helpful (e.g., `chat:`, `sports:`). Reference issues (`#123`) when applicable.
- PRs: clear description, before/after screenshots for UI, testing steps, and linked issues. Keep changes focused; note any schema or config updates.

## Security & Configuration Tips
- Env: client vars must be `REACT_APP_*`. Use `.env.local` for local, `.env.production` for builds. Never commit secrets.
- Prisma: set `DATABASE_URL` before running code that touches Prisma.
- Firebase: validate changes to `firestore.rules`/`storage.rules`; prefer the emulator during development.
