//! The module under product test: Tessera as the Person meets it.
//!
//! A Session holds the open Scene, the Agent's Provider, the Viewport, and the
//! Scene's Marks. The Person submits Intent; the Agent plans through the
//! Provider, lands each Verb on the Engine, and Narrates what it did as it goes.
//! When a take composes the named place, it lands as the automatic First-take
//! Mark.

use crate::keyring::{KeyStore, Keyring, MemoryKeyStore};
use crate::marks::{MarkError, Marks};
use crate::plan::Plan;
use crate::provider::{Provider, ProviderError, ProviderName};
use crate::scene::Scene;
use tessera_engine::Clay;
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
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SessionError {
    /// The plan named an Object the Scene does not have.
    #[error("The Scene has no Object named {0}.")]
    UnknownObject(String),
    /// The Agent has no brain to think with: the Key is missing, invalid, or
    /// out of credit (issue #4).
    #[error("{0}")]
    Key(KeyError),
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

/// A Scene in progress. One Person, one Scene on screen (v1).
pub struct Session<P: Provider, V: View> {
    provider: P,
    view: V,
    keyring: Box<Keyring<dyn KeyStore>>,
    scene: Scene,
    narration: Vec<NarrationLine>,
    marks: Marks,
    first_take_marked: bool,
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
            narration: Vec::new(),
            marks: Marks::default(),
            first_take_marked: false,
        }
    }

    /// Hand the Session the app settings store this machine keeps the Key in.
    /// The Key and Provider choice come from the machine; the Scene does not.
    pub fn with_key_store<S: KeyStore + 'static>(mut self, store: S) -> Self {
        self.keyring = Box::new(Keyring::from_store(store));
        self
    }

    /// The Person picked a Provider from the short list (spec story 4).
    pub fn set_provider(&mut self, provider: ProviderName) {
        self.keyring.set_provider(provider);
    }

    /// The Person pasted a Key for the chosen Provider (spec story 3).
    pub fn set_key(&mut self, key: &str) {
        self.keyring.set_key(key);
    }

    /// The Provider the Key belongs to, once the Person has picked one.
    pub fn chosen_provider(&self) -> Option<ProviderName> {
        self.keyring.provider()
    }

    /// Whether the Person has pasted a Key.
    pub fn has_key(&self) -> bool {
        self.keyring.has_key()
    }

    /// The Person's words. The Agent plans, lands each Verb on the Engine, and
    /// says what it did as it goes. A plan that names things the Scene does not
    /// have stops the take with an error; the Scene keeps every Verb that landed.
    ///
    /// The Key and Provider are asked for before the Agent is asked to think,
    /// and a lab that refuses the Key is said out loud — the Viewport is never
    /// a silent freeze (spec story 49).
    pub fn submit_intent(&mut self, intent: &str) -> Result<Vec<String>, SessionError> {
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
        let Plan { narration, verbs } = self
            .provider
            .respond(intent, &credentials)
            .map_err(|e| SessionError::Key(Self::key_error(e)))?;
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
                    .push(Object::new(name.0.clone(), at, part));
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
        }
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
                self.view.show_frame(tessera_view::Frame {
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
}
