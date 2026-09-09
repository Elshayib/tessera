import type { RunRequest } from "@tessera/agent/observability";
import { createMemoryTranscriptStore, createUsageLedger } from "@tessera/agent/observability";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { en } from "../i18n/en.js";
import { ChatPanel } from "./chat-panel.js";

const profile = {
  ref: { providerId: "openai", modelId: "m" },
  tools: "native" as const,
  parallelTools: false,
  vision: false,
  structuredOutput: false,
  streaming: false,
  contextTokens: 32_000,
  maxOutputTokens: 4_000,
  maxTools: 64,
  needsExamples: false,
};

function emptyReport(remainingIssues: readonly string[] = []) {
  return {
    summary: "done",
    transactions: [],
    changeSet: {
      entities: { created: [], deleted: [], updated: [] },
      assets: { created: [], deleted: [], updated: [] },
      behaviors: { created: [], deleted: [], updated: [] },
      summary: "",
    },
    verification: { spatial: null, vision: null },
    remainingIssues,
    suggestions: [],
  };
}

function fakeRuntime(log: { readonly cancel: string[]; readonly requests: RunRequest[] }) {
  return {
    cancel(runId: string) {
      log.cancel.push(runId);
    },
    async *run(request: RunRequest) {
      log.requests.push(request);
      yield {
        type: "run.started" as const,
        runId: "r_testrun001",
        models: { planner: profile.ref, executor: profile.ref, critic: profile.ref },
        profile,
      };
      yield { type: "step.started" as const, stepIndex: 0, role: "executor" as const };
      yield { type: "model.delta" as const, stepIndex: 0, text: "hello" };
      yield {
        type: "run.completed" as const,
        report: emptyReport(["ask_user: confirm delete?"]),
        usage: { inputTokens: 3, outputTokens: 1 },
      };
    },
  };
}

test("INV-ARCH-04 chat state not in document", () => {
  const sources = import.meta.glob("./*.{ts,tsx}", {
    eager: true,
    query: "?raw",
    import: "default",
  });
  for (const [path, source] of Object.entries(sources)) {
    if (path.includes(".test.")) {
      continue;
    }
    expect(typeof source).toBe("string");
    if (typeof source !== "string") {
      continue;
    }
    expect(source.includes("ydoc"), path).toBe(false);
    expect(source.includes("fromYDoc"), path).toBe(false);
    expect(source.includes("@tessera/providers-llm"), path).toBe(false);
  }
});

test("chat streams run events and cancel", async () => {
  const log = { cancel: [] as string[], requests: [] as RunRequest[] };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(ChatPanel, {
        transcripts: createMemoryTranscriptStore(),
        usage: createUsageLedger(),
        projectId: "p_local00000",
        conversationId: "c_local",
        runtime: fakeRuntime(log),
        selection: ["e_abcdefghij"],
      }),
    );
  });
  const textarea = host.querySelector("textarea");
  expect(textarea !== null).toBe(true);
  if (textarea === null) {
    return;
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, "place a box");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const send = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.chat.send,
  );
  expect(send !== undefined).toBe(true);
  if (send === undefined) {
    return;
  }
  await act(async () => {
    send.click();
  });
  expect(log.requests[0]?.prompt).toBe("place a box");
  expect(log.requests[0]?.context.selection).toEqual(["e_abcdefghij"]);
  expect(host.textContent?.includes("hello")).toBe(true);
  expect(host.textContent?.includes(en.chat.tokens)).toBe(true);
  const cancel = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.chat.cancel,
  );
  expect(cancel !== undefined).toBe(true);
  if (cancel === undefined) {
    return;
  }
  await act(async () => {
    cancel.click();
  });
  expect(log.cancel).toEqual(["r_testrun001"]);
  const confirm = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.chat.confirmAsk,
  );
  expect(confirm !== undefined).toBe(true);
  if (confirm === undefined) {
    return;
  }
  await act(async () => {
    confirm.click();
  });
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, "again");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    send.click();
  });
  expect(log.requests[1]?.policy?.confirmDestructive).toBe(true);
  const showTrace = [...host.querySelectorAll("button")].find(
    (node) => node.textContent === en.chat.showTrace,
  );
  expect(showTrace !== undefined).toBe(true);
  if (showTrace === undefined) {
    return;
  }
  await act(async () => {
    showTrace.click();
  });
  expect(host.textContent?.includes("run")).toBe(true);
  await act(async () => {
    root.unmount();
  });
});
