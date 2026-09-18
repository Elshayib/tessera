//! Live Provider adapters (issue #4), driven as the Person: Session + a fake
//! HTTP transport. No socket is opened. The same plan JSON is wrapped in each
//! lab's envelope so the Verbs cannot drift.

use tessera_provider::{FakeTransport, LivePlanner};
use tessera_session::{KeyError, ProviderName, Session, SessionError, ViewReport};

const PLAN: &str = r#"{
  "narration": [
    "Placing the lighthouse on the cliff out of a cylinder.",
    "Framing the lighthouse so you can judge it."
  ],
  "verbs": [
    {"verb": "place", "name": "the lighthouse", "part": "cylinder", "at": "on the cliff"},
    {"verb": "frame", "target": "the lighthouse"}
  ]
}"#;

fn anthropic_ok(plan: &str) -> String {
    serde_json::json!({
        "content": [{ "type": "text", "text": plan }]
    })
    .to_string()
}

fn openai_ok(plan: &str) -> String {
    serde_json::json!({
        "choices": [{ "message": { "role": "assistant", "content": plan } }]
    })
    .to_string()
}

fn google_ok(plan: &str) -> String {
    serde_json::json!({
        "candidates": [{ "content": { "parts": [{ "text": plan }] } }]
    })
    .to_string()
}

fn envelope(provider: ProviderName, plan: &str) -> (u16, String) {
    match provider {
        ProviderName::Anthropic => (200, anthropic_ok(plan)),
        ProviderName::OpenAI => (200, openai_ok(plan)),
        ProviderName::Google => (200, google_ok(plan)),
    }
}

fn session(
    provider: ProviderName,
    transport: FakeTransport,
) -> Session<LivePlanner<FakeTransport>, ViewReport> {
    let mut session = Session::start(LivePlanner::with_transport(transport), ViewReport::new());
    session.set_provider(provider);
    session.set_key("sk-test");
    session
}

/// The same plan JSON, three envelopes: the Scene that lands is the same.
#[test]
fn verbs_do_not_change_across_providers() {
    for provider in ProviderName::ALL {
        let (status, body) = envelope(provider, PLAN);
        let mut session = session(provider, FakeTransport::default().replies(status, body));
        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect("the fake lab returns a plan");

        let objects = session.objects();
        assert_eq!(
            objects.len(),
            1,
            "{provider:?} must land the same Object the plan named"
        );
        assert_eq!(objects[0].name, "the lighthouse");
        let last = session.view().last_frame().expect("framed");
        assert_eq!(last.object.as_deref(), Some("the lighthouse"));
    }
}

#[test]
fn anthropic_rejects_an_invalid_key() {
    let body = serde_json::json!({
        "type": "error",
        "error": { "type": "authentication_error", "message": "invalid x-api-key" }
    })
    .to_string();
    let mut session = session(
        ProviderName::Anthropic,
        FakeTransport::default().replies(401, body),
    );
    let err = session
        .submit_intent("a lighthouse")
        .expect_err("401 is an invalid Key");
    assert_eq!(err, SessionError::Key(KeyError::Invalid));
    assert!(session.objects().is_empty());
}

#[test]
fn openai_rejects_an_invalid_key() {
    let body = serde_json::json!({
        "error": { "message": "Incorrect API key provided", "type": "invalid_request_error" }
    })
    .to_string();
    let mut session = session(
        ProviderName::OpenAI,
        FakeTransport::default().replies(401, body),
    );
    let err = session
        .submit_intent("a lighthouse")
        .expect_err("401 is an invalid Key");
    assert_eq!(err, SessionError::Key(KeyError::Invalid));
}

#[test]
fn google_rejects_an_invalid_key_with_http_400() {
    let body = serde_json::json!({
        "error": {
            "code": 400,
            "message": "API key not valid. Please pass a valid API key.",
            "status": "INVALID_ARGUMENT",
            "details": [{
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                "reason": "API_KEY_INVALID"
            }]
        }
    })
    .to_string();
    let mut session = session(
        ProviderName::Google,
        FakeTransport::default().replies(400, body),
    );
    let err = session
        .submit_intent("a lighthouse")
        .expect_err("Google signals a bad Key as 400 API_KEY_INVALID");
    assert_eq!(err, SessionError::Key(KeyError::Invalid));
}

#[test]
fn anthropic_out_of_credit_is_actionable() {
    let body = serde_json::json!({
        "type": "error",
        "error": { "type": "billing_error", "message": "credit remaining is too low" }
    })
    .to_string();
    let mut session = session(
        ProviderName::Anthropic,
        FakeTransport::default().replies(402, body),
    );
    let err = session.submit_intent("a lighthouse").expect_err("402");
    assert_eq!(err, SessionError::Key(KeyError::OutOfCredit));
    assert!(err.to_string().to_lowercase().contains("credit"));
}

#[test]
fn openai_out_of_credit_is_actionable() {
    let body = serde_json::json!({
        "error": {
            "message": "You exceeded your current quota",
            "type": "insufficient_quota",
            "code": "credit_balance_exhausted"
        }
    })
    .to_string();
    let mut session = session(
        ProviderName::OpenAI,
        FakeTransport::default().replies(429, body),
    );
    let err = session
        .submit_intent("a lighthouse")
        .expect_err("429 quota");
    assert_eq!(err, SessionError::Key(KeyError::OutOfCredit));
}

#[test]
fn google_out_of_credit_is_actionable() {
    let body = serde_json::json!({
        "error": {
            "code": 400,
            "message": "Gemini API free tier is not available in your country. Please enable billing.",
            "status": "FAILED_PRECONDITION"
        }
    })
    .to_string();
    let mut session = session(
        ProviderName::Google,
        FakeTransport::default().replies(400, body),
    );
    let err = session
        .submit_intent("a lighthouse")
        .expect_err("billing not enabled");
    assert_eq!(err, SessionError::Key(KeyError::OutOfCredit));
}

#[test]
fn unreachable_lab_is_not_a_silent_freeze() {
    let mut session = session(
        ProviderName::Anthropic,
        FakeTransport::default().unreachable(),
    );
    let err = session
        .submit_intent("a lighthouse")
        .expect_err("no socket, no freeze");
    match err {
        SessionError::Key(KeyError::Unavailable(reason)) => {
            assert!(
                reason.contains("reach") || reason.contains("network"),
                "{reason}"
            );
        }
        other => panic!("expected Unavailable, got {other:?}"),
    }
    assert!(session.objects().is_empty());
}

/// Changing Provider mid-Scene still lands the next plan on the same Objects.
#[test]
fn changing_provider_keeps_the_open_scene() {
    let first = FakeTransport::default().replies(200, anthropic_ok(PLAN));
    let mut session = session(ProviderName::Anthropic, first);
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .unwrap();
    assert_eq!(session.objects().len(), 1);

    session.set_provider(ProviderName::OpenAI);
    session.set_key("sk-openai");
    assert_eq!(session.objects()[0].name, "the lighthouse");
    assert_eq!(session.talk().len(), 2);
}
