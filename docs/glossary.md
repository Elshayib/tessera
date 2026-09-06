# Glossary

Use these words exactly, in code identifiers, docs, UI copy and commit messages.

| Term | Definition | Do not confuse with |
| --- | --- | --- |
| **Document** | The persistent, collaborative data model of a project: entities, components, assets, environment, behaviors, settings. Stored in a Yjs `Y.Doc`. | Scene (runtime) |
| **Project** | A document plus its blobs (binary files) and metadata, persisted locally as a folder or `.tessera` archive. | Document |
| **Entity** | A node in the document's hierarchy. Has an id, a name, a parent, an order key and a set of components. | Object3D, "object" |
| **Component** | A typed block of data attached to an entity (`transform`, `meshRenderer`, `light`, `camera`, `collider`, `rigidBody`, `tags`, `metadata`, …). Exactly one component of each type per entity. | React component (never use "component" for UI in code; use "panel" or "widget") |
| **Asset** | A document-level, referenceable resource: geometry, material, texture, environment map, script, audio. Has a kind, a license and provenance. | Blob |
| **Blob** | Binary content addressed by content hash (`sha256`) in the project's blob store. Assets reference blobs by hash. | Asset |
| **Environment** | Document-level lighting/sky/fog/exposure settings. | Scene |
| **Behavior** | A script attached to an entity through the behaviors map; runs in a sandbox; exports to engine stubs. | Component |
| **Scene** | The three.js runtime object graph mirroring the document (`THREE.Scene` and its children). Never persisted. | Document |
| **Object3D** | The three.js runtime mirror of an entity. | Entity |
| **Renderer sync** | The subsystem that applies document change sets to the scene incrementally. | Reconciler (React) |
| **Command** | A named, schema-validated, atomic mutation of the document, executed only by the command bus. | Tool, action |
| **Query** | A named, schema-validated, read-only function over the document (and optionally the scene). | Command |
| **Command bus** | The single entry point that validates, executes, records and broadcasts commands. | Event bus |
| **Transaction** | A group of commands applied atomically with one author, one label and one change set; the unit of undo and review. | Yjs transaction (implementation detail inside a Tessera transaction) |
| **Author** | Who caused a transaction: `user`, `agent` (with run id), `remote` (peer id), `system`. Encoded as the Yjs origin. | User |
| **Change set** | The structured description of what a transaction changed: created, deleted, updated entities/assets with before/after values. | Diff (text) |
| **Undo scope** | The set of authors whose transactions a given undo stack reverts. Users undo their own transactions; agent runs have their own stacks. | Global undo |
| **Tool** | A function exposed to a language model. Every tool wraps a command, a query, a macro or a job. | Command |
| **Tier** | Grouping of tools by risk and abstraction: 0 read, 1 primitive, 2 macro, 3 generate, 4 code. | Permission level |
| **Macro** | A tool that computes and applies several primitive commands deterministically (placeOn, distribute, arrangeGrid). | Script |
| **Run** | One agent invocation from a user prompt to a final report; contains steps. | Turn, session |
| **Step** | One model call within a run, with its tool calls and results. | Run |
| **Provider** | An implementation of the LLM or generation interface for a vendor or a local server. | Model |
| **Model descriptor** | Static and probed information about a model: id, provider, capabilities, context size, pricing hints. | Provider |
| **Capability** | A probed boolean/number about a model: tool calling, vision, structured output, streaming, context window. | Feature flag |
| **Role** | A slot in the agent that a model fills: planner, executor, critic. | Provider |
| **Job** | An asynchronous unit of work with progress and a result (generation, import, export, bake). | Step |
| **Source** | An asset library integration (Poly Haven, Kenney, uploads). | Provider |
| **Exporter** | Turns a document into an external format (glTF, code). Runs in Node and the browser. | Bridge |
| **Bridge** | Engine-side importer/plugin that turns a Tessera export into a native scene (Godot addon, Unity package…). | Exporter |
| **Sidecar** | `*.tessera.json` file that travels with a glTF export carrying data glTF cannot express. | Extras (glTF node extras also carry data; the sidecar is the complete copy) |
| **Room** | A collaboration session: one document shared by peers through a sync provider. | Project |
| **Presence** | Ephemeral per-peer state: cursor, selection, camera, status. Never persisted. | Document |
| **Lock** | A soft, advisory claim on an entity subtree by an author, shown in presence. | Permission |
| **Eval case** | A prompt, an initial document, assertions and optional judge rubric used to measure agent quality. | Unit test |
| **Fixture recording** | A recorded provider response set that makes an eval or test deterministic. | Mock |
| **Panel** | A UI region in the editor (outliner, inspector, chat, viewport). | Component |
| **Flag** | A feature flag in `apps/web/src/flags.ts` gating unfinished behavior. | Setting |
