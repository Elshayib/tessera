# ADR-0008 — Local-first, zero backend

Status: Accepted · Date: 2026-09-06

## Context
The project must run with a $0 infrastructure budget, respect user privacy, and remain fully usable if the maintainers disappear. Hosted backends also make "bring your own key" a liability (keys transiting a server).

## Decision
- The web app is a static site. Projects, blobs, keys, transcripts and settings live on the user's machine (IndexedDB/OPFS or files).
- Provider calls go browser → provider directly where CORS allows, otherwise through the desktop app's loopback proxy or a user-deployed proxy template. Tessera never operates a proxy.
- Collaboration defaults to P2P (y-webrtc); a self-hostable room server is provided as a container.
- Generation workers are self-hostable via a public HTTP contract.

## Alternatives
- Hosted API gateway with per-user accounts: rejected (cost, liability, lock-in, contradicts openness).
- Electron-only desktop app: rejected (loses zero-install web access and shareable links).

## Consequences
- Some providers are unusable from the pure web app without a proxy; the desktop app solves this.
- No usage analytics; product decisions rely on evals, issues and explicit user feedback.
- Storage quotas and persistence must be handled carefully (`08 §4`).
