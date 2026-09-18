//! Marks: named states of the Scene the Person asked to keep (ADR-0015). The
//! First take is always a Mark. Restore is not Undo: it replaces the current
//! Scene with the Mark's snapshot (and is itself a Verb-sized step the Person
//! can Undo).

use crate::scene::Scene;
use tessera_view::Frame;

/// A named snapshot of the Scene, including the Talk and the Frame at that
/// state.
#[derive(Debug, Clone)]
pub struct Mark {
    pub name: String,
    pub scene: Scene,
    pub frame: Option<Frame>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MarkError {
    /// No Mark under that name in this Scene.
    Unknown(String),
}

/// The Marks of this Scene, in the order they were made. The First take is
/// always first.
#[derive(Debug, Default)]
pub struct Marks {
    marks: Vec<Mark>,
}

impl Marks {
    /// Rebuild the Marks of a Scene from the file (issue #14).
    pub(crate) fn load(marks: Vec<Mark>) -> Self {
        Self { marks }
    }

    pub(crate) fn all(&self) -> &[Mark] {
        &self.marks
    }

    pub fn record(&mut self, name: &str, scene: Scene, frame: Option<Frame>) {
        self.marks.push(Mark {
            name: name.to_string(),
            scene,
            frame,
        });
    }

    pub fn names(&self) -> Vec<String> {
        self.marks.iter().map(|m| m.name.clone()).collect()
    }

    /// The snapshot a named Mark holds. The newest Mark under a name wins.
    pub fn snapshot(&self, name: &str) -> Result<Mark, MarkError> {
        self.marks
            .iter()
            .rev()
            .find(|m| m.name == name)
            .cloned()
            .ok_or_else(|| MarkError::Unknown(name.to_string()))
    }
}
