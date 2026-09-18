//! The View under test: records Frames instead of opening a GPU window.

use std::io;
use std::path::{Path, PathBuf};

use tessera_engine::Clay;
use tessera_view::View;

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
}

impl View for ViewReport {
    fn show_frame(&mut self, frame: tessera_view::Frame) {
        self.frames.push(frame);
        if self.stop_after_frames == Some(self.frames.len()) {
            self.pending_stop = true;
        }
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
