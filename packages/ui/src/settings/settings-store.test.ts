import { emptyDocument } from "@tessera/schema";
import { expect, test } from "vitest";
import { emptyRoleModels } from "./models.js";
import { SETTINGS_RUN_POLICY_DEFAULTS } from "./policy.js";
import {
  readStoredProviderSettings,
  SETTINGS_STORAGE_KEY,
  useProviderSettingsStore,
} from "./settings-store.js";

test("provider settings round-trip through localStorage", () => {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  useProviderSettingsStore.getState().setRoleModel("executor", "openrouter", "openrouter/free");
  useProviderSettingsStore.getState().setRoleModel("planner", "openrouter", "openrouter/free");
  useProviderSettingsStore.getState().setRoleModel("critic", "openrouter", "");
  useProviderSettingsStore.getState().setCompatibleOrigin("https://lmstudio.example");
  useProviderSettingsStore.getState().setBudget("maxSteps", 8);
  const stored = readStoredProviderSettings();
  expect(stored.roles.executor).toEqual({
    providerId: "openrouter",
    modelId: "openrouter/free",
  });
  expect(stored.roles.planner.providerId).toBe("openrouter");
  expect(stored.roles.critic.modelId).toBe("");
  expect(stored.compatibleOrigin).toBe("https://lmstudio.example");
  expect(stored.maxSteps).toBe(8);
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  expect(raw !== null).toBe(true);
  if (raw === null) {
    return;
  }
  expect(raw.includes("sk-")).toBe(false);
});

test("malformed settings storage keeps defaults", () => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, "{not-json");
  const stored = readStoredProviderSettings();
  expect(stored.roles).toEqual(emptyRoleModels());
  expect(stored.maxSteps).toBe(SETTINGS_RUN_POLICY_DEFAULTS.maxSteps);
  expect(stored.timeoutMs).toBe(SETTINGS_RUN_POLICY_DEFAULTS.timeoutMs);
  expect(stored.temperature).toBe(SETTINGS_RUN_POLICY_DEFAULTS.temperature);
  expect(stored.compatibleOrigin).toBe("");
});

test("INV-ARCH-04 provider settings storage is not a document field", () => {
  const document = emptyDocument();
  expect(JSON.stringify(document).includes("tessera.ui.settings")).toBe(false);
});
