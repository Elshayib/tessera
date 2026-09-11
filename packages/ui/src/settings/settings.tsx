import type { UsageLedger } from "@tessera/agent/observability";
import type { KeyVault, LlmClient, ProviderDescriptor, ProviderRegistry } from "@tessera/llm";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { en } from "../i18n/en.js";
import { ROLE_MODEL_KEYS } from "./models.js";
import { BUILTIN_DESCRIPTORS, ORIGIN_EDITABLE_PROVIDER_ID, originFor } from "./providers.js";
import { useProviderSettingsStore } from "./settings-store.js";

/**
 * Spec warning when the vault has no passphrase (`07` §6).
 *
 * @public
 */
export const UNENCRYPTED_VAULT_WARNING =
  "anyone with access to this browser profile can read your keys" as const;

/**
 * Settings panel props. Keys go to {@link KeyVault}; UI state is not the document.
 *
 * @public
 */
export interface SettingsPanelProps {
  readonly vault: KeyVault;
  readonly vaultEncrypted: boolean;
  readonly usage: UsageLedger;
  readonly descriptors?: readonly ProviderDescriptor[];
  readonly registry?: ProviderRegistry;
}

/**
 * BYOK providers, role models, budgets, and usage (`07` §4–§7).
 *
 * @example
 * ```tsx
 * <SettingsPanel vault={vault} vaultEncrypted={false} usage={ledger} />
 * ```
 *
 * @public
 */
export function SettingsPanel(props: SettingsPanelProps): ReactElement {
  const descriptors = props.descriptors ?? BUILTIN_DESCRIPTORS;
  const compatibleOrigin = useProviderSettingsStore((state) => state.compatibleOrigin);
  const roles = useProviderSettingsStore((state) => state.roles);
  const setRoleModel = useProviderSettingsStore((state) => state.setRoleModel);
  const setCompatibleOrigin = useProviderSettingsStore((state) => state.setCompatibleOrigin);
  const maxSteps = useProviderSettingsStore((state) => state.maxSteps);
  const maxToolCallsPerStep = useProviderSettingsStore((state) => state.maxToolCallsPerStep);
  const maxInputTokens = useProviderSettingsStore((state) => state.maxInputTokens);
  const timeoutMs = useProviderSettingsStore((state) => state.timeoutMs);
  const temperature = useProviderSettingsStore((state) => state.temperature);
  const maxRepairRounds = useProviderSettingsStore((state) => state.maxRepairRounds);
  const setBudget = useProviderSettingsStore((state) => state.setBudget);
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [passphrase, setPassphrase] = useState("");
  const [models, setModels] = useState<readonly string[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);
  const monthly = props.usage.monthlyByProvider();

  const saveKey = async (providerId: string): Promise<void> => {
    const secret = draftKeys[providerId] ?? "";
    if (secret.length === 0) {
      return;
    }
    await props.vault.set(providerId, secret);
    setDraftKeys((current) => ({ ...current, [providerId]: "" }));
  };

  const onUnlock = (event: FormEvent): void => {
    event.preventDefault();
    void props.vault.unlock(passphrase);
  };

  return (
    <section aria-label={en.settings.title}>
      <h2>{en.settings.title}</h2>
      {props.vaultEncrypted ? null : <p>{UNENCRYPTED_VAULT_WARNING}</p>}
      {props.vault.locked ? (
        <form onSubmit={onUnlock}>
          <label>
            {en.settings.passphrase}
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
          <button type="submit">{en.settings.unlock}</button>
        </form>
      ) : null}
      {descriptors.map((descriptor) => (
        <article key={descriptor.id} aria-label={descriptor.displayName}>
          <h3>{descriptor.displayName}</h3>
          <p>
            {en.settings.origin}: {originFor(descriptor, compatibleOrigin)}
          </p>
          {descriptor.id === ORIGIN_EDITABLE_PROVIDER_ID ? (
            <label>
              {en.settings.origin}
              <input
                value={compatibleOrigin}
                onChange={(event) => setCompatibleOrigin(event.target.value)}
              />
            </label>
          ) : null}
          {descriptor.id === "ollama" ? <p>{en.settings.ollamaOrigins}</p> : null}
          {descriptor.auth === "apiKey" ? (
            <label>
              {en.settings.apiKey}
              <input
                type="password"
                autoComplete="off"
                value={draftKeys[descriptor.id] ?? ""}
                onChange={(event) =>
                  setDraftKeys((current) => ({ ...current, [descriptor.id]: event.target.value }))
                }
              />
            </label>
          ) : null}
          {descriptor.auth === "apiKey" ? (
            <button type="button" onClick={() => void saveKey(descriptor.id)}>
              {en.settings.saveKey}
            </button>
          ) : null}
          {descriptor.auth === "apiKey" ? (
            <button
              type="button"
              onClick={() => {
                void props.vault.delete(descriptor.id);
              }}
            >
              {en.settings.deleteKey}
            </button>
          ) : null}
          {descriptor.listsModels ? (
            <button
              type="button"
              onClick={() => {
                void listFromRegistry(props.registry, descriptor.id, setModels);
              }}
            >
              {en.settings.listModels}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void testFromRegistry(props.registry, descriptor.id, setLatencyMs);
            }}
          >
            {en.settings.testConnection}
          </button>
        </article>
      ))}
      {models.map((id) => (
        <p key={id}>{id}</p>
      ))}
      {latencyMs === undefined ? null : (
        <p>
          {en.settings.latency}: {String(latencyMs)}
        </p>
      )}
      <fieldset>
        <legend>{en.settings.models}</legend>
        {ROLE_MODEL_KEYS.map((role) => (
          <label key={role}>
            {role}
            <input
              aria-label={role}
              value={`${roles[role].providerId}/${roles[role].modelId}`}
              onChange={(event) => {
                const [providerId, modelId] = splitRef(event.target.value);
                setRoleModel(role, providerId, modelId);
              }}
            />
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{en.settings.budgets}</legend>
        <label>
          {en.settings.maxSteps}
          <input
            type="number"
            value={maxSteps}
            onChange={(event) => setBudget("maxSteps", Number(event.target.value))}
          />
        </label>
        <label>
          {en.settings.maxToolCallsPerStep}
          <input
            type="number"
            value={maxToolCallsPerStep}
            onChange={(event) => setBudget("maxToolCallsPerStep", Number(event.target.value))}
          />
        </label>
        <label>
          {en.settings.maxInputTokens}
          <input
            type="number"
            value={maxInputTokens}
            onChange={(event) => setBudget("maxInputTokens", Number(event.target.value))}
          />
        </label>
        <label>
          {en.settings.timeoutMs}
          <input
            type="number"
            value={timeoutMs}
            onChange={(event) => setBudget("timeoutMs", Number(event.target.value))}
          />
        </label>
        <label>
          {en.settings.temperature}
          <input
            type="number"
            value={temperature}
            onChange={(event) => setBudget("temperature", Number(event.target.value))}
          />
        </label>
        <label>
          {en.settings.maxRepairRounds}
          <input
            type="number"
            value={maxRepairRounds}
            onChange={(event) => setBudget("maxRepairRounds", Number(event.target.value))}
          />
        </label>
      </fieldset>
      <section aria-label={en.settings.usage}>
        {Object.entries(monthly).map(([providerId, totals]) => (
          <p key={providerId}>
            {providerId}: {String(totals.inputTokens + totals.outputTokens)} /{" "}
            {String(totals.costUsd)}
          </p>
        ))}
      </section>
    </section>
  );
}

function splitRef(value: string): readonly [string, string] {
  const index = value.indexOf("/");
  if (index === -1) {
    return ["openai", value];
  }
  return [value.slice(0, index), value.slice(index + 1)];
}

async function listFromRegistry(
  registry: ProviderRegistry | undefined,
  providerId: string,
  setModels: (ids: readonly string[]) => void,
): Promise<void> {
  const client = clientOf(registry, providerId);
  if (client === undefined) {
    return;
  }
  const listed = await client.listModels();
  if (!listed.ok) {
    return;
  }
  setModels(listed.value.map((model) => model.ref.modelId));
}

async function testFromRegistry(
  registry: ProviderRegistry | undefined,
  providerId: string,
  setLatencyMs: (ms: number) => void,
): Promise<void> {
  const client = clientOf(registry, providerId);
  if (client === undefined) {
    return;
  }
  const tested = await client.testConnection();
  if (!tested.ok) {
    return;
  }
  setLatencyMs(tested.value.latencyMs);
}

function clientOf(
  registry: ProviderRegistry | undefined,
  providerId: string,
): LlmClient | undefined {
  if (registry === undefined) {
    return undefined;
  }
  const client = registry.client(providerId);
  if (!client.ok) {
    return undefined;
  }
  return client.value;
}
