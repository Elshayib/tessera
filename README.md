# Tessera

Tessera is an agent-native 3D creation product: a Person with no 3D skill types
Intent to Tessera's own Agent and watches a Scene come into being in a live
Viewport. Tessera *is* the 3D software — the Engine, the Verbs, and the
vocabulary are owned here, not wrapped around a human DCC.

See [CONTEXT.md](CONTEXT.md) for the domain language and [docs/adr/](docs/adr/)
for the decisions that pin it down.

## Layout

| Crate | Role |
| --- | --- |
| `tessera` | Installed Windows app: live Viewport, chat and Narration beside it. No account. |
| `tessera-session` | Session: Tessera as the Person meets it. Intent in, Narration out. The Person never names a Verb. Holds the Provider seam (trait, scripted adapter for tests). |
| `tessera-provider` | Production adapters for Anthropic, OpenAI, and Google. Same Verbs, fake HTTP in tests. |
| `tessera-view` | The View seam: the live Viewport in the app; a recorder under test. |
| `tessera-engine` | The Engine: the Verb set and Clay, how form is held. |

## Building

Rust, pinned by `rust-toolchain.toml` (the GNU Windows target; this repo's dev
machines have no MSVC linker). Tests act as the Person: they submit Intent and
assert what a Person can notice — no real window, no live Provider, no network.

```sh
cargo test --workspace
```

Run the app (no account; paste a Key in the window to let the Agent think):

```sh
cargo run -p tessera
```

The Viewport is the product. Drag to Orbit — optional. Tests never open that window; they use a recording View.

## License

MIT — see [LICENSE](LICENSE).
