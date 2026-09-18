//! The Provider seam: where the Agent's thinking comes from.

use crate::intent::Intent;
use crate::plan::Plan;
use serde::{Deserialize, Serialize};

/// A company whose offering the Agent thinks with, given a Key. The Verbs do
/// not change when the Provider does (ADR-0016).
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

    /// What this Provider currently offers, given a Key. No Brain is required
    /// yet (ADR-0021). Tessera keeps chat, text in and out.
    fn list_brains(&mut self, credentials: &Credentials) -> Result<Vec<Brain>, ProviderError>;
}

/// One offering of a Provider the Agent may think with (ADR-0021). Tessera
/// does not pin this list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Brain {
    /// The id the Provider's request names.
    pub id: String,
    /// The Person-facing name settings shows.
    pub name: String,
    /// Whether this Brain can see pictures. Missing catalog metadata is
    /// treated as able to see; the Provider may still refuse a picture.
    pub can_see: bool,
    /// Prompt price when the catalog includes one. Lower is cheaper.
    pub price: Option<u64>,
    /// What kind of offering this is. Tessera keeps chat, text in and out.
    pub kind: BrainKind,
}

impl Brain {
    /// Chat, text in and out: the offerings Tessera can think with.
    pub fn is_chat(&self) -> bool {
        self.kind == BrainKind::Chat
    }

    /// Whether this Brain belongs in a settings search for `query`. Empty
    /// query matches every Brain. Match is case-insensitive on name or id.
    pub fn matches(&self, query: &str) -> bool {
        let q = query.trim().to_ascii_lowercase();
        if q.is_empty() {
            return true;
        }
        self.name.to_ascii_lowercase().contains(&q) || self.id.to_ascii_lowercase().contains(&q)
    }

    /// The default pick from a filtered chat list (ADR-0021): cheapest that
    /// can see pictures; if the catalog has no price, the first that can see;
    /// if none can see, the cheapest (or first) chat Brain.
    pub fn default_in(brains: &[Brain]) -> Option<&Brain> {
        let seeing: Vec<&Brain> = brains.iter().filter(|b| b.can_see).collect();
        let pool: Vec<&Brain> = if seeing.is_empty() {
            brains.iter().collect()
        } else {
            seeing
        };
        cheapest_or_first(&pool)
    }
}

fn cheapest_or_first<'a>(brains: &[&'a Brain]) -> Option<&'a Brain> {
    let priced: Vec<&&Brain> = brains.iter().filter(|b| b.price.is_some()).collect();
    if priced.is_empty() {
        brains.first().copied()
    } else {
        priced
            .into_iter()
            .min_by_key(|b| b.price.unwrap_or(u64::MAX))
            .copied()
    }
}

/// What kind of offering a Provider lists. Tessera drops everything but chat.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum BrainKind {
    Chat,
    ImageGen,
    Embeddings,
    Audio,
    Other,
}

/// Keep chat offerings with text in and text out. Drop image-generation,
/// embeddings, audio, and anything that cannot return text.
pub fn chat_brains(brains: Vec<Brain>) -> Vec<Brain> {
    brains.into_iter().filter(Brain::is_chat).collect()
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
/// the Key itself, and the Brain the Agent thinks with (ADR-0016, ADR-0021).
/// It never enters the Scene (spec story 6).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Credentials {
    pub provider: ProviderName,
    pub key: String,
    /// The Brain id, once the Person picked one or Tessera picked a default.
    /// Listing does not require it.
    #[serde(default)]
    pub brain: Option<String>,
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
