import { create } from "zustand";
import { emptyRoleModels, ROLE_MODEL_KEYS, type RoleModelMap } from "./models.js";
import { SETTINGS_RUN_POLICY_DEFAULTS } from "./policy.js";

const STORAGE_KEY = "tessera.ui.settings";

/**
 * localStorage key for {@link useProviderSettingsStore}.
 *
 * @public
 */
export const SETTINGS_STORAGE_KEY = STORAGE_KEY;

type StoredSettings = {
  readonly roles: RoleModelMap;
  readonly compatibleOrigin: string;
  readonly maxSteps: number;
  readonly maxToolCallsPerStep: number;
  readonly maxInputTokens: number;
  readonly timeoutMs: number;
  readonly temperature: number;
  readonly maxRepairRounds: number;
};

/**
 * UI-only provider/model/budget state. Never the document (`INV-ARCH-04`).
 *
 * @public
 */
export interface ProviderSettingsState extends StoredSettings {
  setRoleModel(role: keyof RoleModelMap, providerId: string, modelId: string): void;
  setCompatibleOrigin(origin: string): void;
  setBudget(field: BudgetField, value: number): void;
}

/**
 * Numeric budget fields editable in Settings.
 *
 * @public
 */
export type BudgetField =
  | "maxSteps"
  | "maxToolCallsPerStep"
  | "maxInputTokens"
  | "timeoutMs"
  | "temperature"
  | "maxRepairRounds";

function isJsonObject(value: unknown): value is { readonly [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function defaults(): StoredSettings {
  return {
    roles: emptyRoleModels(),
    compatibleOrigin: "",
    maxSteps: SETTINGS_RUN_POLICY_DEFAULTS.maxSteps,
    maxToolCallsPerStep: SETTINGS_RUN_POLICY_DEFAULTS.maxToolCallsPerStep,
    maxInputTokens: SETTINGS_RUN_POLICY_DEFAULTS.maxInputTokens,
    timeoutMs: SETTINGS_RUN_POLICY_DEFAULTS.timeoutMs,
    temperature: SETTINGS_RUN_POLICY_DEFAULTS.temperature,
    maxRepairRounds: SETTINGS_RUN_POLICY_DEFAULTS.maxRepairRounds,
  };
}

function readNumber(
  record: { readonly [key: string]: unknown },
  key: string,
  fallback: number,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return fallback;
  }
  return value;
}

function readRoles(record: { readonly [key: string]: unknown }): RoleModelMap {
  const fallback = emptyRoleModels();
  const raw = record["roles"];
  if (!isJsonObject(raw)) {
    return fallback;
  }
  let next: RoleModelMap = fallback;
  for (const key of ROLE_MODEL_KEYS) {
    const entry = raw[key];
    if (!isJsonObject(entry)) {
      continue;
    }
    const providerId = entry["providerId"];
    const modelId = entry["modelId"];
    if (typeof providerId !== "string" || typeof modelId !== "string") {
      continue;
    }
    next = { ...next, [key]: { providerId, modelId } };
  }
  return next;
}

/**
 * Reads persisted Settings. Missing or invalid JSON returns defaults (`02` §9).
 *
 * @example
 * ```ts
 * const snapshot = readStoredProviderSettings();
 * ```
 *
 * @public
 */
export function readStoredProviderSettings(): StoredSettings {
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
    const origin = parsed["compatibleOrigin"];
    return {
      roles: readRoles(parsed),
      compatibleOrigin: typeof origin === "string" ? origin : fallback.compatibleOrigin,
      maxSteps: readNumber(parsed, "maxSteps", fallback.maxSteps),
      maxToolCallsPerStep: readNumber(parsed, "maxToolCallsPerStep", fallback.maxToolCallsPerStep),
      maxInputTokens: readNumber(parsed, "maxInputTokens", fallback.maxInputTokens),
      timeoutMs: readNumber(parsed, "timeoutMs", fallback.timeoutMs),
      temperature: readNumber(parsed, "temperature", fallback.temperature),
      maxRepairRounds: readNumber(parsed, "maxRepairRounds", fallback.maxRepairRounds),
    };
  } catch {
    return fallback;
  }
}

function persist(state: StoredSettings): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      roles: state.roles,
      compatibleOrigin: state.compatibleOrigin,
      maxSteps: state.maxSteps,
      maxToolCallsPerStep: state.maxToolCallsPerStep,
      maxInputTokens: state.maxInputTokens,
      timeoutMs: state.timeoutMs,
      temperature: state.temperature,
      maxRepairRounds: state.maxRepairRounds,
    }),
  );
}

/**
 * Zustand store for Settings (`INV-ARCH-04`).
 *
 * @public
 */
export const useProviderSettingsStore = create<ProviderSettingsState>((set) => ({
  ...readStoredProviderSettings(),
  setRoleModel(role, providerId, modelId) {
    set((state) => {
      const next = {
        ...state,
        roles: { ...state.roles, [role]: { providerId, modelId } },
      };
      persist(next);
      return next;
    });
  },
  setCompatibleOrigin(origin) {
    set((state) => {
      const next = { ...state, compatibleOrigin: origin };
      persist(next);
      return next;
    });
  },
  setBudget(field, value) {
    set((state) => {
      const next = { ...state, [field]: value };
      persist(next);
      return next;
    });
  },
}));
