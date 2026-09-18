//! The module under product test: Tessera as the Person meets it.
//!
//! A Session holds the open Scene, the Agent's Provider, the Viewport, and the
//! Scene's Marks. The Person submits Intent; the Agent plans through the
//! Provider, lands each Verb on the Engine, and Narrates what it did as it goes.
//! When a take composes the named place, it lands as the automatic First-take
//! Mark.

use std::path::Path;

use crate::intent::Intent;
use crate::keyring::{KeyStore, Keyring, MemoryKeyStore};
use crate::marks::{MarkError, Marks};
use crate::plan::Plan;
use crate::provider::{Bindings, Brain, Provider, ProviderError, ProviderName, Reply};
use crate::scene::{Scene, TalkLine};
use crate::scene_file::{self, SceneError};
use tessera_engine::Clay;
use tessera_engine::clay::Object;
use tessera_engine::verb::{FrameTarget, LightCondition, ObjectRef, Verb};
use tessera_view::View;

/// Why a Verb could not land. The Person should be able to act on this, not
/// stare at a frozen Viewport (spec story 49).
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SessionError {
    /// The plan named an Object the Scene does not have.
    #[error("The Scene has no Object named {0}.")]
    UnknownObject(String),
    /// The Agent has no brain to think with: the Key is missing, invalid, or
    /// out of credit (issue #4).
    #[error("{0}")]
    Key(KeyError),
    /// The Agent cannot think with the current Brain pick (ADR-0021).
    #[error("{0}")]
    Brain(BrainError),
}

/// Why the Brain pick cannot think, as the Person can act on it.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum BrainError {
    /// Nothing offered, or nothing picked and no default.
    #[error("No Brain is available. Pick a Brain in settings so the Agent can think.")]
    Missing,
    /// The remembered Brain is not in what the Provider currently offers.
    #[error("That Brain is no longer offered. Pick another Brain in settings.")]
    Unknown,
    /// Pictures were sent to a Brain that cannot see them.
    #[error("This Brain cannot see pictures. Pick a Brain that can see, or send words only.")]
    CannotSee,
}

/// What is wrong with the Key, as the Person can act on it (spec story 49).
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum KeyError {
    /// No Key pasted yet.
    #[error("No Key is set. Paste a Key in settings so the Agent can think.")]
    Missing,
    /// No Provider picked yet; a Key belongs to one Provider (ADR-0016).
    #[error("No Provider is chosen. Pick Anthropic, OpenAI, or Google.")]
    MissingProvider,
    /// The Provider refused the Key.
    #[error("That Key was rejected. Paste a valid Key for this Provider.")]
    Invalid,
    /// The Key is valid but the account has no credit left.
    #[error("This Key is out of credit. Add credit, or pick another Provider.")]
    OutOfCredit,
    /// The Provider could not be reached; its words are carried through.
    #[error("{0}")]
    Unavailable(String),
}

/// The name of the automatic Mark for the first judgeable take.
const FIRST_TAKE: &str = "First take";

/// Why Undo could not run. The Person should know they are already at the
/// earliest state of this Scene.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UndoError {
    /// No completed Verb left to revert.
    NothingToUndo,
}

/// Why a Still or Turntable could not be kept. The Person should know whether
/// they need to wait for a Frame, or pick another place to write.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum KeepError {
    /// Nothing is on camera yet; a Still and a Turntable are of the framed view.
    #[error("Nothing is framed yet. Wait until you can see the work, then keep it.")]
    NoFrame,
    /// The file could not be written where they asked.
    #[error("Could not keep the file: {0}")]
    Io(String),
}

/// Scene, Talk, and Frame as they were before a completed Verb (or restore).
#[derive(Debug, Clone)]
struct UndoStep {
    scene: Scene,
    frame: Option<tessera_view::Frame>,
}

/// A Scene in progress. One Person, one Scene on screen (v1).
pub struct Session<P: Provider, V: View> {
    provider: P,
    view: V,
    keyring: Box<Keyring<dyn KeyStore>>,
    scene: Scene,
    marks: Marks,
    first_take_marked: bool,
    undo: Vec<UndoStep>,
    stop_requested: bool,
    last_frame: Option<tessera_view::Frame>,
    /// The Agent's pending Ask, if the Viewport is waiting on the Person.
    pending_ask: Option<String>,
    /// The Object the Person Pointed at, if any. Binds later "this".
    pointed: Option<String>,
    /// Last fetched chat Brains for the current Provider and Key.
    catalog: Option<Vec<Brain>>,
}

impl<P: Provider, V: View> Session<P, V> {
    /// Start working on a Scene. No account is required; the Scene is local.
    /// The Key is a settings concern, not a Scene concern (issue #4), so a
    /// Scene starts without one and the default store keeps it for this run.
    pub fn start(provider: P, view: V) -> Self {
        Self {
            provider,
            view,
            keyring: Box::new(Keyring::from_store(MemoryKeyStore::default())),
            scene: Scene::default(),
            marks: Marks::default(),
            first_take_marked: false,
            undo: Vec::new(),
            stop_requested: false,
            last_frame: None,
            pending_ask: None,
            pointed: None,
            catalog: None,
        }
    }

    /// Hand the Session the app settings store this machine keeps the Key in.
    /// The Key and Provider choice come from the machine; the Scene does not.
    pub fn with_key_store<S: KeyStore + 'static>(mut self, store: S) -> Self {
        self.keyring = Box::new(Keyring::from_store(store));
        self
    }

    /// The Person picked a Provider from the short list (spec story 4).
    /// Switching activates that Provider's remembered Key and Brain.
    pub fn set_provider(&mut self, provider: ProviderName) {
        self.keyring.set_provider(provider);
        self.catalog = self.keyring.catalog().map(Vec::from);
    }

    /// The Person pasted a Key for the chosen Provider (spec story 3).
    pub fn set_key(&mut self, key: &str) {
        self.keyring.set_key(key);
        self.catalog = self.keyring.catalog().map(Vec::from);
    }

    /// The Provider the Key belongs to, once the Person has picked one.
    pub fn chosen_provider(&self) -> Option<ProviderName> {
        self.keyring.provider()
    }

    /// Whether the Person has pasted a Key.
    pub fn has_key(&self) -> bool {
        self.keyring.has_key()
    }

    /// The Key last pasted for the active Provider, if any. Settings, not Scene.
    pub fn key(&self) -> Option<&str> {
        self.keyring.key()
    }

    /// What the current Provider offers, as settings should show it: chat,
    /// text in and out. Fetches when a Provider and Key are both set, and
    /// when the Person retries. Picks a default Brain if the Person has not.
    /// A vanished pick is not swapped: the list is still returned so they can
    /// pick another. A refresh updates the list, not a Brain already chosen.
    pub fn brains(&mut self) -> Result<Vec<Brain>, SessionError> {
        self.refresh_catalog()?;
        match self.resolve_brain() {
            Ok(_) | Err(SessionError::Brain(BrainError::Missing | BrainError::Unknown)) => self
                .catalog
                .clone()
                .ok_or(SessionError::Brain(BrainError::Missing)),
            Err(e) => Err(e),
        }
    }

    /// The live list, filtered to Brains whose name or id matches `query`.
    /// Empty query is the full list.
    pub fn brains_matching(&mut self, query: &str) -> Result<Vec<Brain>, SessionError> {
        Ok(self
            .brains()?
            .into_iter()
            .filter(|b| b.matches(query))
            .collect())
    }

    /// The Brain the Agent will think with: the Person's pick, or Tessera's
    /// default. None until a list has been fetched.
    pub fn chosen_brain(&self) -> Option<&Brain> {
        let id = self.keyring.brain()?;
        self.catalog.as_ref()?.iter().find(|b| b.id == id)
    }

    /// The Person picked a Brain from the live list.
    pub fn set_brain(&mut self, id: &str) -> Result<(), SessionError> {
        let catalog = self.ensure_catalog()?.clone();
        let brain = catalog
            .iter()
            .find(|b| b.id == id)
            .cloned()
            .ok_or(SessionError::Brain(BrainError::Unknown))?;
        self.keyring.set_brain(&brain);
        Ok(())
    }

    /// The Person's Intent. The Agent plans, lands each Verb on the Engine, and
    /// says what it did as it goes. A plan that names things the Scene does not
    /// have stops the take with an error; the Scene keeps every Verb that landed.
    ///
    /// The Key and Provider are asked for before the Agent is asked to think,
    /// and a lab that refuses the Key is said out loud — the Viewport is never
    /// a silent freeze (spec story 49).
    pub fn submit_intent(
        &mut self,
        intent: impl Into<Intent>,
    ) -> Result<Vec<String>, SessionError> {
        let intent = intent.into();
        let mut credentials = match self.keyring.credentials() {
            Some(credentials) => credentials,
            None => {
                let err = if !self.keyring.has_key() {
                    KeyError::Missing
                } else {
                    KeyError::MissingProvider
                };
                return Err(SessionError::Key(err));
            }
        };
        let brain = self.resolve_brain()?;
        if !intent.pictures().is_empty() && !brain.can_see {
            return Err(SessionError::Brain(BrainError::CannotSee));
        }
        credentials.brain = Some(brain.id);
        let names: Vec<String> = self.scene.objects.iter().map(|o| o.name.clone()).collect();
        let answering = self.pending_ask.is_some();
        let bindings = Bindings {
            objects: &names,
            pointed: self.pointed.as_deref(),
            pending_ask: self.pending_ask.as_deref(),
        };
        let reply = self
            .provider
            .respond(&intent, &credentials, bindings)
            .map_err(|e| SessionError::Key(Self::key_error(e)))?;
        // Stop applies to a take in progress, not the next Intent.
        self.stop_requested = false;
        self.scene.talk.push(TalkLine {
            text: intent.words.clone(),
            pictures: intent.pictures().to_vec(),
        });
        self.view.say(&intent.words);
        let Plan { narration, verbs } = match reply {
            Reply::Ask(question) => return Ok(self.hold_ask(question)),
            Reply::Plan(plan) => plan,
        };
        if let Some(question) = self.ask_instead(&verbs, answering) {
            return Ok(self.hold_ask(question));
        }
        self.pending_ask = None;
        let mut said = Vec::new();
        let mut stopped = false;
        let mut steered: Option<String> = None;
        for (line, verb) in narration.into_iter().zip(verbs.into_iter()) {
            let before = UndoStep {
                scene: self.scene.clone(),
                frame: self.last_frame.clone(),
            };
            let verb = self.bind_this(verb)?;
            self.apply(verb)?;
            self.undo.push(before);
            self.scene.talk.push(TalkLine {
                text: line.clone(),
                pictures: Vec::new(),
            });
            self.view.say(&line);
            said.push(line);
            if self.person_stopped() {
                stopped = true;
                let _ = self.view.steer_requested();
                break;
            }
            if let Some(words) = self.view.steer_requested() {
                steered = Some(words);
                break;
            }
        }
        if self.maybe_mark_first_take() {
            let line =
                "Marking this as your first take; you can always come back to it.".to_string();
            self.view.say(&line);
            said.push(line);
        }
        // Steer: current Verb finished; take the new Intent. Stop wins if both.
        if !stopped {
            if steered.is_none() {
                steered = self.view.steer_requested();
            }
            if let Some(words) = steered {
                said.extend(self.submit_intent(words)?);
            }
        }
        Ok(said)
    }

    /// What the Agent has said in this Scene, across all Intent so far. The Talk
    /// lives with the Scene (ADR-0014).
    pub fn talk(&self) -> Vec<TalkLine> {
        self.scene.talk.clone()
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
    /// name; there is no Guess here. Restore is a Verb-sized step: Undo
    /// returns to the Scene as it was before the restore.
    pub fn restore(&mut self, mark: &str) -> Result<(), MarkError> {
        let snapshot = self.marks.snapshot(mark)?;
        self.undo.push(UndoStep {
            scene: self.scene.clone(),
            frame: self.last_frame.clone(),
        });
        self.scene = snapshot.scene;
        self.put_frame(snapshot.frame);
        Ok(())
    }

    /// Keep this state of the Scene under a name the Person chose. Restore
    /// later returns both the place and the Talk as they were.
    pub fn mark(&mut self, name: &str) {
        self.marks
            .record(name, self.scene.clone(), self.last_frame.clone());
    }

    /// Revert the last completed Verb. Stackable: each call walks back one
    /// more Verb. Stopped work that never completed is not on this stack.
    pub fn undo(&mut self) -> Result<(), UndoError> {
        let step = self.undo.pop().ok_or(UndoError::NothingToUndo)?;
        self.scene = step.scene;
        self.put_frame(step.frame);
        Ok(())
    }

    /// The Person halted the current Verb. The Scene stays as the last
    /// completed Verb; the abandoned Verb is not on the Undo stack. Then they
    /// talk. Verbs are atomic, so a take in progress abandons every Verb that
    /// has not yet landed.
    pub fn stop(&mut self) {
        self.stop_requested = true;
    }

    /// Keep the Scene as a file on disk: the place and the Talk, so tomorrow's
    /// Rehearsal continues (spec stories 29–30, 34; ADR-0014). The Key is not
    /// written (spec story 6).
    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), SceneError> {
        scene_file::write(
            path.as_ref(),
            &self.scene,
            &self.marks,
            self.last_frame.as_ref(),
        )
    }

    /// Open yesterday's Scene file. Replaces the current place and Talk. The
    /// Key stays in settings, not in the file. A fresh Session is the usual
    /// caller (spec story 30).
    pub fn open(&mut self, path: impl AsRef<Path>) -> Result<(), SceneError> {
        let (scene, marks, frame) = scene_file::read(path.as_ref())?;
        self.scene = scene;
        self.marks = marks;
        self.first_take_marked = self.marks.names().iter().any(|n| n == FIRST_TAKE);
        self.undo.clear();
        self.stop_requested = false;
        self.pending_ask = None;
        self.pointed = None;
        self.view.show_scene(self.shown_scene());
        for line in &self.scene.talk {
            self.view.say(&line.text);
        }
        self.put_frame(frame);
        Ok(())
    }

    /// Keep a Still of the framed view: a picture file a friend can open
    /// without Tessera (spec story 32, ADR-0012).
    pub fn keep_still(&mut self, path: impl AsRef<Path>) -> Result<(), KeepError> {
        let (frame, clay) = self.framed_clay()?;
        self.view
            .keep_still(path.as_ref(), &frame, clay.as_ref())
            .map_err(|e| KeepError::Io(e.to_string()))
    }

    /// Keep a short Turntable video of an orbit so a friend can judge the
    /// Scene as 3D (spec story 33, ADR-0003, ADR-0012).
    pub fn keep_turntable(&mut self, path: impl AsRef<Path>) -> Result<(), KeepError> {
        let (frame, clay) = self.framed_clay()?;
        self.view
            .keep_turntable(path.as_ref(), &frame, clay.as_ref())
            .map_err(|e| KeepError::Io(e.to_string()))
    }

    fn framed_clay(&self) -> Result<(tessera_view::Frame, Option<Clay>), KeepError> {
        let frame = self.last_frame.clone().ok_or(KeepError::NoFrame)?;
        let clay = frame.object.as_ref().and_then(|name| {
            self.scene
                .objects
                .iter()
                .find(|o| o.name == *name)
                .map(|o| o.clay.clone())
        });
        Ok((frame, clay))
    }

    fn person_stopped(&mut self) -> bool {
        let from_view = self.view.stop_requested();
        let requested = self.stop_requested || from_view;
        self.stop_requested = false;
        requested
    }

    fn put_frame(&mut self, frame: Option<tessera_view::Frame>) {
        if self.view.orbiting() {
            // Do not Frame: camera stays, and Marks/Undo keep the last real Frame
            // (ADR-0007). The next Verb after Orbit ends Frames again.
            return;
        }
        if let Some(shown) = frame.as_ref() {
            self.view.show_frame(shown.clone());
        }
        self.last_frame = frame;
    }

    fn show_frame(&mut self, frame: tessera_view::Frame) {
        self.put_frame(Some(frame));
    }

    /// What the Viewport last showed: the camera's current Frame.
    pub fn view(&self) -> &V {
        &self.view
    }

    /// The Provider the Agent thinks with. Tests inspect the scripted one to
    /// see that pictures travelled with Intent.
    pub fn provider(&self) -> &P {
        &self.provider
    }

    /// Tests recover a scripted catalog so a retry from settings can fetch.
    pub fn provider_mut(&mut self) -> &mut P {
        &mut self.provider
    }

    /// The Agent's Ask, if the Viewport is waiting instead of acting.
    /// None means the last Intent was a Guess and work continued (ADR-0017).
    pub fn ask(&self) -> Option<&str> {
        self.pending_ask.as_deref()
    }

    /// The Person is turning the camera to judge the Scene (ADR-0007). Optional.
    /// The Agent does not Frame until the next Verb after [`end_orbit`].
    pub fn orbit(&mut self, delta_azimuth: f32, delta_elevation: f32) {
        self.view.orbit(delta_azimuth, delta_elevation);
    }

    /// The Person stopped turning. Does not Frame; the next Verb does.
    pub fn end_orbit(&mut self) {
        self.view.end_orbit();
    }

    /// The Person clicked an Object to mean "this." Optional; words still work
    /// alone (ADR-0013). The name is the one the Agent already gave in Narration.
    pub fn point(&mut self, name: &str) -> Result<(), SessionError> {
        if !self.scene.objects.iter().any(|o| o.name == name) {
            return Err(SessionError::UnknownObject(name.to_string()));
        }
        self.pointed = Some(name.to_string());
        Ok(())
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
            self.marks
                .record(FIRST_TAKE, self.scene.clone(), self.last_frame.clone());
            self.first_take_marked = true;
            true
        } else {
            false
        }
    }

    fn hold_ask(&mut self, question: String) -> Vec<String> {
        self.pending_ask = Some(question.clone());
        self.scene.talk.push(TalkLine {
            text: question.clone(),
            pictures: Vec::new(),
        });
        self.view.say(&question);
        vec![question]
    }

    /// Remove is hard to Undo: Ask unless that Object is Pointed, or the Person
    /// is answering an Ask by naming it (words still work alone, ADR-0013).
    /// Unbound "this" is an Ask, not a missing Object.
    fn ask_instead(&self, verbs: &[Verb], answering: bool) -> Option<String> {
        for verb in verbs {
            if self.says_this(verb) && self.pointed.is_none() {
                return Some("Which Object do you mean? Point at it, or name it.".to_string());
            }
            if let Verb::remove { object } = verb {
                let name = if object.0 == "this" {
                    self.pointed.as_deref()
                } else {
                    Some(object.0.as_str())
                };
                let pointed_ok = matches!(
                    (name, self.pointed.as_deref()),
                    (Some(n), Some(p)) if n == p
                );
                let named_answer = answering && object.0 != "this";
                if !pointed_ok && !named_answer {
                    let who = name.unwrap_or("this");
                    return Some(format!("Remove {who}? Point at it, or say which Object."));
                }
            }
        }
        None
    }

    fn says_this(&self, verb: &Verb) -> bool {
        match verb {
            Verb::frame(FrameTarget::Object(object))
            | Verb::wear { object, .. }
            | Verb::carve { object, .. }
            | Verb::inflate { object, .. }
            | Verb::taper { object, .. }
            | Verb::weather { object, .. }
            | Verb::remove { object } => object.0 == "this",
            Verb::join { object, with } | Verb::cut { object, with } => {
                object.0 == "this" || with.0 == "this"
            }
            _ => false,
        }
    }

    /// Bind "this" in a Verb to the Object the Person Pointed at.
    fn bind_this(&self, verb: Verb) -> Result<Verb, SessionError> {
        Ok(match verb {
            Verb::frame(FrameTarget::Object(object)) => {
                Verb::frame(FrameTarget::Object(self.resolve_this(object)?))
            }
            Verb::wear { object, family } => Verb::wear {
                object: self.resolve_this(object)?,
                family,
            },
            Verb::carve {
                object,
                amount,
                region,
            } => Verb::carve {
                object: self.resolve_this(object)?,
                amount,
                region,
            },
            Verb::inflate {
                object,
                amount,
                region,
            } => Verb::inflate {
                object: self.resolve_this(object)?,
                amount,
                region,
            },
            Verb::taper {
                object,
                amount,
                along,
            } => Verb::taper {
                object: self.resolve_this(object)?,
                amount,
                along,
            },
            Verb::weather { object, amount } => Verb::weather {
                object: self.resolve_this(object)?,
                amount,
            },
            Verb::remove { object } => Verb::remove {
                object: self.resolve_this(object)?,
            },
            Verb::join { object, with } => Verb::join {
                object: self.resolve_this(object)?,
                with: self.resolve_this(with)?,
            },
            Verb::cut { object, with } => Verb::cut {
                object: self.resolve_this(object)?,
                with: self.resolve_this(with)?,
            },
            other => other,
        })
    }

    fn resolve_this(&self, object: ObjectRef) -> Result<ObjectRef, SessionError> {
        if object.0 != "this" {
            return Ok(object);
        }
        match &self.pointed {
            Some(name) => Ok(ObjectRef(name.clone())),
            None => Err(SessionError::UnknownObject("this".to_string())),
        }
    }

    fn apply(&mut self, verb: Verb) -> Result<(), SessionError> {
        match verb {
            Verb::place { name, part, at } => {
                let object = Object::among(name.0.clone(), at, part, &self.scene.objects);
                self.scene.objects.push(object);
                self.show_frame(tessera_view::Frame {
                    object: Some(name.0),
                });
            }
            Verb::frame(target) => {
                let object = match target {
                    FrameTarget::Object(ObjectRef(name)) => Some(name),
                    FrameTarget::Scene => None,
                };
                self.show_frame(tessera_view::Frame { object });
            }
            Verb::light(condition) => self.scene.light = Some(condition),
            Verb::sky(family) => self.scene.sky = Some(family),
            Verb::wear { object, family } => {
                match self.scene.objects.iter_mut().find(|o| o.name == object.0) {
                    Some(o) => o.family = Some(family),
                    None => return Err(SessionError::UnknownObject(object.0)),
                }
            }
            Verb::carve {
                object,
                amount,
                region,
            } => self.sculpt(object, |clay| clay.carve(amount, region))?,
            Verb::inflate {
                object,
                amount,
                region,
            } => self.sculpt(object, |clay| clay.inflate(amount, region))?,
            Verb::taper {
                object,
                amount,
                along,
            } => self.sculpt(object, |clay| clay.taper(amount, along))?,
            Verb::weather { object, amount } => self.sculpt(object, |clay| clay.weather(amount))?,
            Verb::remove { object } => {
                match self.scene.objects.iter().position(|o| o.name == object.0) {
                    Some(idx) => {
                        self.scene.objects.remove(idx);
                        if self.pointed.as_deref() == Some(object.0.as_str()) {
                            self.pointed = None;
                        }
                        self.show_frame(tessera_view::Frame { object: None });
                    }
                    None => return Err(SessionError::UnknownObject(object.0)),
                }
            }
            Verb::join { object, with } => {
                self.combine(object, with, |keep, other| keep.join(other))?;
            }
            Verb::cut { object, with } => {
                self.combine(object, with, |keep, other| keep.cut(other))?;
            }
        }
        self.view.show_scene(self.shown_scene());
        Ok(())
    }

    fn shown_scene(&self) -> tessera_view::ShownScene {
        tessera_view::ShownScene {
            objects: self
                .scene
                .objects
                .iter()
                .map(|o| tessera_view::ShownObject {
                    name: o.name.clone(),
                    clay: o.clay.clone(),
                    at: o.translation(),
                    family: o.family.as_ref().map(|f| f.0.clone()),
                })
                .collect(),
            sky: self.scene.sky.as_ref().map(|f| f.0.clone()),
            light: self.scene.light,
        }
    }

    /// Join or cut two named Objects: the first keeps its name, the second is
    /// consumed, and the camera Frames the work.
    fn combine(
        &mut self,
        object: ObjectRef,
        with: ObjectRef,
        op: impl FnOnce(&mut Object, &Object),
    ) -> Result<(), SessionError> {
        let keep_idx = self
            .scene
            .objects
            .iter()
            .position(|o| o.name == object.0)
            .ok_or_else(|| SessionError::UnknownObject(object.0.clone()))?;
        let with_idx = self
            .scene
            .objects
            .iter()
            .position(|o| o.name == with.0)
            .ok_or_else(|| SessionError::UnknownObject(with.0.clone()))?;
        if keep_idx == with_idx {
            return Err(SessionError::UnknownObject(with.0));
        }
        let other = self.scene.objects[with_idx].clone();
        op(&mut self.scene.objects[keep_idx], &other);
        self.scene.objects.remove(with_idx);
        if self.pointed.as_deref() == Some(with.0.as_str()) {
            self.pointed = None;
        }
        self.show_frame(tessera_view::Frame {
            object: Some(object.0),
        });
        Ok(())
    }

    /// Work one named Object's Clay and Frame it so the Person is looking at
    /// the silhouette that just changed.
    fn sculpt(
        &mut self,
        object: ObjectRef,
        op: impl FnOnce(&mut Clay),
    ) -> Result<(), SessionError> {
        match self.scene.objects.iter_mut().find(|o| o.name == object.0) {
            Some(o) => {
                op(&mut o.clay);
                self.show_frame(tessera_view::Frame {
                    object: Some(object.0),
                });
                Ok(())
            }
            None => Err(SessionError::UnknownObject(object.0)),
        }
    }

    /// A lab refusal, as the Person can act on it.
    fn key_error(error: ProviderError) -> KeyError {
        match error {
            ProviderError::InvalidKey => KeyError::Invalid,
            ProviderError::OutOfCredit => KeyError::OutOfCredit,
            ProviderError::Unavailable(reason) => KeyError::Unavailable(reason),
        }
    }

    fn ensure_catalog(&mut self) -> Result<&Vec<Brain>, SessionError> {
        if self.catalog.is_some() {
            return Ok(self.catalog.as_ref().expect("just checked"));
        }
        self.refresh_catalog()
    }

    fn refresh_catalog(&mut self) -> Result<&Vec<Brain>, SessionError> {
        let credentials = match self.keyring.credentials() {
            Some(credentials) => credentials,
            None => {
                let err = if !self.keyring.has_key() {
                    KeyError::Missing
                } else {
                    KeyError::MissingProvider
                };
                return Err(SessionError::Key(err));
            }
        };
        let brains = match self.provider.list_brains(&credentials) {
            Ok(brains) => brains,
            Err(e) => {
                if let Some(cached) = self.keyring.catalog() {
                    self.catalog = Some(cached.to_vec());
                    return Ok(self.catalog.as_ref().expect("just stored"));
                }
                return Err(SessionError::Key(Self::key_error(e)));
            }
        };
        self.catalog = Some(brains);
        if let Some(catalog) = &self.catalog {
            self.keyring.set_catalog(catalog);
        }
        Ok(self.catalog.as_ref().expect("just stored"))
    }

    /// The Brain the Agent thinks with: remembered pick if still offered,
    /// otherwise the default. Does not silently swap a vanished pick.
    fn resolve_brain(&mut self) -> Result<Brain, SessionError> {
        let catalog = self.ensure_catalog()?.clone();
        if catalog.is_empty() {
            return Err(SessionError::Brain(BrainError::Missing));
        }
        if let Some(id) = self.keyring.brain().map(str::to_string) {
            return catalog
                .into_iter()
                .find(|b| b.id == id)
                .ok_or(SessionError::Brain(BrainError::Unknown));
        }
        let default = Brain::default_in(&catalog)
            .cloned()
            .ok_or(SessionError::Brain(BrainError::Missing))?;
        self.keyring.set_brain(&default);
        Ok(default)
    }
}
