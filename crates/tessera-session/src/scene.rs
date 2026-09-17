//! The Scene: the working document. Objects, ground, sky, light — and the Talk,
//! so tomorrow's Rehearsal still knows what "the roof" meant (ADR-0006,
//! ADR-0014). v1 keeps it in memory; the file on disk arrives with #13.

use tessera_engine::MaterialFamily;
use tessera_engine::clay::Object;
use tessera_engine::verb::LightCondition;

/// A snapshot of everything that makes a state of the Scene what it is. A Mark
/// holds one of these; restore swaps the live Scene for it.
#[derive(Debug, Clone, Default)]
pub struct Scene {
    pub objects: Vec<Object>,
    /// The Material family the sky wears, if any.
    pub sky: Option<MaterialFamily>,
    /// The named light condition ("dusk"), if set.
    pub light: Option<LightCondition>,
}

impl Scene {
    /// One Object as the Person could Point at it, with the family it wears.
    pub fn object(&self, name: &str) -> Option<&Object> {
        self.objects.iter().find(|o| o.name == name)
    }
}
