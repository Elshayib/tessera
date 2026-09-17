//! The Provider seam: where the Agent's thinking comes from.

use crate::plan::Plan;

/// A company whose model the Agent thinks with, given a Key. The Verbs do not
/// change when the Provider does (ADR-0016).
pub trait Provider {
    /// Turn the Person's Intent into a plan of Verbs for the open Scene.
    fn respond(&mut self, intent: &str) -> Plan;
}
