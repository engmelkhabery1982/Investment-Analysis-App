# Investment Analysis

A standalone local web application for investment analysis. Financial calculations and application data remain in the browser; no backend, account, or cloud database is required.

## Prerequisites

1. Install a current Node.js LTS release.
2. Clone the repository and open a terminal in its directory.
3. Install the lockfile-pinned dependencies:

```bash
npm ci
```

## Run Locally

Start the Vite development server:

```bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Production build and preview

Create the static production build:

```bash
npm run build
```

Preview that build locally:

```bash
npm run preview
```

The generated `dist/` directory can be served by a normal static host. Because the application uses browser history routing, configure the host to fall back to `index.html` for routes that do not correspond to physical files.

## Local data and portability

Application data is stored in the browser's local storage under `pia.state.v1`; import history uses `pia.importHistory.v1`. Data survives browser and computer restarts but belongs to the browser profile and exact site origin.

Before changing browser, hostname, port, or hosting provider, use **Settings → Export full backup**. Open the new installation and use **Import / restore backup** to transfer investments, transactions, market data, custom benchmarks, scenarios, and settings.

CSV/Excel imports and CSV exports are local browser operations and do not require an Internet connection.
