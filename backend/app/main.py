"""GetHiredCBS backend.

Rudimentary starting point: API endpoints that read the alumni roster out of
the SQLite database, plus the frontend/ static files mounted at "/".
"""

import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app import adzuna

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = REPO_ROOT / "database" / "gethiredcbs.db"
FRONTEND_DIR = REPO_ROOT / "frontend"

# How long cached Adzuna results are reused before a company click triggers
# a live re-fetch. Chosen to keep usage well under Adzuna's free-tier caps
# (25/min, 250/day, 1000/week, 2500/month) even if every one of the ~100
# companies gets clicked repeatedly.
JOB_CACHE_TTL = timedelta(days=7)

app = FastAPI(title="GetHiredCBS")


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


# Alumni with this status are founding their own company rather than
# joining an employer, so they're excluded from all company-based
# visualizations (bubbles, per-company alumni lists) as not relevant there.
STARTUP_STATUS = "Starting a new business"


def compute_company_stats() -> list[dict]:
    """Per-company alumni_count, for sizing bubbles on the main page.

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
            SELECT ft_employer, ft_industry
            FROM alumni
            WHERE ft_employer IS NOT NULL AND status != ?
            """,
            (STARTUP_STATUS,),
        ).fetchall()
    finally:
        conn.close()

    by_company: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for row in employed:
        by_company[row["ft_employer"]].append(row)

    stats = []
    for name in companies:
        employees = by_company.get(name, [])
        # A company's alumni should all share one ft_industry in this dataset,
        # but take the most common value defensively in case that ever drifts.
        industries = Counter(r["ft_industry"] for r in employees if r["ft_industry"])
        industry = industries.most_common(1)[0][0] if industries else None
        stats.append(
            {
                "company_name": name,
                "alumni_count": len(employees),
                "industry": industry,
            }
        )
    stats.sort(key=lambda s: s["company_name"])
    return stats


@app.get("/api/companies")
def get_companies() -> list[dict]:
    return compute_company_stats()


@app.get("/api/companies/{company}/alumni")
def get_company_alumni(company: str) -> list[dict]:
    """One card's worth of data per alum currently working at `company`,
    plus country (unused on the card itself, used for the by-location
    analytics breakdown computed client-side from this same list)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        if not conn.execute(
            "SELECT 1 FROM companies WHERE name = ?", (company,)
        ).fetchone():
            raise HTTPException(status_code=404, detail="Unknown company")

        rows = conn.execute(
            """
            SELECT first_name, last_name, graduating_year, email, ft_title, ft_function, country
            FROM alumni
            WHERE ft_employer = ? AND status != ?
            ORDER BY graduating_year DESC, last_name, first_name
            """,
            (company, STARTUP_STATUS),
        ).fetchall()
        return [dict(row) for row in rows]
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
