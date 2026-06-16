"""Column Library router tests over a minimal FastAPI app (no DB).

Builds a small app with just the column-template router, the not-found handler,
and the service dependency overridden to the in-memory fake — verifying routes,
status codes, and the camelCase wire shape (dataType/createdAt).
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.domains.document_db.application.column_template_service import ColumnTemplateService
from app.domains.document_db.domain.ports import ColumnTemplateNotFoundError
from app.domains.document_db.interface.column_template_router import (
    router as column_template_router,
)
from app.domains.document_db.interface.dependencies import get_column_template_service
from tests.document_db.fake_repository import FakeColumnTemplateRepository


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(column_template_router)

    @app.exception_handler(ColumnTemplateNotFoundError)
    async def _not_found(_request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc) or "Not found"})

    service = ColumnTemplateService(FakeColumnTemplateRepository())
    app.dependency_overrides[get_column_template_service] = lambda: service
    return TestClient(app)


def test_list_empty(client: TestClient) -> None:
    response = client.get("/column-templates")
    assert response.status_code == 200
    assert response.json() == []


def test_create_camel_case_wire_shape(client: TestClient) -> None:
    response = client.post(
        "/column-templates",
        json={"name": "준거법", "dataType": "text", "prompt": "준거법 조항", "category": "법률"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "준거법"
    assert body["dataType"] == "text"
    assert body["category"] == "법률"
    assert body["createdAt"].endswith("Z")
    assert set(body) == {"id", "name", "dataType", "prompt", "category", "createdAt"}


@pytest.mark.parametrize(
    "data_type",
    ["text", "number", "date", "boolean", "list", "single_select", "multi_select"],
)
def test_create_accepts_all_seven_enum_values(client: TestClient, data_type: str) -> None:
    response = client.post(
        "/column-templates",
        json={"name": "X", "dataType": data_type, "prompt": "p"},
    )
    assert response.status_code == 201
    assert response.json()["dataType"] == data_type


def test_create_rejects_unknown_data_type(client: TestClient) -> None:
    response = client.post(
        "/column-templates",
        json={"name": "X", "dataType": "bogus", "prompt": "p"},
    )
    assert response.status_code == 422


def test_import_bulk(client: TestClient) -> None:
    response = client.post(
        "/column-templates:import",
        json={
            "templates": [
                {"name": "A", "dataType": "text", "prompt": "p"},
                {"name": "B", "dataType": "list", "prompt": "p", "category": "c"},
            ]
        },
    )
    assert response.status_code == 201
    assert len(response.json()) == 2
    assert len(client.get("/column-templates").json()) == 2


def test_delete_then_404(client: TestClient) -> None:
    template_id = client.post(
        "/column-templates", json={"name": "X", "dataType": "text", "prompt": "p"}
    ).json()["id"]
    assert client.delete(f"/column-templates/{template_id}").status_code == 204
    assert client.delete(f"/column-templates/{template_id}").status_code == 404


def test_delete_unknown_404(client: TestClient) -> None:
    assert client.delete(f"/column-templates/{uuid4()}").status_code == 404
