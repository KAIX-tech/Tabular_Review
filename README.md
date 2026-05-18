
# Tabular Review for Bulk Document Analysis

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/framework-React-61DAFB.svg)
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

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **AI Integration**: On-prem vLLM OpenAI-compatible chat completions API

## 📦 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/tabular-review.git
cd tabular-review
```

### 2. Setup Frontend
Install Node dependencies:
```bash
pnpm install
```

Create a `.env.local` file in the root directory for the frontend:
```env
VITE_LLM_MODEL=glm-5
VITE_LLM_TIMEOUT_MS=120000
```

The frontend calls the local FastAPI backend, and the backend proxies requests to vLLM. Configure the backend with:

```env
VLLM_BASE_URL=http://10.10.190.10:15006/v1
VLLM_API_KEY=EMPTY
VLLM_MODEL=glm-5
VLLM_TIMEOUT_SECONDS=120
```

Because vLLM is called from the backend, the vLLM server does not need to allow browser CORS. A typical vLLM command looks like:

```bash
vllm serve /path/to/glm-5 \
  --host 0.0.0.0 \
  --port 15006 \
  --served-model-name glm-5
```

### 3. Setup Backend (Docling)
The backend is required for document conversion.

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Run
Start the backend (in one terminal):
```bash
cd server
source venv/bin/activate
python main.py
```

Start the frontend (in another terminal):
```bash
pnpm dev
```

### 🐳 Docker Deployment (Alternative)

You can also run the application using Docker:

1. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env and configure your vLLM endpoint
   ```

2. **Build and run with Docker**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:8000/docs

The Docker setup includes:
- **Frontend**: React app served by Node.js static server
- **Backend**: FastAPI with Docling document processing
- **Simple networking**: Services communicate via Docker network

## 🛡 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Disclaimer**: This tool is an AI assistant and should not be used as a substitute for professional legal advice. Always verify AI-generated results against the original documents.
