#!/bin/bash
# Start the Docling backend with MPS (Mac GPU) acceleration

cd "$(dirname "$0")/backend"

# Sync the uv-managed virtualenv (.venv) from the lockfile.
echo "Syncing dependencies with uv (this may take a few minutes on first run)..."
uv sync

# Apply database migrations (requires a reachable Postgres; set DATABASE_URL,
# e.g. postgresql+asyncpg://kalex:kalex@localhost:15432/kalex against the compose DB).
echo "Applying database migrations (alembic upgrade head)..."
uv run alembic upgrade head

# Start the server (FastAPI app factory in app/main.py)
echo ""
echo "Starting Docling backend with MPS GPU acceleration..."
echo "API available at: http://localhost:8000"
echo "API docs at: http://localhost:8000/docs"
echo ""
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
