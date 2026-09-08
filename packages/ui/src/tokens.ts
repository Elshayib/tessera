/**
 * Design tokens as CSS custom properties (`01` §5). Q-0060 documents the set.
 *
 * @public
 */
export const TOKEN_ACCENT = "--t-color-accent";

/**
 * `:root` rules for the documented `--t-…` set.
 *
 * @public
 */
export const TOKENS_CSS = `:root {
  ${TOKEN_ACCENT}: #3b6cff;
  --t-color-bg: #12141a;
  --t-color-fg: #f2f4f8;
  --t-color-muted: #9aa3b5;
  --t-color-border: #2a3140;
  --t-space-1: 0.25rem;
  --t-space-2: 0.5rem;
  --t-font-sans: "Segoe UI", system-ui, sans-serif;
  --t-radius: 4px;
  --t-focus: 2px solid var(${TOKEN_ACCENT});
}
`;
