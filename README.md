# GetHiredCBS

Enriches Columbia Business School alumni job-placement data with free public APIs (company firmographics, comparable job postings/salary data) and serves it through a searchable web app.

See [Proposal.md](Proposal.md) for the full project proposal, data sources, and team.

## Architecture

Three layers, one repo:

| Folder | Layer | Stack |
|---|---|---|
| [`frontend/`](frontend/) | UI | Vue 3 + TypeScript planned; currently a plain HTML/JS/CSS starting point |
| [`backend/`](backend/) | Business logic + REST API | Python (FastAPI) |
| [`database/`](database/) | Data storage | SQLite |

```
frontend (static HTML/JS/CSS, served by FastAPI)  ──►  backend (FastAPI)  ──►  database (SQLite)
```

Each folder has its own README with more detail on what goes there.

## Team

Thomas Schmitt, Mira Hout, Harry Bos, Shuko Takamura, Ece Polat
