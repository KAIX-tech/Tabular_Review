# Backend (FastAPI + Docling) for Tabular Review — uv-based.
FROM python:3.11-slim

# uv binary (pinned for reproducibility).
COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /uvx /bin/

WORKDIR /app

# System dependencies for document processing + OCR (English + Korean).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libxcb1 \
    libx11-6 \
    libfontconfig1 \
    libxrender1 \
    libxext6 \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-kor \
    && rm -rf /var/lib/apt/lists/*

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV PYTHONIOENCODING=utf-8
ENV PYTHONUNBUFFERED=1
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata/
ENV HF_HUB_DISABLE_XET=1

# uv settings: use system Python, copy (not hardlink) into the layer, compile bytecode.
ENV UV_PYTHON_DOWNLOADS=never
ENV UV_LINK_MODE=copy
ENV UV_COMPILE_BYTECODE=1
ENV UV_PROJECT_ENVIRONMENT=/app/.venv

# Install dependencies from the lockfile first (cached unless deps change).
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --python 3.11

# Application code (the `app` package, migrations, and prefetch scripts).
COPY app ./app
COPY scripts ./scripts
COPY alembic.ini ./
COPY migrations ./migrations

# Put the project venv on PATH so `uvicorn` / `python` resolve to it.
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# Apply DB migrations, then start the server. (DB readiness is gated by the
# compose healthcheck via depends_on.)
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
