import type React from "react";
import type { ColumnType } from "../model/types";
import { CellValue } from "./CellValue";

/**
 * Display-only detail of one extracted cell: column, typed value, confidence,
 * AI reasoning, and the source citation chip.
 *
 * Shared by the admin verification sidebar and the chat source drawer (cell
 * citations) so "추출값 참조" looks identical everywhere. Presentation only —
 * callers supply the data and the citation-click behavior.
 */

export interface CellDetailData {
  columnName: string;
  columnType?: ColumnType;
  value: string;
  valueJson?: unknown;
  confidence?: "High" | "Medium" | "Low" | null;
  reasoning?: string | null;
  quote?: string | null;
  page?: number | null;
}

const CONFIDENCE_STYLE: Record<string, string> = {
  High: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-rose-50 text-rose-700",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  High: "높음",
  Medium: "중간",
  Low: "낮음",
};

/** Infer a render type from the normalized value when the column type is unknown. */
function inferType(data: CellDetailData): ColumnType {
  if (data.columnType) return data.columnType;
  if (Array.isArray(data.valueJson)) return "list";
  if (typeof data.valueJson === "boolean") return "boolean";
  return "text";
}

export const CellDetailCard: React.FC<{
  data: CellDetailData;
  /** Click on the citation chip (e.g. open the source passage). */
  onOpenSource?: () => void;
}> = ({ data, onOpenSource }) => {
  const type = inferType(data);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <span className="tr-label">{data.columnName}</span>
        {data.confidence && (
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_STYLE[data.confidence]}`}
          >
            신뢰도 {CONFIDENCE_LABEL[data.confidence]}
          </span>
        )}
      </div>

      <div>
        {type === "list" || type === "boolean" ? (
          <CellValue
            type={type}
            value={data.value}
            valueJson={data.valueJson}
            wrap
            selected={false}
          />
        ) : (
          <p
            className={`text-lg leading-relaxed font-medium text-ink break-words ${
              type === "number" || type === "date" ? "tabular-nums" : ""
            }`}
          >
            {data.value || <span className="text-ink-3 text-sm font-normal">값 없음</span>}
          </p>
        )}
      </div>

      {(data.reasoning || data.quote) && (
        <div>
          <h4 className="tr-label mb-1.5">AI 추론</h4>
          <div className="p-3 rounded-lg bg-surface-muted border border-border">
            {data.reasoning && (
              <p className="text-sm text-ink-2 leading-relaxed inline">{data.reasoning}</p>
            )}
            {data.quote && (
              <button
                type="button"
                onClick={onOpenSource}
                disabled={!onOpenSource}
                className="inline-flex items-center justify-center ml-1.5 align-middle px-1.5 py-0.5 rounded bg-primary-soft text-primary text-[10px] font-semibold border border-primary/20 hover:border-primary/40 transition-colors disabled:cursor-default"
                title="원문에서 보기"
              >
                {data.page != null ? `p.${data.page}` : "원문"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
