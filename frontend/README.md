# frontend

Right now: a plain HTML/CSS/JS starting point — `index.html`, `app.js`, `style.css` — served directly by the FastAPI app in `backend/` (no build step, no framework). It fetches `/api/alumni` and renders the roster into a filterable table.

This is intentionally minimal, just to get frontend → backend → database working end to end. The plan is still Vue 3 + TypeScript (see [Proposal.md](../Proposal.md) and the root [README.md](../README.md)) once there's more UI to justify it — swap this folder's contents for a proper Vite + Vue build when that happens; `backend/app/main.py`'s static mount doesn't care what's inside `frontend/`, just that `index.html` exists there.

## Run it

See [backend/README.md](../backend/README.md) — the backend serves these files, there's nothing to run standalone here.
