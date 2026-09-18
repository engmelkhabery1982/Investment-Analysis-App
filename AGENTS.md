# AGENTS.md

## Project Context

This is a standalone React/Vite investment-analysis application. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions and verified financial methodology.

Start with `README.md` for local setup and data-portability guidance.

## Key Files

- `src/`: frontend application source.
- `src/lib/store.js`: localStorage-backed application state.
- `vite.config.js`: standard Vite/React configuration.

## Working Notes

- Use `npm run dev` for local development.
- Use `npm run build` and `npm run preview` to verify a production build locally.
- Preserve the localStorage keys and JSON backup compatibility unless a task explicitly authorizes a persistence migration.
- Run the relevant checks from `package.json` before finishing code changes.
