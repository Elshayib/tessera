//! The scripted Provider tests use instead of a live lab. It never hits the
//! network: it hands back the plan a real Provider would have thought up.

use crate::plan::Plan;
use crate::provider::Provider;
use tessera_engine::verb::{FrameTarget, ObjectRef, Verb};

/// Hands back the scripted Plans, one per Intent, in the order they were added.
#[derive(Debug, Default)]
pub struct ScriptedProvider {
    plans: Vec<Plan>,
    next: usize,
}

impl ScriptedProvider {
    /// Script the Provider so the next Intent in line gets this Plan.
    pub fn plan(mut self, plan: Plan) -> Self {
        self.plans.push(plan);
        self
    }

    /// Convenience: a plan that places one named Object and Frames it — the
    /// shape a real Provider's first response to Intent should have.
    pub fn place_and_frame(name: &str, part: &str, at: &str) -> Plan {
        Plan::new(
            vec![
                format!("Placing {name} {at} out of {part}."),
                format!("Framing {name} so you can judge it."),
            ],
            vec![
                Verb::place {
                    name: ObjectRef(name.to_string()),
                    part: part.to_string(),
                    at: at.to_string(),
                },
                Verb::frame(FrameTarget::Object(ObjectRef(name.to_string()))),
            ],
        )
    }
}

impl Provider for ScriptedProvider {
    fn respond(&mut self, _intent: &str) -> Plan {
        let plan = self.plans.get(self.next).cloned().unwrap_or_else(|| {
            panic!(
                "the test scripted {} Plan(s) but the Provider was asked {} time(s)",
                self.plans.len(),
                self.next + 1
            )
        });
        self.next += 1;
        plan
    }
}
