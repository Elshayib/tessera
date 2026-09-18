//! Intent: what the Person wants. Words, and they may drop pictures
//! (ADR-0011). A picture is never a scan to copy and never a call to an
//! image-to-3D generator.

use serde::{Deserialize, Serialize};

/// What the Person wants this turn.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Intent {
    /// The words the Person typed.
    pub words: String,
    pictures: Vec<Picture>,
}

impl Intent {
    /// Words alone. Pictures are optional; add them with [`Intent::with_pictures`].
    pub fn words(text: impl Into<String>) -> Self {
        Self {
            words: text.into(),
            pictures: Vec::new(),
        }
    }

    /// Drop one or more pictures with the words (photo, sketch, screenshot).
    pub fn with_pictures(mut self, pictures: impl IntoIterator<Item = Picture>) -> Self {
        self.pictures.extend(pictures);
        self
    }

    /// Pictures dropped with this Intent, in drop order.
    pub fn pictures(&self) -> &[Picture] {
        &self.pictures
    }
}

impl From<&str> for Intent {
    fn from(words: &str) -> Self {
        Self::words(words)
    }
}

impl From<String> for Intent {
    fn from(words: String) -> Self {
        Self::words(words)
    }
}

/// How the Person made the picture they dropped. The Agent still Composes and
/// Sculpts; the kind is Intent, not a generator mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PictureKind {
    Photo,
    Sketch,
    Screenshot,
}

impl PictureKind {
    /// The Person-facing word for this kind of picture.
    pub fn word(self) -> &'static str {
        match self {
            PictureKind::Photo => "photo",
            PictureKind::Sketch => "sketch",
            PictureKind::Screenshot => "screenshot",
        }
    }
}

/// A picture dropped with Intent. Bytes travel with Talk; nothing here invokes
/// a generator.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Picture {
    kind: PictureKind,
    bytes: Vec<u8>,
}

impl Picture {
    pub fn photo(bytes: impl Into<Vec<u8>>) -> Self {
        Self {
            kind: PictureKind::Photo,
            bytes: bytes.into(),
        }
    }

    pub fn sketch(bytes: impl Into<Vec<u8>>) -> Self {
        Self {
            kind: PictureKind::Sketch,
            bytes: bytes.into(),
        }
    }

    pub fn screenshot(bytes: impl Into<Vec<u8>>) -> Self {
        Self {
            kind: PictureKind::Screenshot,
            bytes: bytes.into(),
        }
    }

    pub fn kind(&self) -> PictureKind {
        self.kind
    }

    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }
}
