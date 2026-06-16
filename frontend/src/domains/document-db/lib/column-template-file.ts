import type { ColumnLibraryFile, ColumnTemplate } from "../model/types";

/**
 * Column Library JSON export/import — file I/O only (the server is the source of
 * truth; see column-templates.api.ts). secure-context APIs are used when
 * available with a plain `<a download>` / `<input type=file>` fallback for the
 * plain-HTTP on-prem network.
 */

const isFileSystemAccessSupported = (): boolean =>
  typeof window !== "undefined" && !!window.showSaveFilePicker && !!window.showOpenFilePicker;

const validateFile = (data: unknown): data is ColumnLibraryFile => {
  const f = data as Partial<ColumnLibraryFile> | null;
  return !!f && typeof f.version === "number" && Array.isArray(f.templates);
};

/** Download the given templates as a `{version,templates}` JSON file. */
export async function exportTemplatesToFile(templates: ColumnTemplate[]): Promise<boolean> {
  const file: ColumnLibraryFile = { version: 1, templates };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });

  if (isFileSystemAccessSupported()) {
    try {
      const handle = await window.showSaveFilePicker!({
        suggestedName: "column-library.json",
        types: [{ description: "Column Library", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return false;
      throw err;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "column-library.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

/** Open a JSON file and return its templates, or null if cancelled. */
export async function pickTemplatesFromFile(): Promise<ColumnTemplate[] | null> {
  if (isFileSystemAccessSupported()) {
    try {
      const [handle] = await window.showOpenFilePicker!({
        types: [{ description: "Column Library", accept: { "application/json": [".json"] } }],
      });
      const file = await handle.getFile();
      const parsed = JSON.parse(await file.text());
      if (!validateFile(parsed)) throw new Error("Invalid library file structure");
      return parsed.templates;
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return null;
      throw err;
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(await file.text());
        if (!validateFile(parsed)) throw new Error("Invalid library file structure");
        resolve(parsed.templates);
      } catch (err) {
        reject(err);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
