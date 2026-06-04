#!/bin/bash
# Start the Docling backend with MPS (Mac GPU) acceleration

cd "$(dirname "$0")/backend"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies (this may take a few minutes on first run)..."
pip install -r requirements.txt

# Start the server (FastAPI app factory in app/main.py)
echo ""
echo "Starting Docling backend with MPS GPU acceleration..."
echo "API available at: http://localhost:8000"
echo "API docs at: http://localhost:8000/docs"
echo ""
uvicorn app.main:app --host 0.0.0.0 --port 8000
