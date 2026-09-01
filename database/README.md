# database

MySQL schema, migrations, and seed data for the normalized `alumni` / `companies` / `roles` / `job_postings` model described in [Proposal.md](../Proposal.md). Populated by the `backend` ETL pipeline.

Planned scaffold:

```
database/
├── schema.sql          # canonical table definitions
├── migrations/          # incremental schema changes
└── seed/                 # sample/seed data for local dev
```

Not yet scaffolded — see the root [README.md](../README.md) for overall architecture.
