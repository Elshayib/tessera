//! The Scene as a file on disk (ADR-0010, ADR-0014, issue #14). Clay, Objects,
//! Talk, Marks, and the last Frame round-trip. The Key never does.

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::marks::{Mark, Marks};
use crate::scene::Scene;
use tessera_view::Frame;

/// Why a Scene file could not be kept or opened. The Person should know
/// whether the path is unwritable, or the file is not a Scene.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SceneError {
    /// The file could not be written where they asked.
    #[error("Could not keep the Scene file: {0}")]
    Io(String),
    /// The path is not a Scene Tessera can open.
    #[error("That Scene file could not be opened: {0}")]
    Unreadable(String),
}

/// What is written to the Scene file. There is no Key field: sending this to a
/// friend must not leak credentials (spec story 6).
#[derive(Serialize, Deserialize)]
struct SceneDocument {
    scene: Scene,
    marks: Vec<StoredMark>,
    frame: Option<StoredFrame>,
}

#[derive(Serialize, Deserialize)]
struct StoredMark {
    name: String,
    scene: Scene,
    frame: Option<StoredFrame>,
}

#[derive(Serialize, Deserialize)]
struct StoredFrame {
    object: Option<String>,
}

impl From<&Frame> for StoredFrame {
    fn from(frame: &Frame) -> Self {
        Self {
            object: frame.object.clone(),
        }
    }
}

impl From<StoredFrame> for Frame {
    fn from(frame: StoredFrame) -> Self {
        Frame {
            object: frame.object,
        }
    }
}

pub fn write(
    path: &Path,
    scene: &Scene,
    marks: &Marks,
    frame: Option<&Frame>,
) -> Result<(), SceneError> {
    if let Some(parent) = path.parent()
        && !parent.as_os_str().is_empty()
    {
        std::fs::create_dir_all(parent).map_err(|e| SceneError::Io(e.to_string()))?;
    }
    let document = SceneDocument {
        scene: scene.clone(),
        marks: marks
            .all()
            .iter()
            .map(|mark| StoredMark {
                name: mark.name.clone(),
                scene: mark.scene.clone(),
                frame: mark.frame.as_ref().map(StoredFrame::from),
            })
            .collect(),
        frame: frame.map(StoredFrame::from),
    };
    let text =
        serde_json::to_string_pretty(&document).map_err(|e| SceneError::Io(e.to_string()))?;
    std::fs::write(path, text).map_err(|e| SceneError::Io(e.to_string()))
}

pub fn read(path: &Path) -> Result<(Scene, Marks, Option<Frame>), SceneError> {
    let text = std::fs::read_to_string(path).map_err(|e| SceneError::Unreadable(e.to_string()))?;
    let document: SceneDocument =
        serde_json::from_str(&text).map_err(|e| SceneError::Unreadable(e.to_string()))?;
    let marks = Marks::load(
        document
            .marks
            .into_iter()
            .map(|mark| Mark {
                name: mark.name,
                scene: mark.scene,
                frame: mark.frame.map(Frame::from),
            })
            .collect(),
    );
    Ok((document.scene, marks, document.frame.map(Frame::from)))
}
