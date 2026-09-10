import { expect, test } from "vitest";
import {
  assistantText,
  assistantToolCalls,
  systemMessage,
  toolResultMessage,
  userImage,
  userText,
} from "./index.js";

test("message builders produce LlmMessage parts from 07 §2", () => {
  expect(systemMessage("edit a document")).toEqual({
    role: "system",
    content: "edit a document",
  });
  expect(userText("add a cube")).toEqual({
    role: "user",
    parts: [{ kind: "text", text: "add a cube" }],
  });
  const png = new Uint8Array([1, 2, 3]);
  expect(userImage("image/png", png)).toEqual({
    role: "user",
    parts: [{ kind: "image", mime: "image/png", data: png }],
  });
  expect(assistantText("done")).toEqual({
    role: "assistant",
    parts: [{ kind: "text", text: "done" }],
  });
  expect(
    assistantToolCalls([{ kind: "toolCall", callId: "c1", name: "echo", input: { value: "ok" } }]),
  ).toEqual({
    role: "assistant",
    parts: [{ kind: "toolCall", callId: "c1", name: "echo", input: { value: "ok" } }],
  });
  expect(
    toolResultMessage([{ callId: "c1", name: "echo", result: { value: "ok" }, isError: false }]),
  ).toEqual({
    role: "tool",
    results: [{ callId: "c1", name: "echo", result: { value: "ok" }, isError: false }],
  });
});
