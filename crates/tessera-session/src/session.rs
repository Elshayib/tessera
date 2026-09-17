//! The module under product test: Tessera as the Person meets it.
//!
//! A Session holds the open Scene, the Agent's Provider, the Viewport, and the
//! Scene's Marks. The Person submits Intent; the Agent plans through the
//! Provider, lands each Verb on the Engine, and Narrates what it did as it goes.
//! When a take composes the named place, it lands as the automatic First-take
//! Mark.

use crate::marks::{MarkError, Marks};
use crate::plan::Plan;
use crate::provider::Provider;
use crate::scene::Scene;
use tessera_engine::clay::Object;
use tessera_engine::verb::{FrameTarget, LightCondition, ObjectRef, Verb};
use tessera_view::View;

/// One thing the Agent said in the chat while working.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NarrationLine {
    pub text: String,
}

/// Why a Verb could not land. The Person should be able to act on this, not
/// stare at a frozen Viewport (spec story 49).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SessionError {
    /// The plan named an Object the Scene does not have.
    UnknownObject(String),
}

/// The name of the automatic Mark for the first judgeable take.
const FIRST_TAKE: &str = "First take";

/// A Scene in progress. One Person, one Scene on screen (v1).
pub struct Session<P: Provider, V: View> {
    provider: P,
    view: V,
    scene: Scene,
    narration: Vec<NarrationLine>,
    marks: Marks,
    first_take_marked: bool,
}

impl<P: Provider, V: View> Session<P, V> {
    /// Start working on a Scene. No account is required; the Scene is local.
    pub fn start(provider: P, view: V) -> Self {
        Self {
            provider,
            view,
            scene: Scene::default(),
            narration: Vec::new(),
            marks: Marks::default(),
            first_take_marked: false,
        }
    }

    /// The Person's words. The Agent plans, lands each Verb on the Engine, and
    /// says what it did as it goes. A plan that names things the Scene does not
    /// have stops the take with an error; the Scene keeps every Verb that landed.
    pub fn submit_intent(&mut self, intent: &str) -> Result<Vec<String>, SessionError> {
        let Plan { narration, verbs } = self.provider.respond(intent);
        let mut said = Vec::new();
        for (line, verb) in narration.into_iter().zip(verbs.into_iter()) {
            self.apply(verb)?;
            self.narration.push(NarrationLine { text: line.clone() });
            said.push(line);
        }
        if self.maybe_mark_first_take() {
            said.push(
                "Marking this as your first take; you can always come back to it.".to_string(),
            );
        }
        Ok(said)
    }

    /// What the Agent has said in this Scene, across all Intent so far. The Talk
    /// lives with the Scene (ADR-0014).
    pub fn talk(&self) -> Vec<NarrationLine> {
        self.narration.clone()
    }

    /// The Objects currently in the Scene, as the Person could Point at them.
    pub fn objects(&self) -> &[Object] {
        &self.scene.objects
    }

    /// The Material family the sky currently wears.
    pub fn sky_family(&self) -> Option<&str> {
        self.scene.sky.as_ref().map(|f| f.0.as_str())
    }

    /// The named light condition the Scene is lit by.
    pub fn light(&self) -> Option<LightCondition> {
        self.scene.light
    }

    /// The Marks of this Scene by name; the First take is always among them.
    pub fn marks(&self) -> Vec<String> {
        self.marks.names()
    }

    /// Restore the Scene to a named Mark. The Person asked for this state by
    /// name; there is no Guess here.
    pub fn restore(&mut self, mark: &str) -> Result<(), MarkError> {
        self.scene = self.marks.snapshot(mark)?;
        Ok(())
    }

    /// What the Viewport last showed: the camera's current Frame.
    pub fn view(&self) -> &V {
        &self.view
    }

    /// The First take bar (spec #1): a judgeable place, already lit and dressed.
    /// The first take that reaches it is marked automatically, once per Scene.
    /// Returns whether a Mark was recorded.
    fn maybe_mark_first_take(&mut self) -> bool {
        if self.first_take_marked {
            return false;
        }
        let composed = !self.scene.objects.is_empty()
            && self.scene.objects.iter().all(|o| o.family.is_some())
            && self.scene.sky.is_some()
            && self.scene.light.is_some();
        if composed {
            let snapshot = std::mem::take(&mut self.scene);
            self.marks.record(FIRST_TAKE, snapshot);
            self.scene = self
                .marks
                .snapshot(FIRST_TAKE)
                .expect("the Mark was just recorded");
            self.first_take_marked = true;
            true
        } else {
            false
        }
    }

    fn apply(&mut self, verb: Verb) -> Result<(), SessionError> {
        match verb {
            Verb::place { name, part, at } => {
                self.scene
                    .objects
                    .push(Object::new(name.0.clone(), at, part.word().to_string()));
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
            Verb::light(condition) => self.scene.light = Some(condition),
            Verb::sky(family) => self.scene.sky = Some(family),
            Verb::wear { object, family } => {
                match self.scene.objects.iter_mut().find(|o| o.name == object.0) {
                    Some(o) => o.family = Some(family),
                    None => return Err(SessionError::UnknownObject(object.0)),
                }
            }
        }
        Ok(())
    }
}
