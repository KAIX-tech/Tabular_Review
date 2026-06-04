import { create } from "zustand";
import type { UserRole } from "./types";

/**
 * Client-side UI state for the Document DB shell.
 *
 * Holds the active role (admin/user) since authentication is out of scope —
 * the role is assumed-known at entry and toggled here for the prototype. The
 * selected Document DB itself is derived from the route param, not stored here.
 */
interface DocumentDbUiState {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

export const useDocumentDbUiStore = create<DocumentDbUiState>((set) => ({
  role: "admin",
  setRole: (role) => set({ role }),
}));
