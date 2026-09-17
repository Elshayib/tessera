//! Clay is how the Engine holds form (ADR-0008): Pieces joined, carved, and
//! inflated without talking about vertices. A Mesh is poured from Clay later for
//! Game-ready export, which is not part of v1.
//!
//! The full Clay store lands with later tickets (#3, #5). So far an Object is
//! named and placed; form arrives with the Clay work.

/// One thing in the Scene, addressed as a whole: its place, and the Part it was
/// composed from.
#[derive(Debug, Clone)]
pub struct Object {
    /// The name used in Narration and later Talk ("the lantern roof").
    pub name: String,
    /// Relative place in the Scene, in the Agent's coarse words ("on the cliff",
    /// "atop the tower"). The Engine resolves it; the Agent passes no coordinates.
    pub place: String,
    /// How the Object was composed: a Primitive or Kit Part. Kit Parts land in
    /// #5; only Primitives exist so far.
    pub part: String,
}

impl Object {
    pub fn new(name: impl Into<String>, place: impl Into<String>, part: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            place: place.into(),
            part: part.into(),
        }
    }
}
