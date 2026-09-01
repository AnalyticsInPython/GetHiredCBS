-- GetHiredCBS database schema (SQLite)
--
-- companies is keyed by name (not a surrogate id) so alumni rows, and later
-- enrichment data pulled from company APIs, can join on the company name
-- directly.

CREATE TABLE IF NOT EXISTS companies (
    name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS alumni (
    email                  TEXT PRIMARY KEY,
    graduating_year        INTEGER NOT NULL,
    first_name             TEXT NOT NULL,
    last_name              TEXT NOT NULL,
    status                 TEXT NOT NULL,
    cluster                TEXT,
    undergrad_institution  TEXT,
    summer_company         TEXT REFERENCES companies (name),
    ft_employer            TEXT REFERENCES companies (name),
    ft_industry            TEXT,
    ft_title               TEXT,
    ft_function            TEXT,
    city                   TEXT,
    state                  TEXT,
    country                TEXT,
    dual_degree            TEXT
);

CREATE INDEX IF NOT EXISTS idx_alumni_summer_company ON alumni (summer_company);
CREATE INDEX IF NOT EXISTS idx_alumni_ft_employer ON alumni (ft_employer);

-- Cached results from the Adzuna Jobs API (/jobs/{country}/search/{page}),
-- fetched on demand when a user opens a company's detail view — never on a
-- schedule. All rows for a given company share one fetched_at, written by
-- whichever request triggered that fetch; the backend reuses those rows
-- for CACHE_TTL_DAYS before calling Adzuna again, since the free tier caps
-- out at 25 hits/minute and 250/day.
CREATE TABLE IF NOT EXISTS job_postings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    company         TEXT NOT NULL REFERENCES companies (name),
    adzuna_id       TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    redirect_url    TEXT,
    location        TEXT,
    salary_min      REAL,
    salary_max      REAL,
    contract_time   TEXT,
    contract_type   TEXT,
    created         TEXT,
    fetched_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings (company);
