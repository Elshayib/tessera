//! The scripted Provider tests use instead of a live lab. It never hits the
//! network: it hands back the plan a real Provider would have thought up.

use crate::intent::Intent;
use crate::plan::Plan;
use crate::provider::{
    Bindings, Brain, BrainKind, Credentials, Provider, ProviderError, Reply, chat_brains,
};
use tessera_engine::verb::{FrameTarget, MaterialFamily, ObjectRef, Part, Verb};

/// Hands back the scripted Plans, Asks, or troubles, one per Intent, in the
/// order they were added. A default ScriptedProvider offers one chat Brain
/// that can see, so tests that do not care about the catalog still think.
#[derive(Debug)]
pub struct ScriptedProvider {
    outcomes: Vec<Result<Reply, ProviderError>>,
    next: usize,
    received: Vec<Intent>,
    received_credentials: Vec<Credentials>,
    brains: Vec<Brain>,
    next_offerings: Vec<Vec<Brain>>,
    list_error: Option<ProviderError>,
}

impl Default for ScriptedProvider {
    fn default() -> Self {
        Self {
            outcomes: Vec::new(),
            next: 0,
            received: Vec::new(),
            received_credentials: Vec::new(),
            brains: vec![Brain {
                id: "scripted".into(),
                name: "Scripted".into(),
                can_see: true,
                price: None,
                kind: BrainKind::Chat,
            }],
            next_offerings: Vec::new(),
            list_error: None,
        }
    }
}

impl ScriptedProvider {
    /// Script the Provider so the next Intent in line gets this Plan.
    pub fn plan(mut self, plan: Plan) -> Self {
        self.outcomes.push(Ok(Reply::Plan(plan)));
        self
    }

    /// Script the Provider so the next Intent in line is an Ask: the Viewport
    /// waits and no Verb lands until the Person answers.
    pub fn ask(mut self, question: impl Into<String>) -> Self {
        self.outcomes.push(Ok(Reply::Ask(question.into())));
        self
    }

    /// Script the Provider so the next Intent in line is refused this way.
    pub fn fail(mut self, error: ProviderError) -> Self {
        self.outcomes.push(Err(error));
        self
    }

    /// Script the live list of Brains this Provider currently offers.
    pub fn offering(mut self, brains: Vec<Brain>) -> Self {
        self.brains = brains;
        self
    }

    /// Script listing so it fails this way instead of returning Brains.
    /// Stays down until [`recover_catalog`].
    pub fn catalog_fail(mut self, error: ProviderError) -> Self {
        self.list_error = Some(error);
        self
    }

    /// The catalog is reachable again, so a retry from settings can fetch.
    pub fn recover_catalog(&mut self) {
        self.list_error = None;
    }

    /// After the current list has been fetched, the next fetch offers this
    /// instead — a catalog refresh.
    pub fn then_offering(mut self, brains: Vec<Brain>) -> Self {
        self.next_offerings.push(brains);
        self
    }

    /// Credentials that crossed the seam with each Intent, in order.
    pub fn received_credentials(&self) -> &[Credentials] {
        &self.received_credentials
    }

    /// Convenience: a plan that places one named Object and Frames it — the
    /// shape a real Provider's first response to Intent should have.
    pub fn place_and_frame(name: &str, part: impl Into<Part>, at: &str) -> Plan {
        let part = part.into();
        Plan::new(
            vec![
                format!("Placing {name} {at} out of a {}.", part.word()),
                format!("Framing {name} so you can judge it."),
            ],
            vec![
                Verb::place {
                    name: ObjectRef(name.to_string()),
                    part,
                    at: at.to_string(),
                },
                Verb::frame(FrameTarget::Object(ObjectRef(name.to_string()))),
            ],
        )
    }

    /// Every Intent this Provider has been asked to think about, in order.
    pub fn received(&self) -> &[Intent] {
        &self.received
    }

    /// Convenience: a plan that sets the Scene's light and sky.
    pub fn light_and_sky(light: tessera_engine::LightCondition, sky: &str) -> Plan {
        Plan::new(
            vec![
                format!("Setting the light to {}.", light.word()),
                format!("Dressing the sky in {sky}."),
            ],
            vec![
                Verb::light(light),
                Verb::sky(MaterialFamily(sky.to_string())),
            ],
        )
    }
}

impl Provider for ScriptedProvider {
    fn respond(
        &mut self,
        intent: &Intent,
        credentials: &Credentials,
        _bindings: Bindings<'_>,
    ) -> Result<Reply, ProviderError> {
        self.received.push(intent.clone());
        self.received_credentials.push(credentials.clone());
        let outcome = self.outcomes.get(self.next).cloned().unwrap_or_else(|| {
            panic!(
                "the test scripted {} outcome(s) but the Provider was asked {} time(s)",
                self.outcomes.len(),
                self.next + 1
            )
        });
        self.next += 1;
        outcome
    }

    fn list_brains(&mut self, _credentials: &Credentials) -> Result<Vec<Brain>, ProviderError> {
        if let Some(error) = self.list_error.clone() {
            return Err(error);
        }
        let offered = self.brains.clone();
        if !self.next_offerings.is_empty() {
            self.brains = self.next_offerings.remove(0);
        }
        Ok(chat_brains(offered))
    }
}
