//! Production View: Clay the Person can watch, without opening a window of
//! its own. The installed app paints this state; tests may use it headless.

use std::io;
use std::path::Path;
use std::sync::{Arc, Mutex};

use tessera_engine::Clay;

use crate::{Camera, Frame, ShownScene, View};

/// What the window paints this frame: Clay, camera, and Talk so far.
#[derive(Clone)]
pub struct ViewportSnapshot {
    pub scene: ShownScene,
    pub camera: Camera,
    pub frame: Option<Frame>,
    pub talk: Vec<String>,
}

/// Shared Viewport state. The window clones this; Session holds one.
#[derive(Clone)]
pub struct LiveView {
    inner: Arc<Mutex<Inner>>,
}

struct Inner {
    scene: ShownScene,
    frames: Vec<Frame>,
    camera: Camera,
    orbiting: bool,
    pending_stop: bool,
    pending_steer: Option<String>,
    talk: Vec<String>,
}

impl LiveView {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                scene: ShownScene::default(),
                frames: Vec::new(),
                camera: Camera::default(),
                orbiting: false,
                pending_stop: false,
                pending_steer: None,
                talk: Vec::new(),
            })),
        }
    }

    /// Snapshot for the window to paint. Never opens a GPU window itself.
    pub fn snapshot(&self) -> ViewportSnapshot {
        let g = self.inner.lock().expect("Viewport state");
        ViewportSnapshot {
            scene: g.scene.clone(),
            camera: g.camera,
            frame: g.frames.last().cloned(),
            talk: g.talk.clone(),
        }
    }

    /// The Person hit Stop in the window.
    pub fn request_stop(&self) {
        self.inner.lock().expect("Viewport state").pending_stop = true;
    }

    /// The Person talked over while a take is on screen. Session finishes the
    /// current Verb, then takes these words as Intent.
    pub fn request_steer(&self, words: impl Into<String>) {
        self.inner.lock().expect("Viewport state").pending_steer = Some(words.into());
    }

    /// Turn the camera. `&self` so the window can Orbit while Session holds the View.
    pub fn turn(&self, delta_azimuth: f32, delta_elevation: f32) {
        let mut g = self.inner.lock().expect("Viewport state");
        g.orbiting = true;
        g.camera.azimuth += delta_azimuth;
        g.camera.elevation = (g.camera.elevation + delta_elevation).clamp(-1.2, 1.2);
    }

    /// The Person stopped turning.
    pub fn stop_turning(&self) {
        self.inner.lock().expect("Viewport state").orbiting = false;
    }
}

impl Default for LiveView {
    fn default() -> Self {
        Self::new()
    }
}

impl View for LiveView {
    fn show_scene(&mut self, scene: ShownScene) {
        self.inner.lock().expect("Viewport state").scene = scene;
    }

    fn say(&mut self, line: &str) {
        self.inner
            .lock()
            .expect("Viewport state")
            .talk
            .push(line.to_string());
    }

    fn show_frame(&mut self, frame: Frame) {
        let mut g = self.inner.lock().expect("Viewport state");
        if g.orbiting {
            return;
        }
        g.frames.push(frame);
        g.camera = Camera::default();
    }

    fn stop_requested(&mut self) -> bool {
        let mut g = self.inner.lock().expect("Viewport state");
        let requested = g.pending_stop;
        g.pending_stop = false;
        requested
    }

    fn steer_requested(&mut self) -> Option<String> {
        self.inner
            .lock()
            .expect("Viewport state")
            .pending_steer
            .take()
    }

    fn orbit(&mut self, delta_azimuth: f32, delta_elevation: f32) {
        self.turn(delta_azimuth, delta_elevation);
    }

    fn end_orbit(&mut self) {
        self.stop_turning();
    }

    fn orbiting(&self) -> bool {
        self.inner.lock().expect("Viewport state").orbiting
    }

    fn keep_still(
        &mut self,
        path: &Path,
        frame: &Frame,
        clay: Option<&Clay>,
    ) -> Result<(), io::Error> {
        crate::capture::still_png(path, frame, clay)
    }

    fn keep_turntable(
        &mut self,
        path: &Path,
        frame: &Frame,
        clay: Option<&Clay>,
    ) -> Result<(), io::Error> {
        crate::capture::turntable_gif(path, frame, clay).map(|_| ())
    }
}
