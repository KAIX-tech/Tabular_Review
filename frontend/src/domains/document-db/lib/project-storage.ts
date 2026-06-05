import type { SavedProject } from "../model/types";

export const saveProject = async (project: SavedProject): Promise<boolean> => {
  const jsonString = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const filename = `${project.name.replace(/\s+/g, "_").toLowerCase()}.tabular-project.json`;

  // Use the download fallback — more reliable across browsers than the
  // File System Access API (Safari/security-context issues).
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err: unknown) {
    console.error("Save project error:", err);
    throw new Error(`Failed to save: ${(err as Error).message}`);
  }
};

const validateProject = (project: unknown): project is SavedProject => {
  const p = project as Partial<SavedProject> | null;
  return (
    !!p &&
    typeof p.version === "number" &&
    typeof p.name === "string" &&
    Array.isArray(p.columns) &&
    Array.isArray(p.documents) &&
    typeof p.results === "object"
  );
};

export const loadProject = async (): Promise<SavedProject | null> => {
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
        const project = JSON.parse(text) as SavedProject;

        if (!validateProject(project)) {
          throw new Error("Invalid project file structure");
        }

        resolve(project);
      } catch (err: unknown) {
        console.error("Load project error:", err);
        reject(new Error(`Failed to load: ${(err as Error).message}`));
      }
    };

    // Handle cancel — oncancel isn't reliable, so poll on window focus.
    const handleFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          resolve(null);
        }
        window.removeEventListener("focus", handleFocus);
      }, 300);
    };
    window.addEventListener("focus", handleFocus);

    input.click();
  });
};
