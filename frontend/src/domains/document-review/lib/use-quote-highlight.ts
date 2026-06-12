"use client";

import { type RefObject, useEffect } from "react";
import { findQuoteRange } from "./quote-range";

/**
 * Highlight + scroll to a quoted passage inside rendered markdown.
 *
 * Shared by the document viewer (chat chunk citations) and the verification
 * sidebar (cell sources) so every "원문 참조" surface behaves identically:
 * CSS Custom Highlight API when available (no DOM mutation), text-selection
 * fallback otherwise, smooth-scroll to the match either way.
 */
export function useQuoteHighlight(
  ref: RefObject<HTMLElement | null>,
  content: string | null | undefined,
  quote: string | null | undefined,
): void {
  useEffect(() => {
    if (!quote || !content) return;
    const timer = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const range = findQuoteRange(root, quote);
      if (!range) return;
      if ("highlights" in CSS) {
        CSS.highlights.set("kalex-quote", new Highlight(range));
      } else {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      // Scroll only the viewer's own scroll container — scrollIntoView would
      // also scroll every scrollable ancestor (overflow-hidden ones included),
      // which drags the whole app sideways when the chat source drawer is
      // still translating in from off-screen.
      const target = range.startContainer.parentElement ?? root;
      let scroller: HTMLElement | null = target;
      while (scroller && scroller !== document.body) {
        const { overflowY } = window.getComputedStyle(scroller);
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          scroller.scrollHeight > scroller.clientHeight
        ) {
          break;
        }
        scroller = scroller.parentElement;
      }
      if (scroller && scroller !== document.body) {
        const targetRect = target.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        scroller.scrollTo({
          top:
            scroller.scrollTop +
            (targetRect.top - scrollerRect.top) -
            (scroller.clientHeight - targetRect.height) / 2,
          behavior: "smooth",
        });
      }
    }, 80);
    return () => {
      window.clearTimeout(timer);
      if ("highlights" in CSS) CSS.highlights.delete("kalex-quote");
    };
  }, [ref, content, quote]);
}
