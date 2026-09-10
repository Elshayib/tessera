import { afterEach, expect, test } from "vitest";
import { installFetchGuard, isLoopbackFetchUrl } from "./fetch-guard.js";

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

test("INV-TST-01 fetch guard rejects non-loopback", async () => {
  restore = installFetchGuard();
  await expect(globalThis.fetch("https://api.openai.com/v1/models")).rejects.toThrow(
    "INV-TST-01 fetch guard rejected non-loopback host",
  );
  await expect(globalThis.fetch(new URL("https://api.anthropic.com"))).rejects.toThrow(
    "non-loopback",
  );
  await expect(
    globalThis.fetch(new Request("https://generativelanguage.googleapis.com")),
  ).rejects.toThrow("non-loopback");
  expect(isLoopbackFetchUrl("http://127.0.0.1:11434/v1")).toBe(true);
  expect(isLoopbackFetchUrl("http://localhost:11434")).toBe(true);
  expect(isLoopbackFetchUrl("http://[::1]/")).toBe(true);
  expect(isLoopbackFetchUrl("not a url")).toBe(false);
});

test("INV-TST-01 fetch guard allows loopback", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response("ok");
  restore = () => {
    globalThis.fetch = previous;
  };
  const uninstall = installFetchGuard();
  const response = await globalThis.fetch("http://127.0.0.1:9/");
  expect(await response.text()).toBe("ok");
  uninstall();
});
