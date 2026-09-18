//! The scripted Provider tests use instead of a live lab. It never hits the
//! network: it hands back the plan a real Provider would have thought up.

use crate::plan::Plan;
use crate::provider::{Credentials, Provider, ProviderError};
use tessera_engine::verb::{FrameTarget, MaterialFamily, ObjectRef, Primitive, Verb};

/// Hands back the scripted Plans (or troubles), one per Intent, in the order
/// they were added.
#[derive(Debug, Default)]
pub struct ScriptedProvider {
    outcomes: Vec<Result<Plan, ProviderError>>,
    next: usize,
}

impl ScriptedProvider {
    /// Script the Provider so the next Intent in line gets this Plan.
    pub fn plan(mut self, plan: Plan) -> Self {
        self.outcomes.push(Ok(plan));
        self
    }

    /// Script the Provider so the next Intent in line is refused this way.
    pub fn fail(mut self, error: ProviderError) -> Self {
        self.outcomes.push(Err(error));
        self
    }

    /// Convenience: a plan that places one named Object and Frames it — the
    /// shape a real Provider's first response to Intent should have.
    pub fn place_and_frame(name: &str, part: Primitive, at: &str) -> Plan {
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
        _intent: &str,
        _credentials: &Credentials,
    ) -> Result<Plan, ProviderError> {
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
}
