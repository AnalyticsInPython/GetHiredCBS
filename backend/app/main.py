"""GetHiredCBS backend.

Rudimentary starting point: API endpoints that read the alumni roster out of
the SQLite database, plus the frontend/ static files mounted at "/".
"""

import json
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app import abstract_company, adzuna

# Local secrets take precedence and are excluded by the repo's *.local rule.
# Keep the legacy .env fallback for the existing Adzuna configuration.
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env.local")
load_dotenv(BACKEND_DIR / ".env")

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = REPO_ROOT / "database" / "gethiredcbs.db"
FRONTEND_DIR = REPO_ROOT / "frontend"

# How long cached Adzuna results are reused before a company click triggers
# a live re-fetch. Chosen to keep usage well under Adzuna's free-tier caps
# (25/min, 250/day, 1000/week, 2500/month) even if every one of the ~100
# companies gets clicked repeatedly.
JOB_CACHE_TTL = timedelta(days=7)
ENRICHMENT_CACHE_TTL = timedelta(days=30)

app = FastAPI(title="GetHiredCBS")


def ensure_runtime_schema() -> None:
    """Add cache tables for an existing local database without rebuilding it."""
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS company_enrichment (
                company TEXT PRIMARY KEY REFERENCES companies (name),
                domain TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                fetched_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


ensure_runtime_schema()


def query_alumni() -> list[dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT graduating_year, first_name, last_name, status,
                   undergrad_institution, summer_company, ft_employer,
                   ft_industry, ft_title, ft_function, city, state, country
            FROM alumni
            ORDER BY graduating_year DESC, last_name
            """
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/alumni")
def get_alumni() -> list[dict]:
    return query_alumni()


def compute_company_stats() -> list[dict]:
    """Per-company alumni_count and the most recent grad who works there.

    Computed here in Python (not a SQL view) off alumni.ft_employer —
    "works at" is read as current full-time employer, not the summer
    internship.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        companies = [row["name"] for row in conn.execute("SELECT name FROM companies")]
        employed = conn.execute(
            """
            SELECT email, first_name, last_name, graduating_year, ft_employer, ft_industry
            FROM alumni
            WHERE ft_employer IS NOT NULL
            """
        ).fetchall()
    finally:
        conn.close()

    by_company: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in employed:
        by_company[row["ft_employer"]].append(row)

    stats = []
    for name in companies:
        employees = by_company.get(name, [])
        # Highest graduating_year first; alphabetical by name breaks ties.
        most_recent = min(
            employees,
            key=lambda r: (-r["graduating_year"], r["last_name"], r["first_name"]),
            default=None,
        )
        # A company's alumni should all share one ft_industry in this dataset,
        # but take the most common value defensively in case that ever drifts.
        industries = Counter(r["ft_industry"] for r in employees if r["ft_industry"])
        industry = industries.most_common(1)[0][0] if industries else None
        stats.append(
            {
                "company_name": name,
                "alumni_count": len(employees),
                "industry": industry,
                "most_recent_alumnus_email": most_recent["email"] if most_recent else None,
                "most_recent_alumnus_first_name": most_recent["first_name"] if most_recent else None,
                "most_recent_alumnus_last_name": most_recent["last_name"] if most_recent else None,
                "most_recent_alumnus_grad_year": most_recent["graduating_year"] if most_recent else None,
            }
        )
    stats.sort(key=lambda s: s["company_name"])
    return stats


@app.get("/api/companies")
def get_companies() -> list[dict]:
    return compute_company_stats()


def _comparable_roles(conn: sqlite3.Connection, company: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT ft_title AS title, COUNT(*) AS alumni_count
        FROM alumni
        WHERE ft_employer = ? AND ft_title IS NOT NULL
        GROUP BY ft_title
        ORDER BY alumni_count DESC, ft_title
        LIMIT 8
        """,
        (company,),
    ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/companies/{company}/enrichment")
def get_company_enrichment(company: str) -> dict:
    """Abstract company data, fetched on demand and cached for 30 days."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        company_row = conn.execute(
            "SELECT 1 FROM companies WHERE name = ?", (company,)
        ).fetchone()
        if not company_row:
            raise HTTPException(status_code=404, detail="Unknown company")

        roles = _comparable_roles(conn, company)
        domain = abstract_company.domain_for_company(company)
        if not domain:
            return {
                "company": company,
                "available": False,
                "comparable_roles": roles,
                "warning": "No verified domain is configured for this company.",
            }

        cached = conn.execute(
            "SELECT * FROM company_enrichment WHERE company = ?", (company,)
        ).fetchone()
        if cached:
            fetched_at = datetime.fromisoformat(cached["fetched_at"])
            if datetime.now(timezone.utc) - fetched_at <= ENRICHMENT_CACHE_TTL:
                return {
                    "company": company,
                    "domain": domain,
                    "available": True,
                    "source": "cache",
                    "data": json.loads(cached["payload_json"]),
                    "comparable_roles": roles,
                }

        try:
            payload = abstract_company.fetch_company(domain)
        except (abstract_company.AbstractConfigError, abstract_company.AbstractAPIError) as exc:
            if cached:
                return {
                    "company": company,
                    "domain": domain,
                    "available": True,
                    "source": "cache-stale",
                    "warning": str(exc),
                    "data": json.loads(cached["payload_json"]),
                    "comparable_roles": roles,
                }
            return {
                "company": company,
                "domain": domain,
                "available": False,
                "warning": str(exc),
                "comparable_roles": roles,
            }

        fetched_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO company_enrichment (company, domain, payload_json, fetched_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(company) DO UPDATE SET
                domain = excluded.domain,
                payload_json = excluded.payload_json,
                fetched_at = excluded.fetched_at
            """,
            (company, domain, json.dumps(payload), fetched_at),
        )
        conn.commit()
        return {
            "company": company,
            "domain": domain,
            "available": True,
            "source": "live",
            "data": payload,
            "comparable_roles": roles,
        }
    finally:
        conn.close()


def _row_to_job(row: sqlite3.Row) -> dict:
    job = dict(row)
    job.pop("id", None)
    job.pop("company", None)
    return job


@app.get("/api/companies/{company}/jobs")
def get_company_jobs(company: str) -> dict:
    """Job ads for one company, fetched from Adzuna on first view and then
    cached in job_postings for JOB_CACHE_TTL — see adzuna.py for why."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        if not conn.execute(
            "SELECT 1 FROM companies WHERE name = ?", (company,)
        ).fetchone():
            raise HTTPException(status_code=404, detail="Unknown company")

        cached = conn.execute(
            """
            SELECT * FROM job_postings
            WHERE company = ?
            ORDER BY fetched_at DESC
            """,
            (company,),
        ).fetchall()

        stale = True
        if cached:
            fetched_at = datetime.fromisoformat(cached[0]["fetched_at"])
            stale = datetime.now(timezone.utc) - fetched_at > JOB_CACHE_TTL

        if not stale:
            return {"company": company, "source": "cache", "jobs": [_row_to_job(r) for r in cached]}

        try:
            live_jobs = adzuna.fetch_jobs_for_company(company)
        except (adzuna.AdzunaConfigError, adzuna.AdzunaAPIError) as exc:
            if cached:
                # Serve stale cache rather than fail the page if Adzuna is
                # unreachable/misconfigured/rate-limited.
                return {
                    "company": company,
                    "source": "cache-stale",
                    "warning": str(exc),
                    "jobs": [_row_to_job(r) for r in cached],
                }
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        fetched_at = datetime.now(timezone.utc).isoformat()
        conn.execute("DELETE FROM job_postings WHERE company = ?", (company,))
        conn.executemany(
            """
            INSERT INTO job_postings (
                company, adzuna_id, title, description, redirect_url,
                location, salary_min, salary_max, contract_time,
                contract_type, created, fetched_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    company, j.adzuna_id, j.title, j.description, j.redirect_url,
                    j.location, j.salary_min, j.salary_max, j.contract_time,
                    j.contract_type, j.created, fetched_at,
                )
                for j in live_jobs
            ],
        )
        conn.commit()

        rows = conn.execute(
            "SELECT * FROM job_postings WHERE company = ?", (company,)
        ).fetchall()
        return {"company": company, "source": "live", "jobs": [_row_to_job(r) for r in rows]}
    finally:
        conn.close()


# Serve frontend/ (index.html, app.js, style.css) at "/". Must be mounted
# after the API routes above so /api/* isn't shadowed by the static files.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
