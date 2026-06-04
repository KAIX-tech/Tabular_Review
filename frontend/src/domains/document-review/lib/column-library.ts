import type { ColumnLibrary, ColumnTemplate } from "@/domains/document-review/model/types";

const LIBRARY_STORAGE_KEY = "tabular-review-column-library";

const isFileSystemAccessSupported = (): boolean =>
  typeof window !== "undefined" && !!window.showSaveFilePicker && !!window.showOpenFilePicker;

const validateLibrary = (library: unknown): library is ColumnLibrary => {
  const l = library as Partial<ColumnLibrary> | null;
  return !!l && typeof l.version === "number" && Array.isArray(l.templates);
};

const mergeLibraries = (existing: ColumnLibrary, imported: ColumnLibrary): ColumnLibrary => {
  const existingIds = new Set(existing.templates.map((t) => t.id));
  const newTemplates = imported.templates.filter((t) => !existingIds.has(t.id));

  return {
    version: 1,
    templates: [...existing.templates, ...newTemplates],
  };
};

export const saveColumnLibrary = async (
  library: ColumnLibrary,
  toFile = false,
): Promise<boolean> => {
  // Always persist to localStorage as the source of truth.
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

  if (toFile) {
    const jsonString = JSON.stringify(library, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });

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
        if ((err as Error).name === "AbortError") {
          return false;
        }
        throw err;
      }
    } else {
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
  }

  return true;
};

export const loadColumnLibrary = (): ColumnLibrary => {
  const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
  if (stored) {
    try {
      const library = JSON.parse(stored) as ColumnLibrary;
      if (validateLibrary(library)) {
        return library;
      }
    } catch {
      // Invalid JSON, return empty.
    }
  }

  return { version: 1, templates: [] };
};

export const importColumnLibrary = async (): Promise<ColumnLibrary | null> => {
  if (isFileSystemAccessSupported()) {
    try {
      const [handle] = await window.showOpenFilePicker!({
        types: [{ description: "Column Library", accept: { "application/json": [".json"] } }],
      });
      const file = await handle.getFile();
      const text = await file.text();
      const library = JSON.parse(text) as ColumnLibrary;

      if (!validateLibrary(library)) {
        throw new Error("Invalid library file structure");
      }

      const existing = loadColumnLibrary();
      const merged = mergeLibraries(existing, library);
      await saveColumnLibrary(merged);

      return merged;
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        return null;
      }
      throw err;
    }
  } else {
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
          const text = await file.text();
          const library = JSON.parse(text) as ColumnLibrary;

          if (!validateLibrary(library)) {
            throw new Error("Invalid library file structure");
          }

          const existing = loadColumnLibrary();
          const merged = mergeLibraries(existing, library);
          await saveColumnLibrary(merged);

          resolve(merged);
        } catch (err) {
          reject(err);
        }
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }
};

export const addTemplateToLibrary = (
  template: Omit<ColumnTemplate, "id" | "createdAt">,
): ColumnTemplate => {
  const library = loadColumnLibrary();
  const newTemplate: ColumnTemplate = {
    ...template,
    id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  library.templates.push(newTemplate);
  saveColumnLibrary(library);

  return newTemplate;
};

export const removeTemplateFromLibrary = (templateId: string): void => {
  const library = loadColumnLibrary();
  library.templates = library.templates.filter((t) => t.id !== templateId);
  saveColumnLibrary(library);
};

export const updateTemplateInLibrary = (
  templateId: string,
  updates: Partial<Omit<ColumnTemplate, "id" | "createdAt">>,
): void => {
  const library = loadColumnLibrary();
  const index = library.templates.findIndex((t) => t.id === templateId);
  if (index !== -1) {
    library.templates[index] = { ...library.templates[index], ...updates };
    saveColumnLibrary(library);
  }
};

export const getTemplateCategories = (): string[] => {
  const library = loadColumnLibrary();
  const categories = new Set<string>();
  library.templates.forEach((t) => {
    if (t.category) {
      categories.add(t.category);
    }
  });
  return Array.from(categories).sort();
};
