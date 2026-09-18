//! The View under test: records Frames instead of opening a window.

use std::io;
use std::path::{Path, PathBuf};

use tessera_engine::Clay;
use tessera_view::{Camera, View};

/// Records what the Viewport was shown, so tests can assert what the Person
/// would have seen.
#[derive(Debug, Default)]
pub struct ViewReport {
    frames: Vec<tessera_view::Frame>,
    /// After this many Frames in total, the Person hits Stop. `None` means they
    /// never do.
    stop_after_frames: Option<usize>,
    pending_stop: bool,
    stills: Vec<(PathBuf, tessera_view::Frame)>,
    turntables: Vec<(PathBuf, usize)>,
    /// Object names shown after each Verb, in land order.
    scene_updates: Vec<Vec<String>>,
    camera: Camera,
    orbiting: bool,
}

impl ViewReport {
    pub fn new() -> Self {
        Self::default()
    }

    /// The Person will hit Stop after this many Frames have landed, standing
    /// in for the Stop button while a take is on screen.
    pub fn person_stops_after_frames(mut self, n: usize) -> Self {
        self.stop_after_frames = Some(n);
        self
    }

    /// What the camera was last put on: the named Object, or `None` for the Scene.
    pub fn last_frame(&self) -> Option<&tessera_view::Frame> {
        self.frames.last()
    }

    /// The Frame the last kept Still was of, if the Person has kept one.
    pub fn last_still(&self) -> Option<&tessera_view::Frame> {
        self.stills.last().map(|(_, frame)| frame)
    }

    /// How many views the last Turntable orbit held, if the Person has kept one.
    pub fn last_orbit_views(&self) -> Option<usize> {
        self.turntables.last().map(|(_, n)| *n)
    }

    /// Object names the Viewport showed after each Verb, in land order.
    pub fn scene_updates(&self) -> &[Vec<String>] {
        &self.scene_updates
    }

    /// Where the Person is looking. Frame sets this; Orbit turns it.
    pub fn camera(&self) -> Camera {
        self.camera
    }
}

impl View for ViewReport {
    fn show_scene(&mut self, scene: tessera_view::ShownScene) {
        self.scene_updates
            .push(scene.objects.into_iter().map(|o| o.name).collect());
    }

    fn show_frame(&mut self, frame: tessera_view::Frame) {
        if self.orbiting {
            return;
        }
        self.frames.push(frame);
        self.camera = Camera::default();
        if self.stop_after_frames == Some(self.frames.len()) {
            self.pending_stop = true;
        }
    }

    fn orbit(&mut self, delta_azimuth: f32, delta_elevation: f32) {
        self.orbiting = true;
        self.camera.azimuth += delta_azimuth;
        self.camera.elevation = (self.camera.elevation + delta_elevation).clamp(-1.2, 1.2);
    }

    fn end_orbit(&mut self) {
        self.orbiting = false;
    }

    fn orbiting(&self) -> bool {
        self.orbiting
    }

    fn stop_requested(&mut self) -> bool {
        let requested = self.pending_stop;
        self.pending_stop = false;
        requested
    }

    fn keep_still(
        &mut self,
        path: &Path,
        frame: &tessera_view::Frame,
        clay: Option<&Clay>,
    ) -> Result<(), io::Error> {
        crate::keep::still_png(path, frame, clay)?;
        self.stills.push((path.to_path_buf(), frame.clone()));
        Ok(())
    }

    fn keep_turntable(
        &mut self,
        path: &Path,
        frame: &tessera_view::Frame,
        clay: Option<&Clay>,
    ) -> Result<(), io::Error> {
        let views = crate::keep::turntable_gif(path, frame, clay)?;
        self.turntables.push((path.to_path_buf(), views));
        Ok(())
    }
}
