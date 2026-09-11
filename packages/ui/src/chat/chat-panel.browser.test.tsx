import type { RunRequest } from "@tessera/agent/observability";
import { createMemoryTranscriptStore, createUsageLedger } from "@tessera/agent/observability";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { ChatPanel } from "./chat-panel.js";

test("chat panel keyboard", async () => {
  const requests: RunRequest[] = [];
  const runtime = {
    cancel() {},
    async *run(request: RunRequest) {
      requests.push(request);
      yield {
        type: "run.completed" as const,
        report: {
          summary: "ok",
          transactions: [],
          changeSet: {
            entities: { created: [], deleted: [], updated: [] },
            assets: { created: [], deleted: [], updated: [] },
            behaviors: { created: [], deleted: [], updated: [] },
            summary: "",
          },
          verification: { spatial: null, vision: null },
          remainingIssues: [],
          suggestions: [],
        },
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    },
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <ChatPanel
        transcripts={createMemoryTranscriptStore()}
        usage={createUsageLedger()}
        projectId="p_local00000"
        conversationId="c_local"
        runtime={runtime}
      />,
    );
  });
  const textarea = host.querySelector("textarea");
  expect(textarea !== null).toBe(true);
  if (textarea === null) {
    return;
  }
  await act(async () => {
    textarea.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, "hello");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(requests[0]?.prompt).toBe("hello");
  expect(document.activeElement).toBe(textarea);
  await act(async () => {
    root.unmount();
  });
});
