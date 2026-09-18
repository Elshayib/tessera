//! The HTTP seam under a live Provider. Production talks to a lab; tests swap
//! in [`FakeTransport`] and never hit the network.

use std::collections::VecDeque;
use std::time::Duration;

/// One POST a live Provider is about to send.
#[derive(Debug, Clone)]
pub struct HttpRequest {
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

/// One POST response, including 4xx/5xx. Mapping those to Key errors is the
/// dialect's job, not the transport's.
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

/// The network could not complete a POST.
#[derive(Debug, Clone)]
pub struct TransportError(pub String);

impl std::fmt::Display for TransportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

/// A POST client. One adapter hits the network; one is scripted for tests.
pub trait Transport {
    fn post(&mut self, request: &HttpRequest) -> Result<HttpResponse, TransportError>;
}

/// Production HTTP: rustls, blocking, status codes left on the response so a
/// dialect can tell invalid Key from out of credit.
pub struct UreqTransport {
    agent: ureq::Agent,
}

impl UreqTransport {
    pub fn new() -> Self {
        let agent = ureq::Agent::config_builder()
            .http_status_as_error(false)
            .timeout_global(Some(Duration::from_secs(60)))
            .build()
            .into();
        Self { agent }
    }
}

impl Default for UreqTransport {
    fn default() -> Self {
        Self::new()
    }
}

impl Transport for UreqTransport {
    fn post(&mut self, request: &HttpRequest) -> Result<HttpResponse, TransportError> {
        let mut req = self.agent.post(&request.url);
        for (name, value) in &request.headers {
            req = req.header(name, value);
        }
        let mut resp = req
            .send(request.body.as_str())
            .map_err(|e| TransportError(e.to_string()))?;
        let status = resp.status().as_u16();
        let mut headers = Vec::new();
        for (name, value) in resp.headers() {
            if let Ok(value) = value.to_str() {
                headers.push((name.as_str().to_string(), value.to_string()));
            }
        }
        let body = resp
            .body_mut()
            .read_to_string()
            .map_err(|e| TransportError(e.to_string()))?;
        Ok(HttpResponse {
            status,
            headers,
            body,
        })
    }
}

/// Scripted HTTP for tests: never opens a socket.
#[derive(Debug, Default)]
pub struct FakeTransport {
    replies: VecDeque<Result<HttpResponse, TransportError>>,
    /// What the live Provider actually packed, in send order.
    pub sent: Vec<HttpRequest>,
}

impl FakeTransport {
    pub fn replies(mut self, status: u16, body: impl Into<String>) -> Self {
        self.replies.push_back(Ok(HttpResponse {
            status,
            headers: Vec::new(),
            body: body.into(),
        }));
        self
    }

    pub fn unreachable(mut self) -> Self {
        self.replies
            .push_back(Err(TransportError("connection failed".to_string())));
        self
    }
}

impl Transport for FakeTransport {
    fn post(&mut self, request: &HttpRequest) -> Result<HttpResponse, TransportError> {
        self.sent.push(request.clone());
        self.replies.pop_front().unwrap_or_else(|| {
            Err(TransportError(
                "the test scripted no further HTTP reply".to_string(),
            ))
        })
    }
}
