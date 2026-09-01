# database

**SQLite** schema and loader for the normalized model described in [Proposal.md](../Proposal.md). Currently loads the CBS alumni roster from [`grad-roster-excel/grad_roster.xlsx`](../grad-roster-excel/grad_roster.xlsx); enrichment tables (job postings, firmographics) will extend this schema as the `backend` ETL pipeline grows.

```
database/
├── schema.sql               # canonical table definitions
└── seed/
    └── load_grad_roster.py   # reads grad_roster.xlsx → builds gethiredcbs.db
```

## Schema

- **`companies`** — keyed by company **name** (not a surrogate id), so alumni rows and future API-enrichment data can both join on it directly.
- **`alumni`** — keyed by `email`; one row per grad, with `summer_company` and `ft_employer` as foreign keys into `companies`.
- **`job_postings`** — cached [Adzuna](https://developer.adzuna.com/) job ads per company, keyed by `company` (references `companies.name`). Populated on demand by `backend`'s `GET /api/companies/{company}/jobs`, not by this loader — see [backend/README.md](../backend/README.md#apicompaniescompanyjobs--adzuna-job-ads-on-demand).

Blank cells and the roster's `#N/A` placeholders are both normalized to `NULL` on load.

Per-company stats (alumni count, most recent grad) aren't in the schema — they're computed in `backend/app/main.py` (`compute_company_stats`, behind `GET /api/companies`) off the raw tables above, so that aggregation logic lives in Python rather than as a SQL view.

## Usage

From the repo root:

```sh
uv run database/seed/load_grad_roster.py
```

This applies `schema.sql` and (re)builds `database/gethiredcbs.db` from the current spreadsheet — safe to re-run. The `.db` file itself is gitignored (`*.db`); only the schema and loader are tracked here.
