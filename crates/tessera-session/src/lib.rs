//! Session: Tessera as the Person meets it. Tests act as the Person here.
//!
//! The Person submits Intent, Steer, Stop, Point, Orbit, Undo, Mark, Restore,
//! save/open Scene, keep Still, keep Turntable, and set Key/Provider. They never
//! issue Verbs (ADR-0002): the Agent does, guided by a Provider's plan.

pub mod plan;
pub mod provider;
pub mod scripted_provider;
pub mod session;
pub mod view;

pub use plan::Plan;
pub use provider::Provider;
pub use scripted_provider::ScriptedProvider;
pub use session::{NarrationLine, Session};
pub use view::ViewReport;
