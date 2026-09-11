import { createUsageLedger } from "@tessera/agent/observability";
import { createDocument, fromYDoc } from "@tessera/core";
import type { LlmClient, ProviderRegistry } from "@tessera/llm";
import { ok } from "@tessera/std";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { en } from "../i18n/en.js";
import { createMemoryKeyVault } from "./memory-vault.js";
import { emptyRoleModels } from "./models.js";
import { SETTINGS_RUN_POLICY_DEFAULTS } from "./policy.js";
import { SettingsPanel, UNENCRYPTED_VAULT_WARNING } from "./settings.js";
import { useProviderSettingsStore } from "./settings-store.js";

const CANARY = "sk-canary-secret-value";

function stubClient(): LlmClient {
  return {
    provider: {
      id: "openai-compatible",
      displayName: "OpenAI-compatible",
      auth: "apiKey",
      baseUrl: { configurable: true },
      browserDirect: "yes",
      listsModels: true,
      docsUrl: "https://example.invalid",
    },
    async listModels() {
      return ok([]);
    },
    async generate() {
      return ok({
        message: { role: "assistant", parts: [{ kind: "text", text: "" }] },
        usage: { inputTokens: 0, outputTokens: 0 },
        finishReason: "stop",
        modelId: "m",
      });
    },
    async *stream() {},
    async testConnection() {
      return ok({ latencyMs: 1 });
    },
  };
}

function stubRegistry(): ProviderRegistry {
  const client = stubClient();
  return {
    register() {},
    descriptors() {
      return [client.provider];
    },
    client() {
      return ok(client);
    },
  };
}

async function renderSettings(vaultEncrypted: boolean): Promise<{
  host: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
  vault: ReturnType<typeof createMemoryKeyVault>;
}> {
  useProviderSettingsStore.setState({
    roles: emptyRoleModels(),
    compatibleOrigin: "",
    maxSteps: SETTINGS_RUN_POLICY_DEFAULTS.maxSteps,
    maxToolCallsPerStep: SETTINGS_RUN_POLICY_DEFAULTS.maxToolCallsPerStep,
    maxInputTokens: SETTINGS_RUN_POLICY_DEFAULTS.maxInputTokens,
    timeoutMs: SETTINGS_RUN_POLICY_DEFAULTS.timeoutMs,
    temperature: SETTINGS_RUN_POLICY_DEFAULTS.temperature,
    maxRepairRounds: SETTINGS_RUN_POLICY_DEFAULTS.maxRepairRounds,
  });
  const vault = createMemoryKeyVault();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(SettingsPanel, {
        vault,
        vaultEncrypted,
        usage: createUsageLedger(),
        registry: stubRegistry(),
      }),
    );
  });
  return { host, root, vault };
}

test("vault warning shown when unencrypted", async () => {
  const { host, root } = await renderSettings(false);
  expect(host.textContent?.includes(UNENCRYPTED_VAULT_WARNING)).toBe(true);
  expect(host.textContent?.includes("OLLAMA_ORIGINS")).toBe(true);
  await act(async () => {
    root.unmount();
  });
});

test("SEC-02 openai-compatible origin visible", async () => {
  const { host, root } = await renderSettings(true);
  await act(async () => {
    useProviderSettingsStore.getState().setCompatibleOrigin("https://lmstudio.example");
  });
  expect(host.textContent?.includes("https://lmstudio.example")).toBe(true);
  await act(async () => {
    root.unmount();
  });
});

test("INV-ARCH-04 provider settings not in document snapshot", async () => {
  const created = createDocument();
  const { host, root, vault } = await renderSettings(true);
  const openaiKey = host.querySelectorAll('input[type="password"]')[0];
  expect(openaiKey !== undefined).toBe(true);
  if (openaiKey === undefined) {
    return;
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(openaiKey, CANARY);
    openaiKey.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const save = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.settings.saveKey,
  );
  expect(save !== undefined).toBe(true);
  if (save === undefined) {
    return;
  }
  await act(async () => {
    save.click();
  });
  const stored = await vault.get("openai");
  expect(stored.ok).toBe(true);
  const snapshot = JSON.stringify(fromYDoc(created.doc.ydoc));
  expect(snapshot.includes(CANARY)).toBe(false);
  await act(async () => {
    root.unmount();
  });
});

test("keys not present in rendered text after set", async () => {
  const { host, root } = await renderSettings(true);
  const openaiKey = host.querySelectorAll('input[type="password"]')[0];
  expect(openaiKey !== undefined).toBe(true);
  if (openaiKey === undefined) {
    return;
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(openaiKey, CANARY);
    openaiKey.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const save = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.settings.saveKey,
  );
  expect(save !== undefined).toBe(true);
  if (save === undefined) {
    return;
  }
  await act(async () => {
    save.click();
  });
  expect(host.textContent?.includes(CANARY)).toBe(false);
  await act(async () => {
    root.unmount();
  });
});
