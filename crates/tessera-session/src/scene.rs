//! The Scene: the working document. Objects, ground, sky, light — and the Talk,
//! so tomorrow's Rehearsal still knows what "the roof" meant (ADR-0006,
//! ADR-0014). The Scene is a file on disk (issue #14); the Key is not in it.

use serde::{Deserialize, Serialize};

use crate::intent::Picture;
use tessera_engine::MaterialFamily;
use tessera_engine::clay::Object;
use tessera_engine::verb::LightCondition;

/// One turn of Talk in this Scene: the Person's Intent (words, and pictures
/// they dropped) or a line of Narration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TalkLine {
    pub text: String,
    /// Pictures the Person dropped with this turn. Empty on Agent Narration.
    pub pictures: Vec<Picture>,
}

/// A snapshot of everything that makes a state of the Scene what it is. A Mark
/// holds one of these; restore swaps the live Scene for it. Talk is part of
/// the state (ADR-0014, ADR-0015): restoring a Mark returns the Talk at that
/// moment too.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Scene {
    pub objects: Vec<Object>,
    /// The Material family the sky wears, if any.
    pub sky: Option<MaterialFamily>,
    /// The named light condition ("dusk"), if set.
    pub light: Option<LightCondition>,
    /// The conversation in this Scene at this state.
    pub talk: Vec<TalkLine>,
}

impl Scene {
    /// One Object as the Person could Point at it, with the family it wears.
    pub fn object(&self, name: &str) -> Option<&Object> {
        self.objects.iter().find(|o| o.name == name)
    }
}
