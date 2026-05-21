from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from docling.document_converter import DocumentConverter
from docling.datamodel.pipeline_options import PdfPipelineOptions, TesseractCliOcrOptions
from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
from docling.datamodel.base_models import InputFormat
from docling.document_converter import PdfFormatOption
import httpx
import tempfile
import os
import shutil
import platform

app = FastAPI()

def parse_csv_env(name, default):
    raw_value = os.getenv(name) or default
    return [item.strip() for item in raw_value.split(",") if item.strip()]

def parse_bool_env(name, default):
    raw_value = os.getenv(name)
    if raw_value is None or raw_value.strip() == "":
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}

def env_value(name, default):
    return os.getenv(name) or default

VLLM_BASE_URL = env_value("VLLM_BASE_URL", "http://10.10.190.10:15006/v1").rstrip("/")
VLLM_API_KEY = env_value("VLLM_API_KEY", "EMPTY")
VLLM_MODEL = env_value("VLLM_MODEL", "glm-5")
VLLM_TIMEOUT_SECONDS = float(env_value("VLLM_TIMEOUT_SECONDS", "120"))
DOCLING_OCR_ENABLED = parse_bool_env("DOCLING_OCR_ENABLED", True)
DOCLING_OCR_FORCE_FULL_PAGE = parse_bool_env("DOCLING_OCR_FORCE_FULL_PAGE", False)
DOCLING_OCR_LANGS = parse_csv_env("DOCLING_OCR_LANGS", "eng,kor")

# Configure CORS
origins = parse_csv_env(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://10.10.190.4:13001",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize converter with GPU acceleration if available
# Use MPS (Metal Performance Shaders) on Apple Silicon Macs
def create_converter():
    if platform.system() == "Darwin":  # macOS
        print("Detected macOS - enabling MPS (Metal) GPU acceleration")
        accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice.MPS,
            num_threads=4
        )
    else:
        print("Running on CPU (MPS not available)")
        accelerator_options = AcceleratorOptions(
            device=AcceleratorDevice.AUTO,
            num_threads=4
        )
    
    # Configure PDF pipeline with accelerator options
    pdf_pipeline_options = PdfPipelineOptions()
    pdf_pipeline_options.accelerator_options = accelerator_options
    pdf_pipeline_options.do_ocr = DOCLING_OCR_ENABLED
    if DOCLING_OCR_ENABLED:
        print(
            "Docling OCR enabled "
            f"langs={DOCLING_OCR_LANGS} "
            f"force_full_page={DOCLING_OCR_FORCE_FULL_PAGE}"
        )
        pdf_pipeline_options.ocr_options = TesseractCliOcrOptions(
            lang=DOCLING_OCR_LANGS,
            force_full_page_ocr=DOCLING_OCR_FORCE_FULL_PAGE,
        )
    else:
        print("Docling OCR disabled")
    
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_pipeline_options)
        }
    )

converter = create_converter()

def vllm_headers():
    headers = {"Content-Type": "application/json"}
    if VLLM_API_KEY and VLLM_API_KEY.upper() != "EMPTY":
        headers["Authorization"] = f"Bearer {VLLM_API_KEY}"
    return headers

@app.post("/convert")
async def convert_document(file: UploadFile = File(...)):
    try:
        # Create a temporary file to save the uploaded content
        # Docling needs a file path
        suffix = os.path.splitext(file.filename)[1]
        if not suffix:
            suffix = ""
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            # Convert the document
            result = converter.convert(tmp_path)
            # Export to markdown
            markdown_content = result.document.export_to_markdown()
            return {"markdown": markdown_content}
        finally:
            # Clean up the temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
                
    except Exception as e:
        print(f"Error converting file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/llm/chat/completions")
async def proxy_llm_chat_completions(request: Request):
    try:
        payload = await request.json()
        payload["model"] = payload.get("model") or VLLM_MODEL
        print(f"Proxying LLM request to {VLLM_BASE_URL} with model={payload['model']}")

        async with httpx.AsyncClient(timeout=VLLM_TIMEOUT_SECONDS) as client:
            upstream_response = await client.post(
                f"{VLLM_BASE_URL}/chat/completions",
                json=payload,
                headers=vllm_headers(),
            )

        try:
            upstream_payload = upstream_response.json()
            print(
                "vLLM response "
                f"status={upstream_response.status_code} "
                f"model={upstream_payload.get('model')}"
            )
        except Exception:
            print(f"vLLM response status={upstream_response.status_code}")

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            media_type=upstream_response.headers.get("content-type", "application/json"),
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timed out while calling vLLM")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to call vLLM: {str(e)}")
    except Exception as e:
        print(f"Error proxying LLM request: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
