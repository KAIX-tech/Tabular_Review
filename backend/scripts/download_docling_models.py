"""Prefetch Docling models for an offline / air-gapped deployment.

Run this on a machine WITH internet access, using the SAME docling version as the
backend image (e.g. `uv run python scripts/download_docling_models.py`). It uses
Docling's own downloader so the model set + on-disk layout exactly match what the
runtime expects. Then copy the output directory to the deployment host and point
the backend at it with DOCLING_ARTIFACTS_PATH (offline mode).

By default it fetches only what the PDF + Tesseract-OCR pipeline needs:
  - layout model (docling-project/docling-layout-heron)
  - tableformer (docling-project/docling-models)
RapidOCR/EasyOCR/code-formula/picture-classifier models are skipped (this app
uses Tesseract CLI for OCR and no enrichment models). Pass --all for everything.

Example:
  uv run python scripts/download_docling_models.py --output ./docling-models
  # copy ./docling-models to the host, then on the host:
  #   docker cp ./docling-models/. tabular-review-backend:/root/.cache/docling/models/
  #   echo 'DOCLING_ARTIFACTS_PATH=/root/.cache/docling/models' >> .env
  #   docker compose -f docker-compose.prod.yml up -d backend
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from docling.utils.model_downloader import download_models


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default=os.getenv("DOCLING_MODEL_CACHE", "/root/.cache/docling/models"),
        help="Target directory for the Docling model artifacts (becomes DOCLING_ARTIFACTS_PATH).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Download all default models (RapidOCR, code-formula, picture-classifier, ...).",
    )
    args = parser.parse_args()

    output_dir = Path(args.output).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Docling models -> {output_dir} (all={args.all})")

    if args.all:
        download_models(output_dir=output_dir, progress=True)
    else:
        # Match the runtime PDF + Tesseract pipeline (layout + tableformer only).
        download_models(
            output_dir=output_dir,
            progress=True,
            with_layout=True,
            with_tableformer=True,
            with_code_formula=False,
            with_picture_classifier=False,
            with_rapidocr=False,
            with_easyocr=False,
        )

    print("Docling model download complete.")
    print(f"Set DOCLING_ARTIFACTS_PATH={output_dir} (or copy this dir to the host) for offline use.")


if __name__ == "__main__":
    main()
