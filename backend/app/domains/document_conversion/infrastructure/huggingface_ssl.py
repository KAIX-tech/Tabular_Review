"""Hugging Face Hub TLS configuration for Docling model downloads.

Some on-prem deployments sit behind a TLS-intercepting proxy or use self-signed
certificates that block Hugging Face downloads. When enabled, this disables
certificate verification for HF Hub HTTP. Must run BEFORE the Docling converter
is constructed (which triggers model resolution).

huggingface_hub's HTTP internals vary across versions, so we try the public
`configure_http_backend` first, then fall back to the older internal httpx hook,
and degrade gracefully (verification stays on) if neither is available.
"""

from __future__ import annotations

import warnings

from app.core.logging import get_logger

logger = get_logger(__name__)


def _configure_via_http_backend(trust_env: bool) -> bool:
    """Public API path (requests-based). Available since huggingface_hub 0.13+."""
    try:
        import requests
        from huggingface_hub import configure_http_backend
    except ImportError:
        return False

    def backend_factory() -> "requests.Session":
        session = requests.Session()
        session.verify = False
        session.trust_env = trust_env
        return session

    configure_http_backend(backend_factory)
    try:
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except Exception:  # noqa: BLE001 - warning suppression is best-effort
        pass
    return True


def _configure_via_internal_httpx_hook(trust_env: bool) -> bool:
    """Fallback for huggingface_hub builds exposing the internal httpx factory."""
    try:
        import httpx
        from huggingface_hub.utils._http import hf_request_event_hook, set_client_factory
    except ImportError:
        return False

    def insecure_hf_client_factory() -> "httpx.Client":
        return httpx.Client(
            verify=False,
            trust_env=trust_env,
            event_hooks={"request": [hf_request_event_hook]},
            follow_redirects=True,
            timeout=None,
        )

    set_client_factory(insecure_hf_client_factory)
    return True


def configure_huggingface_ssl(disable_ssl_verify: bool, trust_env: bool) -> None:
    if not disable_ssl_verify:
        return

    warnings.warn(
        "DOCLING_HF_DISABLE_SSL_VERIFY is enabled. "
        "Hugging Face Hub downloads will skip TLS certificate verification.",
        RuntimeWarning,
        stacklevel=2,
    )

    if _configure_via_http_backend(trust_env):
        logger.warning(
            "HF SSL verification disabled via configure_http_backend (trust_env=%s)", trust_env
        )
        return

    if _configure_via_internal_httpx_hook(trust_env):
        logger.warning(
            "HF SSL verification disabled via internal httpx hook (trust_env=%s)", trust_env
        )
        return

    logger.warning(
        "Could not disable HF SSL verification (no compatible huggingface_hub hook found); "
        "continuing with verification enabled"
    )
