//! The View under test: records Frames instead of rendering them.

use tessera_view::View;

/// Records what the Viewport was shown, so tests can assert what the Person
/// would have seen.
#[derive(Debug, Default)]
pub struct ViewReport {
    frames: Vec<tessera_view::Frame>,
}

impl ViewReport {
    pub fn new() -> Self {
        Self::default()
    }

    /// What the camera was last put on: the named Object, or `None` for the Scene.
    pub fn last_frame(&self) -> Option<&tessera_view::Frame> {
        self.frames.last()
    }
}

impl View for ViewReport {
    fn show_frame(&mut self, frame: tessera_view::Frame) {
        self.frames.push(frame);
    }
}
