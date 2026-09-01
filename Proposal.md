# GetHiredCBS

### Project Proposal

**Team:** Thomas Schmitt, Mira Hout, Harry Bos, Shuko Takamura, Ece Polat

---

## 1. Overview

GetHiredCBS turns Columbia Business School's alumni employment outcomes into an interactive tool that current students and career-services staff can actually explore. We start from CBS's own alumni job-placement data (employer, title, industry, class year, program) and enrich each record with public, freely available data about the hiring company and the role itself — size, industry classification, headquarters location, and comparable job postings/salary ranges. The result is a searchable, filterable view of "who from CBS works where, doing what, and what does that company/role actually look like from the outside" — useful for students choosing target employers, comparing offers, or benchmarking a career path against alumni who walked it before them.

## 2. Problem Statement

CBS's alumni placement data is valuable but static and thin: a spreadsheet of names, employers, and titles tells a student almost nothing about the company itself (is it big or small, growing or shrinking, where is it based, what does it pay for similar roles) or how many other alumni ended up in similar roles. Students currently have to manually cross-reference employer names against LinkedIn, Glassdoor, and company websites one at a time. We want to automate that enrichment and put it behind a single, fast, searchable interface.

## 3. Objectives

- Ingest and clean the CBS alumni job-outcomes dataset into a normalized schema.
- Enrich each employer with firmographic data (industry, size, HQ location, description) pulled from free public APIs.
- Enrich each role/title with comparable live job postings and estimated salary ranges where available.
- Expose the combined dataset through a web app that supports search, filtering (industry, location, class year, program), and per-company/per-alumnus detail views.
- Ship a working, demoable MVP within the course timeline.

## 4. Data Sources

**Primary data**
- CBS alumni job-placement dataset (Career Management Center export) — employer, job title, industry, function, class year, program.

**Enrichment APIs (free tiers, no cost to the project)**

| Source | What it adds | Notes |
|---|---|---|
| [Adzuna Jobs API](https://developer.adzuna.com/) | Live comparable job postings, estimated salary ranges by title/location | Free developer tier, API key required |
| [SEC EDGAR (company facts / full-text search)](https://www.sec.gov/edgar/sec-api-documentation) | Financials, filings, industry (SIC code) for public companies | Free, no key required |
| [Clearbit Logo & Autocomplete API](https://clearbit.com/logo) | Company logo, domain, basic firmographics | Free, no key required for logo/autocomplete |
| [OpenCorporates API](https://api.opencorporates.com/) | Legal entity info, incorporation date, jurisdiction | Free tier, rate-limited |


Data matching (alumni employer name → canonical company entity) is expected to be the trickiest engineering problem — fuzzy name matching and manual review will both be needed for a clean join.

## 5. Technical Approach

**Architecture**

```
CBS alumni data (CSV/Excel)
        │
        ▼
Python ETL pipeline  ──►  Enrichment API calls (Adzuna, EDGAR, Clearbit, Wikidata, ...)
        │
        ▼
   SQL database (normalized: alumni, companies, roles, postings)
        │
        ▼
   Python backend (REST API)
        │
        ▼
   Vue 3 + TypeScript frontend (search, filters, company/alumni detail views)
```

- **Frontend:** Vue 3 + TypeScript, componentized (search/filter bar, results table, company detail panel).
- **Backend:** Python (FastAPI), REST endpoints for search, company detail, and alumni detail; a scheduled/one-off ETL script handles ingestion and enrichment.
- **Database:** SQL (SQLite) with a normalized schema — `alumni`, `companies`, `roles`, `job_postings`, keyed so enrichment data refreshes independently of the core alumni records.
- **Data privacy:** alumni PII (names, exact contact info) is handled per CBS data-use guidelines; the public-facing app aggregates/anonymizes where the underlying data agreement requires it.
