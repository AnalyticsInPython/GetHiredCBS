"""GetHiredCBS backend.

Rudimentary starting point: API endpoints that read the alumni roster out of
the SQLite database, plus the frontend/ static files mounted at "/".
"""

import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = REPO_ROOT / "database" / "gethiredcbs.db"
FRONTEND_DIR = REPO_ROOT / "frontend"

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


# Serve frontend/ static files at "/". Must be mounted after the API routes
# above so /api/* isn't shadowed by the static files.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
