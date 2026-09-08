import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { en } from "./i18n/en.js";
import { Shell } from "./shell.js";
import { TOKEN_ACCENT } from "./tokens.js";

test("shell renders regions", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<Shell />);
  });
  const labels = [en.shell.viewport, en.shell.outliner, en.shell.inspector, en.shell.chat];
  for (const label of labels) {
    expect(host.querySelector(`[aria-label="${label}"]`)).not.toBeNull();
  }
  const canvas = host.querySelector("canvas");
  expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  expect(host.innerHTML.includes(TOKEN_ACCENT)).toBe(true);
  const labelsWanted = [
    en.shell.widenOutliner,
    en.shell.narrowOutliner,
    en.shell.widenInspector,
    en.shell.narrowInspector,
    en.shell.tallerChat,
    en.shell.shorterChat,
  ];
  for (const name of labelsWanted) {
    const button = [...host.querySelectorAll("button")].find((node) => node.textContent === name);
    expect(button).toBeDefined();
    if (button !== undefined) {
      await act(async () => {
        button.click();
      });
    }
  }
  await act(async () => {
    root.unmount();
  });
});
