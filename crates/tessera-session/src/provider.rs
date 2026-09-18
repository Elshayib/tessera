//! The Provider seam: where the Agent's thinking comes from.

use crate::intent::Intent;
use crate::plan::Plan;
use serde::{Deserialize, Serialize};

/// A company whose model the Agent thinks with, given a Key. The Verbs do not
/// change when the Provider does (ADR-0016).
pub trait Provider {
    /// Turn the Person's Intent into work or an Ask, or refuse when the Key
    /// cannot buy the thinking (spec story 49). Ask is the exception: Guess
    /// and move is the default (ADR-0017).
    fn respond(
        &mut self,
        intent: &Intent,
        credentials: &Credentials,
        bindings: Bindings<'_>,
    ) -> Result<Reply, ProviderError>;
}

/// Named Objects in the open Scene, and the Object the Person Pointed at (if
/// any). The Agent uses these to Guess or Ask (ADR-0013, ADR-0017).
#[derive(Debug, Clone, Copy)]
pub struct Bindings<'a> {
    pub objects: &'a [String],
    pub pointed: Option<&'a str>,
    /// The Ask the Viewport is waiting on, if any; the Person's words are the answer.
    pub pending_ask: Option<&'a str>,
}

/// What the Agent does with Intent: a plan of Verbs, or an Ask instead of acting.
#[derive(Debug, Clone)]
pub enum Reply {
    /// Guess: name it in Narration and land the Verbs.
    Plan(Plan),
    /// Ask: the Viewport waits; no Verb lands until the Person answers.
    Ask(String),
}

/// The v1 short list of Providers (spec #1; ADR-0016). Not one lab, not every
/// model on earth. Adding one must not change the Verbs or the Verb contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderName {
    Anthropic,
    OpenAI,
    Google,
}

impl ProviderName {
    /// The whole v1 list, in spec order.
    pub const ALL: [ProviderName; 3] = [
        ProviderName::Anthropic,
        ProviderName::OpenAI,
        ProviderName::Google,
    ];

    /// The Person-facing name, as settings shows it.
    pub fn word(self) -> &'static str {
        match self {
            ProviderName::Anthropic => "Anthropic",
            ProviderName::OpenAI => "OpenAI",
            ProviderName::Google => "Google",
        }
    }
}

/// What crosses the seam with each Intent: the Provider the Key belongs to,
/// and the Key itself (ADR-0016). It never enters the Scene (spec story 6).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Credentials {
    pub provider: ProviderName,
    pub key: String,
}

/// Why the Provider would not think. Person-facing: the Session turns these
/// into an error the Person can act on (spec story 49).
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ProviderError {
    /// The Key is not valid for this Provider.
    #[error("That Key was rejected. Paste a valid Key for this Provider.")]
    InvalidKey,
    /// The Key is valid but the account has no credit left.
    #[error("This Key is out of credit. Add credit, or pick another Provider.")]
    OutOfCredit,
    /// The Provider could not be reached, with its own words for why.
    #[error("{0}")]
    Unavailable(String),
}
