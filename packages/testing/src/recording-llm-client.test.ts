import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { systemMessage, userText } from "@tessera/llm";
import { expect, test } from "vitest";
import { FakeLlmClient } from "./fake-llm-client.js";
import {
  loadRecordingTexts,
  RECORDING_MAX_AGE_MS,
  RecordingLlmClient,
  scanRecordingsForSecrets,
  warnStaleRecordings,
} from "./recording-llm-client.js";

const MODEL = { providerId: "fake", modelId: "gpt-test" } as const;
const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/recordings");

test("RecordingLlmClient redacts keys and timestamps", async () => {
  const inner = FakeLlmClient.script([
    {
      respond: {
        text: "key sk-live-not-this because tool has apiKey at 2026-09-09T12:00:00.000Z req_abc99",
        toolCalls: [
          {
            kind: "toolCall",
            callId: "c1",
            name: "note",
            input: {
              apiKey: "sk-secretvalue999",
              when: "2026-09-09T12:00:00.000Z",
              id: "req_abc99",
            },
          },
        ],
      },
    },
  ]);
  const writes: { path: string; json: string }[] = [];
  const client = new RecordingLlmClient(inner, {
    suite: "core",
    caseId: "table",
    fixturesRoot: FIXTURES_ROOT,
    env: { TESSERA_RECORD: "1" },
    mkdir: async () => undefined,
    writeFile: async (path, json) => {
      writes.push({ path, json });
    },
  });
  const result = await client.generate({
    model: MODEL,
    messages: [userText("hello 2026-09-09T12:00:00.000Z")],
  });
  expect(result.ok).toBe(true);
  expect(writes).toHaveLength(1);
  const written = writes[0];
  if (written === undefined) {
    return;
  }
  expect(written.path).toContain(join("fake", "core", "table.gpt-test.json"));
  expect(written.json).toContain("[redacted]");
  expect(written.json).toContain("<ts>");
  expect(written.json).not.toContain("sk-secretvalue999");
  expect(written.json).not.toContain("2026-09-09T12:00:00.000Z");
});

test("RecordingLlmClient skips write without TESSERA_RECORD", async () => {
  const inner = FakeLlmClient.script([{ respond: { text: "ok" } }]);
  let wrote = false;
  const client = new RecordingLlmClient(inner, {
    suite: "core",
    caseId: "skip",
    fixturesRoot: FIXTURES_ROOT,
    env: { TESSERA_RECORD: "0" },
    writeFile: async () => {
      wrote = true;
    },
  });
  await client.generate({ model: MODEL, messages: [userText("x")] });
  expect(wrote).toBe(false);
});

test("INV-TST-04 fixture scan finds no secrets", async () => {
  const files = await loadRecordingTexts(FIXTURES_ROOT);
  expect(files.length).toBeGreaterThan(0);
  expect(scanRecordingsForSecrets(files)).toEqual([]);
  const committed = readFileSync(join(FIXTURES_ROOT, "fake", "t-0212", "sample.fake.json"), "utf8");
  expect(committed).toContain("[redacted]");
});

test("scanRecordingsForSecrets reports secret-like strings", () => {
  const hits = scanRecordingsForSecrets([
    { path: "bad.json", text: JSON.stringify({ token: "sk-abcdefghijk" }) },
  ]);
  expect(hits.length).toBeGreaterThan(0);
});

test("RecordingLlmClient writes fixtures on disk and stream", async () => {
  const dir = await mkdtemp(join(tmpdir(), "t-0212-"));
  try {
    const inner = FakeLlmClient.script([{ respond: { text: "ok" } }, { respond: { text: "ok2" } }]);
    const client = new RecordingLlmClient(inner, {
      suite: "core",
      caseId: "disk",
      fixturesRoot: dir,
      env: { TESSERA_RECORD: "1" },
    });
    const listed = await client.listModels();
    expect(listed.ok).toBe(true);
    const ping = await client.testConnection();
    expect(ping.ok).toBe(true);
    await client.generate({
      model: MODEL,
      messages: [systemMessage("sys"), userText("hello")],
    });
    const events = [];
    for await (const event of client.stream({ model: MODEL, messages: [userText("next")] })) {
      events.push(event.type);
    }
    expect(events).toEqual(["text.delta", "done"]);
    const texts = await loadRecordingTexts(dir);
    expect(texts.length).toBeGreaterThan(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadRecordingTexts ignores a missing root", async () => {
  expect(await loadRecordingTexts(join(FIXTURES_ROOT, "missing-root"))).toEqual([]);
});

test("recordings older than 180 days warn", () => {
  const messages: string[] = [];
  warnStaleRecordings([{ path: "old.json", mtimeMs: 0 }], RECORDING_MAX_AGE_MS + 1, (message) => {
    messages.push(message);
  });
  expect(messages).toEqual(["recording older than 180 days: old.json"]);
  const fresh: string[] = [];
  warnStaleRecordings([{ path: "new.json", mtimeMs: 10 }], 11, (message) => {
    fresh.push(message);
  });
  expect(fresh).toEqual([]);
});
