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
