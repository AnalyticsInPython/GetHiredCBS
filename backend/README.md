# backend

Python service (**FastAPI**) that reads from `database/gethiredcbs.db` and exposes it as a REST API. It also serves the `frontend/` static files directly, so right now the whole app runs from one process.

## Structure

```
backend/
├── pyproject.toml
├── uv.lock
├── .env.example    # copy to .env and fill in Adzuna credentials
└── app/
    ├── main.py     # FastAPI app: /api/alumni, /api/companies/{name}/jobs, static-mounts frontend/
    └── adzuna.py   # Adzuna Jobs API client (rate-limit-aware)
```

Deliberately flat for now — a rudimentary starting point. `routers/`, `models/`, `services/`, and the rest of the ETL/enrichment pipeline described in [Proposal.md](../Proposal.md) will get split out as the API grows past a couple of endpoints.

## Run it

From the `backend/` folder:

```sh
cp .env.example .env   # fill in ADZUNA_APP_ID / ADZUNA_APP_KEY
uv run uvicorn app.main:app --reload
```

Then open http://127.0.0.1:8000 — that serves `frontend/index.html`, which calls `GET /api/alumni` for data. Requires `database/gethiredcbs.db` to exist first (see [database/README.md](../database/README.md)).

## `/api/companies/{company}/jobs` — Adzuna job ads, on demand

Fetches live job postings for a company from the [Adzuna Jobs API](https://developer.adzuna.com/) (free tier) and caches them in the `job_postings` table.

- **On demand only.** Adzuna is never called on a schedule — only when this endpoint is hit for a specific company (e.g. a user opening that company's detail view in the frontend, once that view exists).
- **Cached for 7 days** (`JOB_CACHE_TTL` in `main.py`). Repeat requests within that window are served straight from SQLite with no Adzuna call. This keeps usage well under the free tier's 25/min, 250/day, 1000/week, 2500/month caps even if every one of the ~100 seeded companies gets clicked on repeatedly.
- **Throttled at the client level too** (`adzuna.py`): live calls are spaced at least 3 seconds apart, so a burst of clicks across different companies (e.g. several people demoing the app at once) can't approach the 25/min ceiling.
- **Fails soft.** If Adzuna is unreachable, misconfigured, or rate-limited, a stale cache is served (with a `warning` field) rather than erroring, as long as *some* cached data exists for that company.
- Always searches the `us` job market (`ADZUNA_COUNTRY` in `.env`), regardless of the alum's own country — Adzuna only supports 19 country codes and several alumni countries in the seed data (Japan, China, Nigeria, ...) aren't among them.
