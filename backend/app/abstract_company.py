"""Abstract API Company Enrichment client.

Abstract requires a company domain rather than a company name.  The roster's
real companies are mapped here; synthetic companies intentionally have no
mapping and therefore do not consume an API credit.
"""

import os
import time

import httpx

ABSTRACT_BASE_URL = "https://companyenrichment.abstractapi.com/v2/"
MIN_SECONDS_BETWEEN_CALLS = 1.05
_last_call_at = 0.0


class AbstractConfigError(RuntimeError):
    pass


class AbstractAPIError(RuntimeError):
    pass


# Only verified, real-company domains belong here. The generated "Ventures"
# and "Startup" names have no public domain and are left unenriched.
COMPANY_DOMAINS = {
    "Accenture Strategy": "accenture.com",
    "Amazon": "amazon.com",
    "American Express": "americanexpress.com",
    "Apple": "apple.com",
    "BRICK Education Network": "brickeducation.org",
    "Bain & Company": "bain.com",
    "Bank of America": "bankofamerica.com",
    "Barclays": "barclays.com",
    "BlackRock": "blackrock.com",
    "Blackstone": "blackstone.com",
    "Boston Consulting Group": "bcg.com",
    "Bristol Myers Squibb": "bms.com",
    "Brookfield Properties": "brookfieldproperties.com",
    "CBRE": "cbre.com",
    "Carlyle Group": "carlyle.com",
    "Chevron": "chevron.com",
    "Citi": "citi.com",
    "City of New York": "nyc.gov",
    "Colgate-Palmolive": "colgatepalmolive.com",
    "Deloitte Consulting": "deloitte.com",
    "EY-Parthenon": "ey.com",
    "Estée Lauder Companies": "elcompanies.com",
    "Evercore": "evercore.com",
    "ExxonMobil": "exxonmobil.com",
    "Fidelity Investments": "fidelity.com",
    "General Atlantic": "generalatlantic.com",
    "Goldman Sachs": "goldmansachs.com",
    "Google": "google.com",
    "Insight Partners": "insightpartners.com",
    "JLL": "jll.com",
    "JPMorgan Chase": "jpmorganchase.com",
    "Johnson & Johnson": "jnj.com",
    "KIPP DC": "kippdc.org",
    "KKR": "kkr.com",
    "L'Oréal": "loreal.com",
    "Lazard": "lazard.com",
    "LinkedIn": "linkedin.com",
    "Mastercard": "mastercard.com",
    "McKinsey & Company": "mckinsey.com",
    "Merck": "merck.com",
    "MetLife": "metlife.com",
    "Meta": "meta.com",
    "Microsoft": "microsoft.com",
    "Morgan Stanley": "morganstanley.com",
    "NBCUniversal": "nbcuniversal.com",
    "Netflix": "netflix.com",
    "New York City Department of Education": "schools.nyc.gov",
    "NextEra Energy": "nexteraenergy.com",
    "Nike": "nike.com",
    "Novartis": "novartis.com",
    "Oliver Wyman": "oliverwyman.com",
    "PepsiCo": "pepsico.com",
    "Pfizer": "pfizer.com",
    "Procter & Gamble": "pg.com",
    "Related Companies": "related.com",
    "Robin Hood Foundation": "robinhood.org",
    "S&P Global": "spglobal.com",
    "Salesforce": "salesforce.com",
    "Shell": "shell.com",
    "Sony Pictures": "sonypictures.com",
    "Spotify": "spotify.com",
    "Stripe": "stripe.com",
    "TPG": "tpg.com",
    "Target": "target.com",
    "Teach For America": "teachforamerica.org",
    "The Walt Disney Company": "thewaltdisneycompany.com",
    "Tishman Speyer": "tishmanspeyer.com",
    "Uber": "uber.com",
    "Unilever": "unilever.com",
    "United Nations": "un.org",
    "UnitedHealth Group": "unitedhealthgroup.com",
    "Visa": "visa.com",
    "Vista Equity Partners": "vistaequitypartners.com",
    "Warner Bros. Discovery": "wbd.com",
    "World Bank": "worldbank.org",
}


def domain_for_company(company: str) -> str | None:
    return COMPANY_DOMAINS.get(company)


def _api_key() -> str:
    key = os.environ.get("ABSTRACT_API_KEY")
    if not key:
        raise AbstractConfigError(
            "ABSTRACT_API_KEY is not configured in backend/.env"
        )
    return key


def _throttle() -> None:
    global _last_call_at
    elapsed = time.monotonic() - _last_call_at
    if elapsed < MIN_SECONDS_BETWEEN_CALLS:
        time.sleep(MIN_SECONDS_BETWEEN_CALLS - elapsed)
    _last_call_at = time.monotonic()


def fetch_company(domain: str) -> dict:
    """Fetch one domain from Abstract API v2."""
    _throttle()
    response = httpx.get(
        ABSTRACT_BASE_URL,
        params={"api_key": _api_key(), "domain": domain},
        timeout=15.0,
    )
    if response.status_code != 200:
        message = response.text[:250]
        raise AbstractAPIError(
            f"Abstract API returned {response.status_code}: {message}"
        )
    payload = response.json()
    if not isinstance(payload, dict):
        raise AbstractAPIError("Abstract API returned an unexpected response")
    return payload
