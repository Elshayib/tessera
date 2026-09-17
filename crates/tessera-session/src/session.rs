//! The module under product test: Tessera as the Person meets it.
//!
//! A Session holds the open Scene, the Agent's Provider, and the Viewport. The
//! Person submits Intent; the Agent plans through the Provider, lands each Verb
//! on the Engine, and Narrates what it did as it goes.

use crate::plan::Plan;
use crate::provider::Provider;
use tessera_engine::clay::Object;
use tessera_engine::verb::{FrameTarget, ObjectRef, Verb};
use tessera_view::View;

/// One thing the Agent said in the chat while working.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NarrationLine {
    pub text: String,
}

/// A Scene in progress. One Person, one Scene on screen (v1).
pub struct Session<P: Provider, V: View> {
    provider: P,
    view: V,
    objects: Vec<Object>,
    narration: Vec<NarrationLine>,
}

impl<P: Provider, V: View> Session<P, V> {
    /// Start working on a Scene. No account is required; the Scene is local.
    pub fn start(provider: P, view: V) -> Self {
        Self {
            provider,
            view,
            objects: Vec::new(),
            narration: Vec::new(),
        }
    }

    /// The Person's words. The Agent plans, lands each Verb on the Engine, and
    /// says what it did as it goes.
    pub fn submit_intent(&mut self, intent: &str) -> Vec<String> {
        let Plan { narration, verbs } = self.provider.respond(intent);
        let mut said = Vec::new();
        for (line, verb) in narration.into_iter().zip(verbs.into_iter()) {
            self.apply(verb);
            self.narration.push(NarrationLine { text: line.clone() });
            said.push(line);
        }
        said
    }

    /// What the Agent has said in this Scene, across all Intent so far. The Talk
    /// lives with the Scene (ADR-0014).
    pub fn talk(&self) -> Vec<NarrationLine> {
        self.narration.clone()
    }

    /// The Objects currently in the Scene, as the Person could Point at them.
    pub fn objects(&self) -> &[Object] {
        &self.objects
    }

    /// What the Viewport last showed: the camera's current Frame.
    pub fn view(&self) -> &V {
        &self.view
    }

    fn apply(&mut self, verb: Verb) {
        match verb {
            Verb::place { name, part, at } => {
                self.objects.push(Object::new(name.0.clone(), at, part));
                self.view.show_frame(tessera_view::Frame {
                    object: Some(name.0),
                });
            }
            Verb::frame(target) => {
                let object = match target {
                    FrameTarget::Object(ObjectRef(name)) => Some(name),
                    FrameTarget::Scene => None,
                };
                self.view.show_frame(tessera_view::Frame { object });
            }
        }
    }
}
