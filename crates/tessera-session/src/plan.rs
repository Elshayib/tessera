//! A Provider's answer to Intent: the plan of Verbs the Agent will execute.
//!
//! In production the plan comes from a model over a paid API (#4); in tests it is
//! scripted and never touches the network. Verbs, not prose, cross this seam —
//! the same small set regardless of Provider (ADR-0016).

use serde::Deserialize;
use tessera_engine::LightCondition;
use tessera_engine::verb::{FrameTarget, MaterialFamily, ObjectRef, Primitive, Verb};

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

    /// Parse the Verb-contract JSON a live Provider's model is asked to emit.
    /// The same shape is used for Anthropic, OpenAI, and Google — the Verbs do
    /// not change when the Provider does (ADR-0016).
    pub fn from_json(text: &str) -> Result<Self, String> {
        let text = strip_fences(text);
        let wire: PlanWire = serde_json::from_str(text)
            .map_err(|e| format!("the Agent's plan was not JSON: {e}"))?;
        let mut verbs = Vec::with_capacity(wire.verbs.len());
        for item in wire.verbs {
            verbs.push(item.into_verb()?);
        }
        if wire.narration.len() != verbs.len() {
            return Err("a Plan must narrate one line per Verb".to_string());
        }
        Ok(Self {
            narration: wire.narration,
            verbs,
        })
    }
}

fn strip_fences(text: &str) -> &str {
    let trimmed = text.trim();
    let Some(rest) = trimmed.strip_prefix("```") else {
        return trimmed;
    };
    let rest = rest.strip_prefix("json").unwrap_or(rest);
    let rest = rest.trim_start_matches('\r').trim_start_matches('\n');
    rest.rsplit_once("```")
        .map(|(body, _)| body.trim())
        .unwrap_or(rest.trim())
}

#[derive(Deserialize)]
struct PlanWire {
    narration: Vec<String>,
    verbs: Vec<VerbWire>,
}

#[derive(Deserialize)]
#[serde(tag = "verb")]
enum VerbWire {
    #[serde(rename = "place")]
    Place {
        name: String,
        part: String,
        at: String,
    },
    #[serde(rename = "frame")]
    Frame { target: String },
    #[serde(rename = "light")]
    Light { condition: String },
    #[serde(rename = "sky")]
    Sky { family: String },
    #[serde(rename = "wear")]
    Wear { object: String, family: String },
}

impl VerbWire {
    fn into_verb(self) -> Result<Verb, String> {
        match self {
            VerbWire::Place { name, part, at } => {
                let part = Primitive::from_word(&part)
                    .ok_or_else(|| format!("unknown Primitive {part:?}"))?;
                Ok(Verb::place {
                    name: ObjectRef(name),
                    part,
                    at,
                })
            }
            VerbWire::Frame { target } => {
                let target = if target == "scene" {
                    FrameTarget::Scene
                } else {
                    FrameTarget::Object(ObjectRef(target))
                };
                Ok(Verb::frame(target))
            }
            VerbWire::Light { condition } => {
                let condition = LightCondition::from_word(&condition)
                    .ok_or_else(|| format!("unknown light condition {condition:?}"))?;
                Ok(Verb::light(condition))
            }
            VerbWire::Sky { family } => Ok(Verb::sky(MaterialFamily(family))),
            VerbWire::Wear { object, family } => Ok(Verb::wear {
                object: ObjectRef(object),
                family: MaterialFamily(family),
            }),
        }
    }
}
