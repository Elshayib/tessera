import { create } from "zustand";

const STORAGE_KEY = "tessera.ui.layout";
const MIN = 160;
const MAX = 640;

/**
 * UI-only panel sizes. Persisted to localStorage, never the document (`INV-ARCH-04`).
 *
 * @public
 */
export interface LayoutState {
  readonly outlinerWidth: number;
  readonly inspectorWidth: number;
  readonly chatHeight: number;
  setOutlinerWidth(width: number): void;
  setInspectorWidth(width: number): void;
  setChatHeight(height: number): void;
}

function clamp(value: number): number {
  if (value < MIN) {
    return MIN;
  }
  if (value > MAX) {
    return MAX;
  }
  return value;
}

function defaults(): Pick<LayoutState, "outlinerWidth" | "inspectorWidth" | "chatHeight"> {
  return { outlinerWidth: 240, inspectorWidth: 280, chatHeight: 200 };
}

function isJsonObject(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(
  record: { readonly [key: string]: unknown },
  key: string,
  fallback: number,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return clamp(value);
}

function readStored(): Pick<LayoutState, "outlinerWidth" | "inspectorWidth" | "chatHeight"> {
  const fallback = defaults();
  if (typeof localStorage === "undefined") {
    return fallback;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isJsonObject(parsed)) {
      return fallback;
    }
    return {
      outlinerWidth: readNumber(parsed, "outlinerWidth", fallback.outlinerWidth),
      inspectorWidth: readNumber(parsed, "inspectorWidth", fallback.inspectorWidth),
      chatHeight: readNumber(parsed, "chatHeight", fallback.chatHeight),
    };
  } catch {
    return fallback;
  }
}

function persist(
  state: Pick<LayoutState, "outlinerWidth" | "inspectorWidth" | "chatHeight">,
): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      outlinerWidth: state.outlinerWidth,
      inspectorWidth: state.inspectorWidth,
      chatHeight: state.chatHeight,
    }),
  );
}

/**
 * Zustand store for panel layout (`02` § UI state).
 *
 * @public
 */
export const useLayoutStore = create<LayoutState>((set, get) => ({
  ...readStored(),
  setOutlinerWidth(width: number): void {
    set({ outlinerWidth: clamp(width) });
    persist(get());
  },
  setInspectorWidth(width: number): void {
    set({ inspectorWidth: clamp(width) });
    persist(get());
  },
  setChatHeight(height: number): void {
    set({ chatHeight: clamp(height) });
    persist(get());
  },
}));

/**
 * localStorage key for {@link useLayoutStore}.
 *
 * @public
 */
export const LAYOUT_STORAGE_KEY = STORAGE_KEY;
