# /// script
# requires-python = ">=3.11"
# dependencies = ["openpyxl>=3.1.5"]
# ///
"""Load grad-roster-excel/grad_roster.xlsx into the SQLite database.

Builds `companies` (keyed by name) and `alumni` (keyed by email, with
summer_company / ft_employer foreign keys into `companies`) from the roster
spreadsheet, applying database/schema.sql first.

Usage (from the repo root):
    uv run database/seed/load_grad_roster.py
"""

import sqlite3
from pathlib import Path

import openpyxl

REPO_ROOT = Path(__file__).resolve().parents[2]
XLSX_PATH = REPO_ROOT / "grad-roster-excel" / "grad_roster.xlsx"
SCHEMA_PATH = REPO_ROOT / "database" / "schema.sql"
DB_PATH = REPO_ROOT / "database" / "gethiredcbs.db"

# Column order in grad_roster.xlsx (see grad-roster-excel/create_grad_roster.py)
COLUMNS = [
    "graduating_year",
    "first_name",
    "last_name",
    "status",
    "email",
    "cluster",
    "undergrad_institution",
    "summer_company",
    "ft_employer",
    "ft_industry",
    "ft_title",
    "ft_function",
    "city",
    "state",
    "country",
    "dual_degree",
]

NA_PLACEHOLDER = "#N/A"


def clean(value: object) -> object:
    """Normalize the roster's blank markers (None / "" / "#N/A") to NULL."""
    if value is None or value == "" or value == NA_PLACEHOLDER:
        return None
    return value


def load_rows(xlsx_path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb.active
    rows = ws.iter_rows(min_row=2, values_only=True)
    return [
        dict(zip(COLUMNS, (clean(v) for v in row)))
        for row in rows
        if any(v is not None for v in row)
    ]


def main() -> None:
    if not XLSX_PATH.exists():
        raise SystemExit(f"Roster spreadsheet not found: {XLSX_PATH}")

    rows = load_rows(XLSX_PATH)

    company_names = sorted(
        {row[col] for row in rows for col in ("summer_company", "ft_employer") if row[col]}
    )

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(SCHEMA_PATH.read_text())
        conn.execute("DELETE FROM alumni")
        conn.execute("DELETE FROM companies")

        conn.executemany(
            "INSERT INTO companies (name) VALUES (?)",
            [(name,) for name in company_names],
        )
        conn.executemany(
            f"""
            INSERT INTO alumni ({", ".join(COLUMNS)})
            VALUES ({", ".join("?" for _ in COLUMNS)})
            """,
            [tuple(row[col] for col in COLUMNS) for row in rows],
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Loaded {len(rows)} alumni and {len(company_names)} companies into {DB_PATH}")


if __name__ == "__main__":
    main()
