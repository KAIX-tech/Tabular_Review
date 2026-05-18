from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from docling.document_converter import DocumentConverter
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
from docling.datamodel.base_models import InputFormat
from docling.document_converter import PdfFormatOption
import httpx
import tempfile
import os
import shutil
import platform

app = FastAPI()

# Configure CORS
# In production, replace with specific origins
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173", # Vite default
]

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
    
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_pipeline_options)
        }
    )

converter = create_converter()

VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://10.10.190.10:15006/v1").rstrip("/")
VLLM_API_KEY = os.getenv("VLLM_API_KEY", "EMPTY")
VLLM_MODEL = os.getenv("VLLM_MODEL", "glm-5")
VLLM_TIMEOUT_SECONDS = float(os.getenv("VLLM_TIMEOUT_SECONDS", "120"))

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

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {VLLM_API_KEY}",
        }

        async with httpx.AsyncClient(timeout=VLLM_TIMEOUT_SECONDS) as client:
            upstream_response = await client.post(
                f"{VLLM_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )

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
