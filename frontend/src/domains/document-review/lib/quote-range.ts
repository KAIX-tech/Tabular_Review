/**
 * Locate a quoted passage inside rendered document DOM.
 *
 * Chunk quotes are slices of the *markdown source*, while the viewer shows the
 * *rendered* text — markdown syntax (`**`, `|`, `#`, …) and whitespace differ.
 * Match on a normalized form (letters/digits only, lowercased) and map back to
 * exact DOM positions so the caller can highlight/scroll the real range.
 */

const SIGNIFICANT = /[\p{L}\p{N}]/u;

function significantChars(text: string): { chars: string; indices: number[] } {
  const indices: number[] = [];
  let chars = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (SIGNIFICANT.test(ch)) {
      chars += ch.toLowerCase();
      indices.push(i);
    }
  }
  return { chars, indices };
}

/** Minimum normalized length before a prefix fallback match is trusted. */
const MIN_PREFIX_MATCH = 20;
/** Prefix length used when the full quote cannot be found verbatim. */
const PREFIX_FALLBACK = 80;

export function findQuoteRange(root: HTMLElement, quote: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: { node: Text; start: number }[] = [];
  let full = "";
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    segments.push({ node, start: full.length });
    full += node.data;
  }
  if (!full) return null;

  const haystack = significantChars(full);
  const needle = significantChars(quote);
  if (!needle.chars) return null;

  let pos = haystack.chars.indexOf(needle.chars);
  let matchLength = needle.chars.length;
  if (pos < 0) {
    // Quotes can be clipped (600-char cap) or contain noise — try a prefix.
    const prefix = needle.chars.slice(0, PREFIX_FALLBACK);
    if (prefix.length < MIN_PREFIX_MATCH) return null;
    pos = haystack.chars.indexOf(prefix);
    if (pos < 0) return null;
    matchLength = prefix.length;
  }

  const startOriginal = haystack.indices[pos];
  const endOriginal = haystack.indices[pos + matchLength - 1];

  const locate = (originalIndex: number): { node: Text; offset: number } | null => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].start <= originalIndex) {
        return { node: segments[i].node, offset: originalIndex - segments[i].start };
      }
    }
    return null;
  };

  const start = locate(startOriginal);
  const end = locate(endOriginal);
  if (!start || !end) return null;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset + 1);
  return range;
}
