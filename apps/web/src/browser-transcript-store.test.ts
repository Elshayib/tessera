import "fake-indexeddb/auto";
import { userText } from "@tessera/llm";
import { isOk } from "@tessera/std";
import { afterEach, expect, test } from "vitest";
import { createBrowserTranscriptStore } from "./browser-transcript-store.js";

const DB_NAME = "tessera-transcripts";

afterEach(async () => {
  await Promise.race([
    new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        resolve();
      };
      request.onblocked = () => {
        resolve();
      };
      request.onerror = () => {
        resolve();
      };
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    }),
  ]);
});

const entry = {
  id: "e1",
  conversationId: "c_editor",
  projectId: "p_local00000",
  message: userText("hello"),
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("browser transcripts persist across façade instances", async () => {
  const first = createBrowserTranscriptStore();
  const stored = await first.append("c_editor", [entry]);
  expect(isOk(stored)).toBe(true);
  const second = createBrowserTranscriptStore();
  const listed = await second.listConversations("p_local00000");
  expect(isOk(listed)).toBe(true);
  if (!isOk(listed)) {
    return;
  }
  expect(listed.value[0]?.conversationId).toBe("c_editor");
});

test("browser transcripts fall back to memory when open fails", async () => {
  const store = createBrowserTranscriptStore({
    open: async () => ({
      ok: false,
      error: { code: "UNSUPPORTED", message: "no indexeddb" },
    }),
  });
  const stored = await store.append("c_editor", [entry]);
  expect(isOk(stored)).toBe(true);
  const listed = await store.listConversations("p_local00000");
  expect(isOk(listed)).toBe(true);
  if (!isOk(listed)) {
    return;
  }
  expect(listed.value[0]?.conversationId).toBe("c_editor");
});
