# Residential Property Price Register Viewer

A browser-based viewer for Ireland's [Residential Property Price Register](https://www.propertypriceregister.ie/) — search, filter, sort, and customize columns over every residential property sale recorded in Ireland since 1 January 2010.

## What it does

- Full-text search across address, county, eircode, and description
- Filter by date range, county (multi-select), and price range
- Sort any column, resize columns by dragging, and choose which columns are visible
- Columns fill the available screen width by default and reflow responsively

## How it works

The app is a static, client-side-only React app — there's no backend server.

The entire dataset is pre-built into a single SQLite database file, gzip-compressed, and shipped as a static asset (`viewer/public/data/flat.sqlite.gzbin`, ~32MB). On load, the browser:

1. Downloads the compressed database (cached afterward via the Cache Storage API, so repeat visits skip the network entirely)
2. Decompresses it in-browser (via [`pako`](https://github.com/nodeca/pako))
3. Opens it with [`sql.js`](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly)

All search/filter/sort queries then run as real SQL against that in-memory database, entirely on the client.

## Project structure

```
PPR-ALL.csv         Source data (not committed - see below)
build_sqlite.py      Regenerates the app's database from PPR-ALL.csv
viewer/               The React app (Vite + TypeScript)
  public/data/
    flat.sqlite.gzbin The compressed database the app actually loads
```

## Running locally

```
cd viewer
npm install
npm run dev
```

## Updating the dataset

`PPR-ALL.csv` (the raw source data) is intentionally **not** committed to this repo — it's a 100MB+ file from an external public dataset, and GitHub rejects any single file over 100MB anyway. Only the small, derived `flat.sqlite.gzbin` the app actually reads is tracked in git.

To refresh the app with a newer version of the register:

1. Download the latest CSV from the [official Residential Property Price Register](https://www.propertypriceregister.ie/), save it as `PPR-ALL.csv` in the repo root
2. Run the build script from the repo root:
   ```
   python build_sqlite.py
   ```
   This reads `PPR-ALL.csv`, builds a fresh SQLite database, stamps it with today's date as the import date (shown on the app's About page), compresses it, and writes it directly to `viewer/public/data/flat.sqlite.gzbin` — no intermediate files are left behind.
3. Commit **only** the regenerated `viewer/public/data/flat.sqlite.gzbin`
4. Push, and redeploy the app

## Data source

Data is sourced from the official [Residential Property Price Register](https://www.propertypriceregister.ie/), maintained by the Property Services Regulatory Authority (PSRA). It's updated weekly on their site; this app reflects a snapshot from whenever it was last rebuilt, not a live feed.
