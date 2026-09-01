"""Client for the Adzuna Jobs API (free tier).

Called on demand — only when a user opens a company's detail view — and
never on a schedule. Adzuna's free tier caps out at 25 hits/minute, 250/day,
1000/week, 2500/month, so callers are expected to cache results themselves
(see job_postings in schema.sql) rather than call this on every request.
"""

import os
import time
from dataclasses import dataclass

import httpx

ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api"
ADZUNA_COUNTRY = os.environ.get("ADZUNA_COUNTRY", "us")
RESULTS_PER_PAGE = 10

# Adzuna allows 25 hits/minute; spacing live calls out by a couple of
# seconds keeps a burst of company clicks (e.g. several people demoing the
# app at once) from ever getting close to that ceiling.
MIN_SECONDS_BETWEEN_CALLS = 3.0
_last_call_at = 0.0


class AdzunaConfigError(RuntimeError):
    """Raised when ADZUNA_APP_ID / ADZUNA_APP_KEY aren't configured."""


class AdzunaAPIError(RuntimeError):
    """Raised when Adzuna returns an error response."""


@dataclass
class JobPosting:
    adzuna_id: str
    title: str
    description: str | None
    redirect_url: str | None
    location: str | None
    salary_min: float | None
    salary_max: float | None
    contract_time: str | None
    contract_type: str | None
    created: str | None


def _credentials() -> tuple[str, str]:
    app_id = os.environ.get("ADZUNA_APP_ID")
    app_key = os.environ.get("ADZUNA_APP_KEY")
    if not app_id or not app_key:
        raise AdzunaConfigError(
            "ADZUNA_APP_ID and ADZUNA_APP_KEY must be set (see .env.example)"
        )
    return app_id, app_key


def _throttle() -> None:
    global _last_call_at
    elapsed = time.monotonic() - _last_call_at
    if elapsed < MIN_SECONDS_BETWEEN_CALLS:
        time.sleep(MIN_SECONDS_BETWEEN_CALLS - elapsed)
    _last_call_at = time.monotonic()


def fetch_jobs_for_company(company: str) -> list[JobPosting]:
    """Search current Adzuna listings for a company, live (no caching here).

    Callers are responsible for checking/populating the job_postings cache
    before reaching for this — see main.py's get_company_jobs.
    """
    app_id, app_key = _credentials()
    _throttle()

    response = httpx.get(
        f"{ADZUNA_BASE_URL}/jobs/{ADZUNA_COUNTRY}/search/1",
        params={
            "app_id": app_id,
            "app_key": app_key,
            "company": company,
            "results_per_page": RESULTS_PER_PAGE,
        },
        timeout=10.0,
    )
    if response.status_code != 200:
        raise AdzunaAPIError(
            f"Adzuna returned {response.status_code}: {response.text[:200]}"
        )

    payload = response.json()
    postings = []
    for job in payload.get("results", []):
        location = job.get("location", {}).get("display_name")
        postings.append(
            JobPosting(
                adzuna_id=job["id"],
                title=job["title"],
                description=job.get("description"),
                redirect_url=job.get("redirect_url"),
                location=location,
                salary_min=job.get("salary_min"),
                salary_max=job.get("salary_max"),
                contract_time=job.get("contract_time"),
                contract_type=job.get("contract_type"),
                created=job.get("created"),
            )
        )
    return postings
