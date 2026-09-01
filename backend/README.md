# backend

Python service (**FastAPI**) that reads from `database/gethiredcbs.db` and exposes it as a REST API. It also serves the `frontend/` static files directly, so right now the whole app runs from one process.

## Structure

```
backend/
├── pyproject.toml
├── uv.lock
└── app/
    └── main.py     # FastAPI app: /api/alumni + static-mounts frontend/
```

Deliberately flat for now — a rudimentary starting point. `routers/`, `models/`, `services/`, and the ETL/enrichment pipeline described in [Proposal.md](../Proposal.md) will get split out as the API grows past a single endpoint.

## Run it

From the `backend/` folder:

```sh
uv run uvicorn app.main:app --reload
```

Then open http://127.0.0.1:8000 — that serves `frontend/index.html`, which calls `GET /api/alumni` for data. Requires `database/gethiredcbs.db` to exist first (see [database/README.md](../database/README.md)).
