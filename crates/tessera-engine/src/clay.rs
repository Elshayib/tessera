//! Clay is how the Engine holds form (ADR-0008): Pieces joined, carved, and
//! inflated without talking about vertices. A Mesh is poured from Clay later for
//! Game-ready export, which is not part of v1.
//!
//! The full Clay store lands with the Sculpt ticket (#6). So far an Object
//! carries the Part it was composed from and the Material family it wears.

use crate::verb::{MaterialFamily, Part};

/// One thing in the Scene, addressed as a whole: its place, its silhouette's
/// shape, and the Material family it wears.
#[derive(Debug, Clone)]
pub struct Object {
    /// The name used in Narration and later Talk ("the lantern roof").
    pub name: String,
    /// Relative place in the Scene, in the Agent's coarse words ("on the cliff",
    /// "atop the tower"). The Engine resolves it; the Agent passes no coordinates.
    pub place: String,
    /// The Part it was composed from: a Primitive or a named Kit Part.
    pub part: Part,
    /// The named look this Object wears; set on the First take, never a shader.
    pub family: Option<MaterialFamily>,
}

impl Object {
    pub fn new(name: impl Into<String>, place: impl Into<String>, part: Part) -> Self {
        Self {
            name: name.into(),
            place: place.into(),
            part,
            family: None,
        }
    }
}
