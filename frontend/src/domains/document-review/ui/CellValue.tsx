import type React from "react";
import type { ColumnType } from "../model/types";

/**
 * Type-aware rendering of an extracted cell value (Design.md: numbers are
 * tabular-nums, states are soft pills, restraint elsewhere).
 *
 * - list (incl. select columns, which the grid maps to "list"): chips from
 *   valueJson array (fallback: comma/newline-split value text)
 * - boolean: soft pill — emerald for positive, neutral for negative
 * - number/date: tabular-nums
 * - text: plain (unchanged)
 */

const POSITIVE = /^(true|yes|y|있음|예|포함|해당|가능|동의)/i;
const NEGATIVE = /^(false|no|n|없음|아니오|아니요|미포함|해당\s*없음|불가)/i;

function listItems(value: string, valueJson: unknown): string[] {
  if (Array.isArray(valueJson)) {
    const items = valueJson.map((v) => String(v).trim()).filter(Boolean);
    if (items.length > 0) return items;
  }
  return value
    .split(/[\n;,]|·/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function booleanState(value: string, valueJson: unknown): boolean | null {
  if (typeof valueJson === "boolean") return valueJson;
  const text = value.trim();
  if (POSITIVE.test(text)) return true;
  if (NEGATIVE.test(text)) return false;
  return null;
}

interface CellValueProps {
  type: ColumnType;
  value: string;
  valueJson?: unknown;
  /** Multi-line cell mode (grid text-wrap toggle). */
  wrap: boolean;
  selected: boolean;
}

export const CellValue: React.FC<CellValueProps> = ({ type, value, valueJson, wrap, selected }) => {
  const baseText = `text-sm ${selected ? "font-medium" : ""}`;
  const clamp = wrap ? "whitespace-pre-wrap break-words" : "truncate max-w-[180px]";

  if (type === "list") {
    const items = listItems(value, valueJson);
    // Single (or no) item — plain text, no list chrome.
    if (items.length <= 1) {
      const text = items[0] ?? value;
      return (
        <span className={`${baseText} ${clamp}`} title={text}>
          {text}
        </span>
      );
    }
    // Compact row: comma-joined single line (truncated, full list in tooltip).
    if (!wrap) {
      const joined = items.join(", ");
      return (
        <span className={`${baseText} ${clamp}`} title={joined}>
          {joined}
        </span>
      );
    }
    // Wrap mode / detail panel: markdown-style bullet lines, one per item.
    return (
      <ul className={`list-disc pl-4 space-y-0.5 ${baseText}`}>
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className="break-words text-ink">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  if (type === "boolean") {
    const state = booleanState(value, valueJson);
    if (state !== null) {
      return (
        <span
          className={`inline-flex px-1.5 py-0.5 rounded-md text-xs font-medium ${
            state ? "bg-emerald-50 text-emerald-700" : "bg-surface-muted text-ink-3"
          }`}
          title={value}
        >
          {value || (state ? "있음" : "없음")}
        </span>
      );
    }
    return <span className={`${baseText} ${clamp}`}>{value}</span>;
  }

  if (type === "number" || type === "date") {
    return (
      <span className={`${baseText} tabular-nums ${clamp}`} title={value}>
        {value}
      </span>
    );
  }

  return (
    <span className={`${baseText} ${clamp}`} title={value}>
      {value}
    </span>
  );
};
