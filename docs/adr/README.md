# Architecture Decision Records

ADRs record decisions with lasting consequences. They are numbered sequentially, written with `../templates/adr-template.md`, and never deleted. To change a decision, write a new ADR that supersedes the old one and update the old one's status line.

| ADR | Title | Status |
| --- | --- | --- |
| [0001](ADR-0001-languages.md) | Languages: TypeScript-first, Rust where it pays, WGSL via TSL | Accepted |
| [0002](ADR-0002-document-first-scene-model.md) | Document-first scene model (entity–component data, not code) | Accepted |
| [0003](ADR-0003-yjs-document-store.md) | Yjs as the document store from day one; fractional indexing for order | Accepted |
| [0004](ADR-0004-command-bus-and-structural-undo.md) | Command bus as the sole mutation path; structural per-author undo | Accepted |
| [0005](ADR-0005-threejs-webgpu-tsl.md) | three.js WebGPURenderer + TSL; vanilla three in the engine; React for panels only | Accepted |
| [0006](ADR-0006-zod-single-source-of-truth.md) | Zod 4 schemas as the single source of truth | Accepted |
| [0007](ADR-0007-provider-interface-split.md) | Interface packages separate from provider implementations | Accepted |
| [0008](ADR-0008-local-first-zero-backend.md) | Local-first, zero backend | Accepted |
| [0009](ADR-0009-gltf-sidecar-interchange.md) | glTF 2.0 + extras + sidecar as interchange, built with gltf-transform | Accepted |
| [0010](ADR-0010-mcp-mirrors-command-bus.md) | MCP server mirrors the command bus and runs inside the editor | Accepted |
| [0011](ADR-0011-licensing.md) | MIT core; GPL-3.0 isolated to the Blender add-on | Accepted |
| [0012](ADR-0012-monorepo-toolchain.md) | Monorepo toolchain | Accepted |
| [0013](ADR-0013-rotation-euler-degrees.md) | Rotation stored as Euler degrees XYZ in the document | Accepted |
| [0014](ADR-0014-units-axes-light-units.md) | Meters, Y-up, right-handed; physical light units | Accepted |
| [0015](ADR-0015-sandboxed-scripting-quickjs.md) | Sandboxed scripting via QuickJS in a worker | Accepted |
| [0016](ADR-0016-agent-review-model.md) | Agent changes apply live in reviewable run groups | Accepted |
