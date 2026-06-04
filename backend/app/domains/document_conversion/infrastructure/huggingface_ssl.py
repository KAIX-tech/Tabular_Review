"""Hugging Face Hub TLS configuration for Docling model downloads.

Some on-prem deployments sit behind a TLS-intercepting proxy or use self-signed
certificates that block Hugging Face downloads. When enabled, this patches the
HF client factory to skip certificate verification. Must run BEFORE the Docling
converter is constructed (which triggers model resolution).
"""

from __future__ import annotations

import warnings

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)


def configure_huggingface_ssl(disable_ssl_verify: bool, trust_env: bool) -> None:
    if not disable_ssl_verify:
        return

    from huggingface_hub.utils._http import hf_request_event_hook, set_client_factory

    def insecure_hf_client_factory() -> httpx.Client:
        warnings.warn(
            "DOCLING_HF_DISABLE_SSL_VERIFY is enabled. "
            "Hugging Face Hub downloads will skip TLS certificate verification.",
            RuntimeWarning,
            stacklevel=2,
        )
        return httpx.Client(
            verify=False,
            trust_env=trust_env,
            event_hooks={"request": [hf_request_event_hook]},
            follow_redirects=True,
            timeout=None,
        )

    set_client_factory(insecure_hf_client_factory)
    logger.warning(
        "Hugging Face Hub SSL verification disabled for Docling model downloads (trust_env=%s)",
        trust_env,
    )
