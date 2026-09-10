import { create } from "zustand";
import { emptyRoleModels, type RoleModelMap } from "./models.js";
import { SETTINGS_RUN_POLICY_DEFAULTS } from "./policy.js";

const STORAGE_KEY = "tessera.ui.settings";

/**
 * UI-only provider/model/budget state. Never the document (`INV-ARCH-04`).
 *
 * @public
 */
export interface ProviderSettingsState {
  readonly roles: RoleModelMap;
  readonly compatibleOrigin: string;
  readonly maxSteps: number;
  readonly maxToolCallsPerStep: number;
  readonly maxInputTokens: number;
  readonly timeoutMs: number;
  readonly temperature: number;
  readonly maxRepairRounds: number;
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

function persist(
  state: Omit<ProviderSettingsState, "setRoleModel" | "setCompatibleOrigin" | "setBudget">,
): void {
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
  roles: emptyRoleModels(),
  compatibleOrigin: "",
  maxSteps: SETTINGS_RUN_POLICY_DEFAULTS.maxSteps,
  maxToolCallsPerStep: SETTINGS_RUN_POLICY_DEFAULTS.maxToolCallsPerStep,
  maxInputTokens: SETTINGS_RUN_POLICY_DEFAULTS.maxInputTokens,
  timeoutMs: SETTINGS_RUN_POLICY_DEFAULTS.timeoutMs,
  temperature: SETTINGS_RUN_POLICY_DEFAULTS.temperature,
  maxRepairRounds: SETTINGS_RUN_POLICY_DEFAULTS.maxRepairRounds,
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
