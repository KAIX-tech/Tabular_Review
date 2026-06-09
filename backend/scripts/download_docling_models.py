import argparse
import os
from pathlib import Path
from urllib.parse import quote

import requests
import urllib3


DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

MODELS = [
    {
        "repo_id": "docling-project/docling-layout-heron",
        "revision": "main",
        "target_dir": "docling-project--docling-layout-heron",
    },
    {
        "repo_id": "docling-project/docling-models",
        "revision": "v2.3.0",
        "target_dir": "docling-project--docling-models",
    },
]


def parse_bool(value, default=False):
    if value is None or value == "":
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def request_json(session, url, verify):
    response = session.get(url, timeout=60, verify=verify)
    response.raise_for_status()
    return response.json()


def download_file(session, url, output_path, verify):
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with session.get(url, stream=True, timeout=120, verify=verify) as response:
        response.raise_for_status()
        tmp_path = output_path.with_suffix(output_path.suffix + ".tmp")
        with tmp_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
        tmp_path.replace(output_path)


def iter_repo_files(session, repo_id, revision, verify):
    api_url = f"https://huggingface.co/api/models/{repo_id}/revision/{revision}"
    payload = request_json(session, api_url, verify)
    for sibling in payload.get("siblings", []):
        filename = sibling.get("rfilename")
        if filename:
            yield filename


def download_repo(session, repo_id, revision, output_dir, verify):
    repo_dir = output_dir / next(
        item["target_dir"] for item in MODELS if item["repo_id"] == repo_id
    )
    print(f"Downloading {repo_id}@{revision} -> {repo_dir}")

    for filename in iter_repo_files(session, repo_id, revision, verify):
        target_path = repo_dir / filename
        if target_path.exists() and target_path.stat().st_size > 0:
            print(f"  skip {filename}")
            continue

        encoded_filename = quote(filename, safe="/")
        url = f"https://huggingface.co/{repo_id}/resolve/{revision}/{encoded_filename}"
        print(f"  get  {filename}")
        download_file(session, url, target_path, verify)


def main():
    parser = argparse.ArgumentParser(description="Download Docling PDF models ahead of runtime conversion.")
    parser.add_argument(
        "--output",
        default=os.getenv("DOCLING_MODEL_CACHE", "/root/.cache/docling/models"),
        help="Directory containing Docling model artifact folders.",
    )
    parser.add_argument(
        "--ssl-verify",
        action="store_true",
        help="Enable TLS certificate verification for Hugging Face requests.",
    )
    parser.add_argument(
        "--trust-env",
        action="store_true",
        default=parse_bool(os.getenv("DOCLING_HF_TRUST_ENV"), False),
        help="Allow requests to read proxy settings from environment variables.",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN"),
        help="Hugging Face token. Defaults to HF_TOKEN or HUGGINGFACE_HUB_TOKEN.",
    )
    parser.add_argument(
        "--user-agent",
        default=os.getenv("HF_USER_AGENT", DEFAULT_USER_AGENT),
        help="User-Agent header for Hugging Face requests.",
    )
    args = parser.parse_args()

    verify = args.ssl_verify or not parse_bool(os.getenv("DOCLING_HF_DISABLE_SSL_VERIFY"), False)
    if not verify:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    output_dir = Path(args.output).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.trust_env = args.trust_env
    session.headers.update({"User-Agent": args.user_agent})
    if args.token:
        session.headers.update({"Authorization": f"Bearer {args.token}"})

    print(f"output={output_dir}")
    print(f"ssl_verify={verify}")
    print(f"trust_env={args.trust_env}")
    print(f"token={'set' if args.token else 'not set'}")
    print(f"user_agent={args.user_agent}")

    for model in MODELS:
        download_repo(
            session=session,
            repo_id=model["repo_id"],
            revision=model["revision"],
            output_dir=output_dir,
            verify=verify,
        )

    print("Docling model download complete.")


if __name__ == "__main__":
    main()
