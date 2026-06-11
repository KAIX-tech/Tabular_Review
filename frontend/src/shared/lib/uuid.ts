/**
 * UUID v4 that works outside secure contexts.
 *
 * `crypto.randomUUID` only exists in secure contexts (HTTPS or localhost);
 * the on-prem deployment serves over plain http on a LAN IP, where calling it
 * throws. `crypto.getRandomValues` is available everywhere, so fall back to a
 * manual RFC 4122 v4.
 */
export function generateUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
