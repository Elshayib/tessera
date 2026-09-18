//! The View seam: the live Viewport in the app; a recorder under test.
//!
//! The Viewport is the product (ADR-0004), but tests never open a GPU window:
//! they observe Frames, Clay landing, and captured Still/Turntable artifacts
//! through this seam. The installed window lives in the `tessera` crate.

pub mod capture;
mod live;
pub mod raymarch;

pub use live::{LiveView, ViewportSnapshot};

use tessera_engine::{Clay, LightCondition};

/// A look at the Scene after a Verb lands.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Frame {
    /// The Object the camera was put on, or `None` when framed on the Scene.
    pub object: Option<String>,
}

/// One Object as the Viewport draws it: Clay in the Engine's resolved place.
#[derive(Debug, Clone)]
pub struct ShownObject {
    pub name: String,
    pub clay: Clay,
    /// Engine-resolved translation. The Agent never passed coordinates.
    pub at: [f32; 3],
    pub family: Option<String>,
}

/// The Scene as the Viewport shows it after a Verb lands.
#[derive(Debug, Clone, Default)]
pub struct ShownScene {
    pub objects: Vec<ShownObject>,
    pub sky: Option<String>,
    pub light: Option<LightCondition>,
}

/// Person-controlled camera. Frame sets it; Orbit turns it.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Camera {
    pub azimuth: f32,
    pub elevation: f32,
    pub distance: f32,
}

impl Default for Camera {
    fn default() -> Self {
        Self {
            azimuth: 0.0,
            elevation: 0.55,
            distance: 4.0,
        }
    }
}

/// What a Viewport does, whether it shows Clay on a GPU or records for tests.
pub trait View {
    /// Clay (and sky, light) as they stand after a Verb landed. Called on every
    /// Verb so the Person watches work happen, not a spinner then a result.
    fn show_scene(&mut self, scene: ShownScene) {
        let _ = scene;
    }

    /// A line of Talk (Intent or Narration) as it is said, so chat updates
    /// with the Viewport rather than once at the end of the take.
    fn say(&mut self, line: &str) {
        let _ = line;
    }

    /// Put the camera on the work. A no-op while the Person is Orbiting
    /// (ADR-0007); the next Verb after Orbit ends Frames again.
    fn show_frame(&mut self, frame: Frame);

    /// The Person is turning the camera. Ends when [`end_orbit`] is called.
    fn orbit(&mut self, delta_azimuth: f32, delta_elevation: f32) {
        let _ = (delta_azimuth, delta_elevation);
    }

    /// The Person stopped turning. The next Verb Frames; this call does not.
    fn end_orbit(&mut self) {}

    /// True while the Person is turning the camera (ADR-0007).
    fn orbiting(&self) -> bool {
        false
    }

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
