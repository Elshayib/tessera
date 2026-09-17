//! Marks: named states of the Scene the Person asked to keep (ADR-0015). The
//! First take is always a Mark. Restore is not Undo: it replaces the current
//! Scene with the Mark's snapshot.
//!
//! The fuller Marks story — Person-named Marks, an Undo stack, and restore that
//! the Person can step back from — is #7. Until then, restore is a plain swap.

use crate::scene::Scene;

/// A named snapshot of the Scene.
#[derive(Debug, Clone)]
pub struct Mark {
    pub name: String,
    pub scene: Scene,
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
    pub fn record(&mut self, name: &str, scene: Scene) {
        self.marks.push(Mark {
            name: name.to_string(),
            scene,
        });
    }

    pub fn names(&self) -> Vec<String> {
        self.marks.iter().map(|m| m.name.clone()).collect()
    }

    /// The snapshot a named Mark holds. The newest Mark under a name wins.
    pub fn snapshot(&self, name: &str) -> Result<Scene, MarkError> {
        self.marks
            .iter()
            .rev()
            .find(|m| m.name == name)
            .map(|m| m.scene.clone())
            .ok_or_else(|| MarkError::Unknown(name.to_string()))
    }
}
