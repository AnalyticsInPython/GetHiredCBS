# backend

Python service that owns business logic and exposes the REST API consumed by `frontend`. Also home to the ETL/enrichment pipeline described in [Proposal.md](../Proposal.md) (ingesting alumni data, calling enrichment APIs, writing to `database`).

Planned scaffold (e.g. via [FastAPI](https://fastapi.tiangolo.com/)):

```
backend/
├── requirements.txt (or pyproject.toml)
├── app/
│   ├── main.py
│   ├── routers/        # REST endpoints
│   ├── models/          # ORM / schema models
│   └── services/        # business logic, API enrichment clients
└── etl/                  # ingestion + enrichment pipeline scripts
```

Not yet scaffolded — see the root [README.md](../README.md) for overall architecture.
