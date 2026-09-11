import {
  buildRunTrace,
  type CapabilityProfile,
  defaultRunPolicy,
  type RunEvent,
  type RunRequest,
  type TranscriptStore,
  type UsageLedger,
  type ViewportCamera,
} from "@tessera/agent/observability";
import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { en } from "../i18n/en.js";
import { TraceView } from "./trace-view.js";

/**
 * Chat panel props. UI-only state (`INV-ARCH-04`).
 *
 * @public
 */
export interface ChatPanelProps {
  readonly transcripts: TranscriptStore;
  readonly usage: UsageLedger;
  readonly projectId: string;
  readonly conversationId: string;
  readonly runtime?: {
    run(request: RunRequest, signal?: AbortSignal): AsyncIterable<RunEvent>;
    cancel(runId: string): void;
  };
  readonly selection?: readonly string[];
  readonly focusedEntity?: string;
  readonly viewportCamera?: ViewportCamera;
  readonly clockNow?: () => string;
  readonly onExportJson?: (json: string) => void;
}

const FALLBACK_PROFILE: CapabilityProfile = {
  ref: { providerId: "unknown", modelId: "unknown" },
  tools: "native",
  parallelTools: false,
  vision: false,
  structuredOutput: false,
  streaming: false,
  contextTokens: 32_000,
  maxOutputTokens: 4_000,
  maxTools: 64,
  needsExamples: false,
};

/**
 * Streams {@link AgentRuntime.run} into a project-local transcript (`06` §13).
 *
 * @example
 * ```tsx
 * <ChatPanel transcripts={store} usage={ledger} projectId="p" conversationId="c" />
 * ```
 *
 * @public
 */
export function ChatPanel(props: ChatPanelProps): ReactElement {
  const [prompt, setPrompt] = useState("");
  const [working, setWorking] = useState(false);
  const [runId, setRunId] = useState<string | undefined>(undefined);
  const [streamText, setStreamText] = useState("");
  const [issues, setIssues] = useState<readonly string[]>([]);
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [traceSpans, setTraceSpans] = useState<
    readonly { readonly name: string; readonly start: number; readonly end: number }[]
  >([]);
  const [attachment, setAttachment] = useState<File | undefined>(undefined);
  const [tokens, setTokens] = useState(0);
  const [costUsd, setCostUsd] = useState(0);
  const now = props.clockNow ?? (() => new Date().toISOString());

  const runPrompt = async (): Promise<void> => {
    const text = prompt.trim();
    if (text.length === 0 || working) {
      return;
    }
    setWorking(true);
    setStreamText("");
    const createdAt = now();
    await props.transcripts.append(props.conversationId, [
      {
        id: crypto.randomUUID(),
        conversationId: props.conversationId,
        projectId: props.projectId,
        message: { role: "user", parts: [{ kind: "text", text }] },
        createdAt,
      },
    ]);
    const runtime = props.runtime;
    if (runtime === undefined) {
      setWorking(false);
      setPrompt("");
      return;
    }
    const attachments = attachment === undefined ? undefined : await imageAttachments(attachment);
    const request = {
      conversationId: props.conversationId,
      prompt: text,
      context: {
        selection: props.selection ?? [],
        ...(props.viewportCamera === undefined ? {} : { viewportCamera: props.viewportCamera }),
        ...(props.focusedEntity === undefined ? {} : { focusedEntity: props.focusedEntity }),
      },
      policy: { confirmDestructive },
      ...(attachments === undefined ? {} : { attachments }),
    };
    const events = [];
    let activeRun = "r_unknown000";
    for await (const event of runtime.run(request)) {
      events.push(event);
      if (event.type === "run.started") {
        activeRun = event.runId;
        setRunId(event.runId);
      }
      if (event.type === "model.delta") {
        setStreamText((current) => `${current}${event.text}`);
      }
      if (
        event.type === "run.completed" ||
        event.type === "run.failed" ||
        event.type === "run.cancelled"
      ) {
        props.usage.record({
          runId: activeRun,
          conversationId: props.conversationId,
          projectId: props.projectId,
          providerId: "unknown",
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
          costUsd: 0,
        });
        const live = props.usage.forRun(activeRun);
        setTokens(live.inputTokens + live.outputTokens);
        setCostUsd(live.costUsd);
      }
      if (event.type === "run.completed") {
        setIssues(event.report.remainingIssues);
        await props.transcripts.append(props.conversationId, [
          {
            id: crypto.randomUUID(),
            conversationId: props.conversationId,
            projectId: props.projectId,
            runId: activeRun,
            message: {
              role: "assistant",
              parts: [{ kind: "text", text: event.report.summary }],
            },
            createdAt: now(),
          },
        ]);
      }
    }
    const trace = buildRunTrace({
      events,
      conversationId: props.conversationId,
      startedAt: createdAt,
      endedAt: now(),
      policy: defaultRunPolicy(FALLBACK_PROFILE, false),
      fallbackProfile: FALLBACK_PROFILE,
    });
    await props.transcripts.recordTrace(trace);
    setTraceSpans(trace.spans);
    setWorking(false);
    setPrompt("");
    setAttachment(undefined);
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void runPrompt();
  };

  return (
    <section aria-label={en.chat.title}>
      <header>
        <span>
          {en.chat.tokens}: {String(tokens)}
        </span>
        <span>
          {en.chat.costUsd}: {String(costUsd)}
        </span>
        <button type="button" onClick={() => setShowTrace((value) => !value)}>
          {en.chat.showTrace}
        </button>
        <button
          type="button"
          onClick={() => {
            void exportCurrentRun(props, runId);
          }}
        >
          {en.chat.exportRun}
        </button>
      </header>
      <p>{streamText}</p>
      {issues.map((issue) => (
        <p key={issue}>
          {issue}
          <button
            type="button"
            onClick={() => {
              setConfirmDestructive(true);
              setIssues([]);
            }}
          >
            {en.chat.confirmAsk}
          </button>
        </p>
      ))}
      {showTrace ? <TraceView spans={traceSpans} /> : null}
      <form onSubmit={submit}>
        <label>
          {en.chat.prompt}
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void runPrompt();
              }
            }}
          />
        </label>
        <label>
          {en.chat.attach}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              setAttachment(event.target.files?.[0]);
            }}
          />
        </label>
        <button type="submit">{en.chat.send}</button>
        <button
          type="button"
          onClick={() => {
            if (runId !== undefined && props.runtime !== undefined) {
              props.runtime.cancel(runId);
            }
          }}
        >
          {en.chat.cancel}
        </button>
      </form>
    </section>
  );
}

async function exportCurrentRun(props: ChatPanelProps, runId: string | undefined): Promise<void> {
  if (runId === undefined) {
    return;
  }
  const exported = await props.transcripts.exportRun(runId);
  if (!exported.ok) {
    return;
  }
  props.onExportJson?.(JSON.stringify(exported.value));
}

async function imageAttachments(file: File): Promise<
  readonly {
    readonly kind: "image";
    readonly blob: { readonly hash: string; readonly size: number; readonly mime: string };
  }[]
> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return [
    {
      kind: "image",
      blob: {
        hash: `sha256-${hex}`,
        size: file.size,
        mime: file.type.length > 0 ? file.type : "image/png",
      },
    },
  ];
}
