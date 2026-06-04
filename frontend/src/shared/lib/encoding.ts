/** Base64 <-> UTF-8 text helpers used for document content storage. */

export const encodeTextToBase64 = (text: string): string =>
  btoa(unescape(encodeURIComponent(text)));

export const decodeBase64ToText = (content: string): string => {
  try {
    return decodeURIComponent(escape(atob(content)));
  } catch {
    return atob(content);
  }
};
