//! Production adapters for the short list of Providers (ADR-0016) land with #4.
//!
//! The Provider trait itself lives under Session (see
//! `tessera-session::provider`), because Session is the module the Person — and
//! the tests acting as the Person — meet. This crate will hold the real network
//! adapters; the scripted adapter used by tests already exists in
//! `tessera-session::scripted_provider`.
