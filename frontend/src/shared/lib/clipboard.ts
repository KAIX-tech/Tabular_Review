/**
 * Copy text to the clipboard, working on plain-HTTP deployments too.
 *
 * navigator.clipboard exists only in secure contexts (https/localhost) — the
 * on-prem LAN serves plain http, so fall back to a hidden textarea +
 * execCommand("copy") there (same class of issue as crypto.randomUUID).
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
