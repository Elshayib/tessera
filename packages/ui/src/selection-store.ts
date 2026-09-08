import { create } from "zustand";

/**
 * UI-only entity selection. Never persisted (`INV-ARCH-04`, `02` UI state).
 *
 * @public
 */
export interface SelectionState {
  readonly ids: readonly string[];
  readonly focusedId: string | null;
  setSelection(ids: readonly string[]): void;
  setFocused(id: string | null): void;
}

/**
 * Zustand store for outliner / viewport selection.
 *
 * @public
 */
export const useSelectionStore = create<SelectionState>((set) => ({
  ids: [],
  focusedId: null,
  setSelection(ids: readonly string[]): void {
    set({ ids: [...ids] });
  },
  setFocused(id: string | null): void {
    set({ focusedId: id });
  },
}));
