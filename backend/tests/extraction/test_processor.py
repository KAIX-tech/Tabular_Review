"""Unit tests for extraction value normalization + option injection (no LLM).

Targets the pure helpers: module-level `_normalize_value` and the
`ExtractionProcessor._column_spec` static method.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.domains.document_db.domain.models import ColumnDataType, DocumentColumn
from app.domains.extraction.application.processor import ExtractionProcessor, _normalize_value

OPTIONS = [
    "Manufacturing > Automotive > Auto Parts",
    "Finance > Banking",
    "Others",
]


def _column(data_type: ColumnDataType, *, options: list[str] | None = None) -> DocumentColumn:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return DocumentColumn(
        id=uuid4(),
        document_db_id=uuid4(),
        name="산업분류",
        data_type=data_type,
        prompt="문서의 산업 카테고리",
        options=options,
        position=0,
        created_at=now,
        updated_at=now,
    )


# --- _column_spec option injection -------------------------------------------
def test_column_spec_injects_options_for_single_select() -> None:
    spec = ExtractionProcessor._column_spec([_column(ColumnDataType.SINGLE_SELECT, options=OPTIONS)])
    assert "선택지(이 중에서만 선택)" in spec
    for opt in OPTIONS:
        assert opt in spec


def test_column_spec_no_options_line_for_plain_types() -> None:
    spec = ExtractionProcessor._column_spec([_column(ColumnDataType.TEXT)])
    assert "선택지" not in spec


def test_column_spec_no_options_line_when_select_has_no_options() -> None:
    spec = ExtractionProcessor._column_spec([_column(ColumnDataType.SINGLE_SELECT, options=None)])
    assert "선택지" not in spec


# --- _normalize_value: single_select (scalar + validation) -------------------
def test_single_select_scalar_in_options() -> None:
    value, value_json, force_low = _normalize_value(
        "Finance > Banking", ColumnDataType.SINGLE_SELECT, OPTIONS
    )
    assert value == "Finance > Banking"
    assert value_json is None  # scalar, not array
    assert force_low is False


def test_single_select_array_is_coerced_to_scalar() -> None:
    value, value_json, force_low = _normalize_value(
        ["Finance > Banking"], ColumnDataType.SINGLE_SELECT, OPTIONS
    )
    assert value == "Finance > Banking"
    assert value_json is None
    assert force_low is False


def test_single_select_off_taxonomy_keeps_value_but_forces_low() -> None:
    value, value_json, force_low = _normalize_value(
        "Spaceships", ColumnDataType.SINGLE_SELECT, OPTIONS
    )
    assert value == "Spaceships"  # not snapped
    assert value_json is None
    assert force_low is True


def test_single_select_empty_forces_low() -> None:
    value, value_json, force_low = _normalize_value("", ColumnDataType.SINGLE_SELECT, OPTIONS)
    assert value is None
    assert value_json is None
    assert force_low is True


def test_single_select_without_options_does_not_force_low() -> None:
    value, value_json, force_low = _normalize_value(
        "Anything", ColumnDataType.SINGLE_SELECT, None
    )
    assert value == "Anything"
    assert force_low is False


# --- _normalize_value: list / multi_select regression ------------------------
def test_multi_select_array_stays_array() -> None:
    value, value_json, force_low = _normalize_value(
        ["X", "Y"], ColumnDataType.MULTI_SELECT, None
    )
    assert value == "X\nY"
    assert value_json == ["X", "Y"]
    assert force_low is False


def test_list_serialized_array_parses_to_json() -> None:
    value, value_json, force_low = _normalize_value('["A","B"]', ColumnDataType.LIST, None)
    assert value_json == ["A", "B"]
    assert force_low is False


def test_text_scalar_unchanged() -> None:
    value, value_json, force_low = _normalize_value("대한민국", ColumnDataType.TEXT, None)
    assert value == "대한민국"
    assert value_json is None
    assert force_low is False
