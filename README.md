
# Tabular Review for Bulk Document Analysis

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/framework-Next.js-000000.svg)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688.svg)
![AI](https://img.shields.io/badge/AI-On--prem%20vLLM-8E75B2.svg)

An AI-powered document review workspace that transforms unstructured legal contracts into structured, queryable datasets. Designed for legal professionals, auditors, and procurement teams to accelerate due diligence and contract analysis.

## 🚀 Features

- **AI-Powered Extraction**: Automatically extract key clauses, dates, amounts, and entities from PDFs using an on-prem vLLM OpenAI-compatible endpoint.
- **High-Fidelity Conversion**: Uses **Docling** (running locally) to convert PDFs and DOCX files to clean Markdown text, preserving formatting and structure without hallucination.
- **Dynamic Schema**: Define columns with natural language prompts (e.g., "What is the governing law?").
- **Verification & Citations**: Click any extracted cell to view the exact source quote highlighted in the original document.
- **Spreadsheet Interface**: A high-density, Excel-like grid for managing bulk document reviews.
- **Integrated Chat Analyst**: Ask questions across your entire dataset (e.g., "Which contract has the most favorable MFN clause?").

## 🎬 Demo

https://github.com/user-attachments/assets/b63026d8-3df6-48a8-bb4b-eb8f24d3a1ca

## 🛠 Tech Stack

- **Frontend** (`frontend/`): Next.js (App Router), React 19, TypeScript, Tailwind CSS — organized with Feature-Sliced Design (FSD).
- **Backend** (`backend/`): FastAPI + Docling, structured with Domain-Driven Design (DDD, ports & adapters).
- **AI Integration**: On-prem vLLM OpenAI-compatible chat completions API, proxied through the backend.

## 🗂 Project Structure

```
.
├── frontend/   Next.js App Router + FSD            → see frontend/CLAUDE.md
├── backend/    FastAPI + DDD (bounded contexts)    → see backend/CLAUDE.md
├── docs/       Product/design docs (screen-plan.md)
├── docker-compose.yml
└── .env.example
```

The browser talks only to the backend; the backend converts documents (Docling `/convert`) and proxies LLM calls (`/llm/chat/completions` → vLLM), keeping the API key server-side and avoiding browser CORS. See [CLAUDE.md](CLAUDE.md) for the full overview.

## 📦 Getting Started (local development)

### 1. Clone the repository
```bash
git clone https://github.com/KAIX-tech/Tabular_Review.git
cd Tabular_Review
```

### 2. Backend (Docling + vLLM proxy)

The backend is required for document conversion. The helper script creates a virtualenv, installs dependencies, and starts the server (with MPS GPU acceleration on Apple Silicon):

```bash
./start-backend.sh
```

Dependencies are managed with [uv](https://docs.astral.sh/uv/). Or manually:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

API docs are then available at `http://localhost:8000/docs`.

Configure the backend via environment variables (or a `.env` file). All settings are declared in `backend/app/core/config.py`:

```env
VLLM_BASE_URL=http://10.10.190.10:15006/v1
VLLM_API_KEY=EMPTY
VLLM_MODEL=glm-5
VLLM_TIMEOUT_SECONDS=120
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:5173,http://10.10.190.4:13001
PYTHONIOENCODING=utf-8
LANG=C.UTF-8
LC_ALL=C.UTF-8
DOCLING_OCR_ENABLED=true
DOCLING_OCR_FORCE_FULL_PAGE=false
DOCLING_OCR_LANGS=eng,kor
DOCLING_OCR_FALLBACK_ON_DECODE_ERROR=true
DOCLING_PDF_BACKEND=pypdfium2
DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models
DOCLING_HF_DISABLE_SSL_VERIFY=true
DOCLING_HF_TRUST_ENV=false
HF_HUB_DISABLE_XET=1
DOCLING_MODEL_CACHE=/root/.cache/docling/models
HF_TOKEN=
HF_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

Leave `VLLM_API_KEY` empty or set to `EMPTY` when vLLM is not started with `--api-key`. In that case, the backend will not send an `Authorization` header upstream.

Docling OCR uses Tesseract CLI in the backend Docker image. Set `DOCLING_OCR_FORCE_FULL_PAGE=true` for scanned PDFs that do not have a usable text layer; keep it `false` for faster hybrid parsing on searchable PDFs.

If Tesseract OCR output hits a UTF-8 decode failure, `DOCLING_OCR_FALLBACK_ON_DECODE_ERROR=true` retries the same PDF with OCR disabled. This keeps searchable PDFs convertible even when OCR fails on embedded page images.

`DOCLING_PDF_BACKEND=pypdfium2` uses the pypdfium2 PDF backend, which avoids UTF-8 decode failures that can occur in Docling's default parser on some PDFs. Set it to `docling_parse` to return to Docling's default PDF parser.

Docling may download layout/table extraction models from Hugging Face Hub on first PDF conversion. Set `DOCLING_HF_DISABLE_SSL_VERIFY=true` only when an internal TLS proxy or self-signed certificate blocks those model downloads. Keep `DOCLING_HF_TRUST_ENV=false` unless those downloads must use proxy variables from the container environment. `HF_HUB_DISABLE_XET=1` keeps model file downloads on the Python Hugging Face client path where the SSL bypass is applied. `DOCLING_ARTIFACTS_PATH` tells the runtime converter to use the prefetched local model folders instead of looking up Hugging Face snapshots again.

To prefetch Docling models before serving PDFs, run:

```bash
docker compose run --rm backend python scripts/download_docling_models.py
```

The script downloads the required layout and table models into `/root/.cache/docling/models`, which is persisted by the `docling-cache` Docker volume. It uses `requests` with SSL verification disabled by default, supports `HF_TOKEN` or `HUGGINGFACE_HUB_TOKEN`, and sends a browser-like User-Agent. Keep `DOCLING_ARTIFACTS_PATH` pointed at the same directory so Docling uses those downloaded files at runtime.

Because vLLM is called from the backend, the vLLM server does not need to allow browser CORS. A typical vLLM command looks like:

```bash
vllm serve /path/to/glm-5 \
  --host 0.0.0.0 \
  --port 15006 \
  --served-model-name glm-5
```

### 3. Frontend (Next.js)

```bash
cd frontend
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`. Create `frontend/.env.local` to point the browser at the backend (client vars must be `NEXT_PUBLIC_*`):

```env
NEXT_PUBLIC_API_URL=http://localhost:18001
NEXT_PUBLIC_LLM_MODEL=glm-5
NEXT_PUBLIC_LLM_TIMEOUT_MS=120000
```

Useful scripts: `pnpm build`, `pnpm typecheck`, `pnpm lint` (Biome + FSD import rules).

## 🐳 Docker Deployment (Alternative)

You can run both services with Docker Compose:

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env and configure your vLLM endpoint
   ```

2. **Build and run**:
   ```bash
   docker compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:13001
   - Backend API: http://localhost:18001/docs

The Docker setup includes:
- **Frontend**: Next.js app (`frontend/Dockerfile`)
- **Backend**: FastAPI with Docling document processing (`backend/Dockerfile`)
- **Simple networking**: Services communicate over a shared Docker network

## 🛡 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Disclaimer**: This tool is an AI assistant and should not be used as a substitute for professional legal advice. Always verify AI-generated results against the original documents.
