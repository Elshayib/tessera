//! A Provider's answer to Intent: the plan of Verbs the Agent will execute.
//!
//! In production the plan comes from a model over a paid API (#4); in tests it is
//! scripted and never touches the network. Verbs, not prose, cross this seam —
//! the same small set regardless of Provider (ADR-0016).

use tessera_engine::Verb;

/// A planned take on Intent: what the Agent will do, and what it will say while
/// doing it. One Narration line per Verb, in order — enforced by [`Plan::new`],
/// which panics when the two differ.
#[derive(Debug, Clone)]
pub struct Plan {
    pub(crate) narration: Vec<String>,
    pub(crate) verbs: Vec<Verb>,
}

impl Plan {
    /// Build a Plan whose Narration lines line up with its Verbs, one per Verb.
    pub fn new(narration: Vec<String>, verbs: Vec<Verb>) -> Self {
        assert_eq!(
            narration.len(),
            verbs.len(),
            "a Plan must narrate one line per Verb"
        );
        Self { narration, verbs }
    }
}
