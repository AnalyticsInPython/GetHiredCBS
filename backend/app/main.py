"""GetHiredCBS backend.

Rudimentary starting point: one API endpoint that reads the alumni roster
out of the SQLite database, plus the frontend/ static files mounted at "/".
"""

import sqlite3
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


# Serve frontend/ (index.html, app.js, style.css) at "/". Must be mounted
# after the API routes above so /api/* isn't shadowed by the static files.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
