//! Production adapters for the short list of Providers (ADR-0016).
//!
//! The Provider trait lives under Session. This crate wraps Anthropic, OpenAI,
//! and Google in one [`LivePlanner`]: same Verbs, same system prompt, three
//! HTTP envelopes. Tests inject [`FakeTransport`] and never hit a live lab.

mod lab;
mod prompt;
mod transport;

use tessera_session::{Bindings, Brain, Credentials, Intent, Provider, ProviderError, Reply};

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

impl LivePlanner<FakeTransport> {
    /// What the fake transport recorded, in send order. Tests assert the Brain
    /// id in the chat POST and that listing is a GET.
    pub fn transport_sent(&self) -> &[HttpRequest] {
        &self.transport.sent
    }
}

impl<T: Transport> Provider for LivePlanner<T> {
    fn respond(
        &mut self,
        intent: &Intent,
        credentials: &Credentials,
        bindings: Bindings<'_>,
    ) -> Result<Reply, ProviderError> {
        let request = lab::pack(credentials, intent, bindings);
        let response = self.transport.post(&request).map_err(|_| {
            ProviderError::Unavailable(
                "Could not reach the Provider. Check the network and try again.".to_string(),
            )
        })?;
        let text = lab::unpack(credentials.provider, &response)?;
        Reply::from_json(&text).map_err(|_| {
            ProviderError::Unavailable(
                "The Agent could not plan that. Try again, or pick another Provider.".to_string(),
            )
        })
    }

    fn list_brains(&mut self, credentials: &Credentials) -> Result<Vec<Brain>, ProviderError> {
        lab::list_brains(&mut self.transport, credentials)
    }
}
