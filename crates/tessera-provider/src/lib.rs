//! Production adapters for the short list of Providers (ADR-0016).
//!
//! The Provider trait lives under Session. This crate wraps Anthropic, OpenAI,
//! and Google in one [`LivePlanner`]: same Verbs, same system prompt, three
//! HTTP envelopes. Tests inject [`FakeTransport`] and never hit a live lab.

mod lab;
mod prompt;
mod transport;

use tessera_session::{Credentials, Plan, Provider, ProviderError};

pub use prompt::SYSTEM;
pub use transport::{
    FakeTransport, HttpRequest, HttpResponse, Transport, TransportError, UreqTransport,
};

/// A Provider that thinks by POSTing Intent to the chosen lab.
pub struct LivePlanner<T: Transport> {
    transport: T,
}

impl LivePlanner<UreqTransport> {
    pub fn new() -> Self {
        Self {
            transport: UreqTransport::new(),
        }
    }
}

impl Default for LivePlanner<UreqTransport> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Transport> LivePlanner<T> {
    pub fn with_transport(transport: T) -> Self {
        Self { transport }
    }
}

impl<T: Transport> Provider for LivePlanner<T> {
    fn respond(&mut self, intent: &str, credentials: &Credentials) -> Result<Plan, ProviderError> {
        let request = lab::pack(credentials, intent);
        let response = self.transport.post(&request).map_err(|_| {
            ProviderError::Unavailable(
                "Could not reach the Provider. Check the network and try again.".to_string(),
            )
        })?;
        let text = lab::unpack(credentials.provider, &response)?;
        Plan::from_json(&text).map_err(|_| {
            ProviderError::Unavailable(
                "The Agent could not plan that. Try again, or pick another Provider.".to_string(),
            )
        })
    }
}
