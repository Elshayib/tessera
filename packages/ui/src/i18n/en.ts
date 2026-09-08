/**
 * English UI strings (`01` §9). Ticket T-0112 places this file at `i18n/en.ts` (Q-0061).
 *
 * @public
 */
export const en = {
  shell: {
    viewport: "Viewport",
    outliner: "Outliner",
    inspector: "Inspector",
    chat: "Chat",
    widenOutliner: "Widen outliner",
    narrowOutliner: "Narrow outliner",
    widenInspector: "Widen inspector",
    narrowInspector: "Narrow inspector",
    tallerChat: "Taller chat",
    shorterChat: "Shorter chat",
  },
  errors: {
    INVALID_INPUT: "That input is not valid. Check the field and try again.",
    NOT_FOUND: "The requested item was not found.",
    CONFLICT: "That change conflicts with the current document. Undo or retry.",
    INVARIANT_VIOLATION: "The document is in an unexpected state. Undo the last change.",
    PERMISSION_DENIED: "You do not have permission to do that.",
    UNSUPPORTED: "That action is not available in this version.",
    CANCELLED: "The operation was cancelled.",
    TIMEOUT: "The operation timed out. Try again.",
    PROVIDER_ERROR: "A connected provider failed. Check settings and try again.",
    IO_ERROR: "A file or storage operation failed. Check disk access and try again.",
    BUDGET_EXCEEDED: "The agent budget for this run was exceeded.",
    RATE_LIMITED: "The provider rate limit was hit. Wait and try again.",
  },
} as const;
