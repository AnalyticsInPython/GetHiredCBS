"""GetHiredCBS backend.

Rudimentary starting point: one API endpoint that reads the alumni roster
out of the SQLite database, plus the frontend/ static files mounted at "/".
"""

import sqlite3
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
