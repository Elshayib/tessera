import { expect, test } from "vitest";
import { TOKEN_ACCENT, TOKENS_CSS } from "./tokens.js";

test("tokens include documented accent variable", () => {
  expect(TOKEN_ACCENT).toBe("--t-color-accent");
  expect(TOKENS_CSS.includes("--t-color-accent")).toBe(true);
  expect(TOKENS_CSS.includes("--t-color-bg")).toBe(true);
});
