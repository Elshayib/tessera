//! The View seam: the live Viewport in the app; a recorder under test.
//!
//! The Viewport is the product (ADR-0004), but tests never open a GPU window:
//! they observe Frames and captured Still/Turntable artifacts through this seam.
//! The live GPU window arrives with #11; capture here is CPU raymarch of Clay.

use tessera_engine::Clay;

/// A look at the Scene after a Verb lands.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    /// The Object the camera was put on, or `None` when framed on the Scene.
    pub object: Option<String>,
}

/// What a Viewport does, whether it shows Clay on a GPU or records for tests.
pub trait View {
    /// Show the current state of the Scene, framed on the last Verb's work.
    fn show_frame(&mut self, frame: Frame);

    /// True when the Person hit Stop while this View was showing a take.
    /// Session consults this after each completed Verb and abandons the rest
    /// of the plan; a Stopped Verb never lands and is not on the Undo stack.
    /// Consumed: a Stopped take must not Stop the next Intent.
    fn stop_requested(&mut self) -> bool {
        false
    }

    /// Keep a Still: a picture file of the current framed view. A friend can
    /// open it without Tessera. `clay` is the framed Object's silhouette, if any.
    fn keep_still(
        &mut self,
        path: &std::path::Path,
        frame: &Frame,
        clay: Option<&Clay>,
    ) -> Result<(), std::io::Error>;

    /// Keep a short Turntable: a video of an orbit a friend can open without
    /// Tessera. `clay` is the framed Object's silhouette, if any.
    fn keep_turntable(
        &mut self,
        path: &std::path::Path,
        frame: &Frame,
        clay: Option<&Clay>,
    ) -> Result<(), std::io::Error>;
}
