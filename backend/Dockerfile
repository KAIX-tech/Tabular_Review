# Backend (FastAPI + Docling) for Tabular Review
FROM python:3.11-slim

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

# Install Python dependencies first for layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code (the `app` package and prefetch scripts).
COPY app ./app
COPY scripts ./scripts

EXPOSE 8000

# Run the FastAPI app factory via uvicorn.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
