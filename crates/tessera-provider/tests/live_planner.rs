//! Live Provider adapters (issue #4), driven as the Person: Session + a fake
//! HTTP transport. No socket is opened. The same plan JSON is wrapped in each
//! lab's envelope so the Verbs cannot drift.

use tessera_provider::{FakeTransport, LivePlanner};
use tessera_session::{KeyError, KitPart, Part, ProviderName, Session, SessionError, ViewReport};

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

const KIT_PLAN: &str = r#"{
  "narration": [
    "A cliff slab under the sky.",
    "The lantern room sits on the tower.",
    "Framing the lantern room so you can judge it."
  ],
  "verbs": [
    {"verb": "place", "name": "the cliff slab", "part": "cliff slab", "at": "under the sky"},
    {"verb": "place", "name": "the lantern room", "part": "lantern room", "at": "atop the tower"},
    {"verb": "frame", "target": "the lantern room"}
  ]
}"#;

const PLACE_ROOF: &str = r#"{
  "narration": [
    "Capping it with a roof.",
    "Framing the roof so you can judge it."
  ],
  "verbs": [
    {"verb": "place", "name": "the roof", "part": "cone", "at": "atop the lighthouse"},
    {"verb": "frame", "target": "the roof"}
  ]
}"#;

const JOIN_PLAN: &str = r#"{
  "narration": [
    "Placing the tower on the cliff.",
    "Placing the lantern room atop the tower.",
    "Joining the lantern room onto the tower."
  ],
  "verbs": [
    {"verb": "place", "name": "the tower", "part": "tower", "at": "on the cliff"},
    {"verb": "place", "name": "the lantern room", "part": "lantern room", "at": "atop the tower"},
    {"verb": "join", "object": "the tower", "with": "the lantern room"}
  ]
}"#;

const CUT_PLAN: &str = r#"{
  "narration": [
    "Placing the tower on the cliff.",
    "Placing the arch in the tower.",
    "Cutting an arch through the tower."
  ],
  "verbs": [
    {"verb": "place", "name": "the tower", "part": "tower", "at": "on the cliff"},
    {"verb": "place", "name": "the arch", "part": "doorway", "at": "in the tower"},
    {"verb": "cut", "object": "the tower", "with": "the arch"}
  ]
}"#;

const SCULPT_PLAN: &str = r#"{
  "narration": [
    "The roof is too steep — tapering it along its up.",
    "Weathering the roof a little.",
    "Carving the top a little.",
    "Inflating the base a lot.",
    "Framing the roof so you can judge it."
  ],
  "verbs": [
    {"verb": "taper", "object": "the roof", "amount": "more", "along": "up"},
    {"verb": "weather", "object": "the roof", "amount": "a little"},
    {"verb": "carve", "object": "the roof", "amount": "a little", "region": "top"},
    {"verb": "inflate", "object": "the roof", "amount": "a lot", "region": "base"},
    {"verb": "frame", "target": "the roof"}
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
        ProviderName::OpenAI | ProviderName::OpenRouter | ProviderName::Nous => {
            (200, openai_ok(plan))
        }
        ProviderName::Google => (200, google_ok(plan)),
    }
}

/// Anthropic list: two chat Brains. First cannot see; second can. No prices,
/// so the default is the first that can see.
fn anthropic_catalog() -> String {
    serde_json::json!({
        "data": [
            {
                "id": "claude-words",
                "display_name": "Claude Words",
                "type": "model",
                "capabilities": { "image_input": { "supported": false } }
            },
            {
                "id": "claude-haiku-4-5",
                "display_name": "Claude Haiku 4.5",
                "type": "model",
                "capabilities": { "image_input": { "supported": true } }
            }
        ],
        "has_more": false,
        "first_id": "claude-words",
        "last_id": "claude-haiku-4-5"
    })
    .to_string()
}

/// OpenAI list: two chat Brains plus embeddings, image-gen, and audio. No
/// modalities, so every chat Brain is treated as able to see. Default is first.
fn openai_catalog() -> String {
    serde_json::json!({
        "object": "list",
        "data": [
            { "id": "gpt-test-default", "object": "model", "owned_by": "openai" },
            { "id": "gpt-test-pick", "object": "model", "owned_by": "openai" },
            { "id": "text-embedding-3-small", "object": "model", "owned_by": "openai" },
            { "id": "dall-e-3", "object": "model", "owned_by": "openai" },
            { "id": "whisper-1", "object": "model", "owned_by": "openai" },
            { "id": "gpt-3.5-turbo-instruct", "object": "model", "owned_by": "openai" }
        ]
    })
    .to_string()
}

/// OpenRouter list: chat Brains with lab/sku ids, plus embeddings, image-gen,
/// and audio-in. Modalities decide seeing and kind. Prompt prices pick default.
fn openrouter_catalog() -> String {
    serde_json::json!({
        "data": [
            {
                "id": "meta-llama/llama-3.1-8b-instruct",
                "name": "Llama 3.1 8B",
                "architecture": {
                    "input_modalities": ["text"],
                    "output_modalities": ["text"]
                },
                "pricing": { "prompt": "0.000001", "completion": "0.000002" }
            },
            {
                "id": "openai/cheap-eye",
                "name": "Cheap Eye",
                "architecture": {
                    "input_modalities": ["text", "image"],
                    "output_modalities": ["text"]
                },
                "pricing": { "prompt": "0.000003", "completion": "0.000006" }
            },
            {
                "id": "anthropic/claude-haiku-4.5",
                "name": "Claude Haiku 4.5",
                "architecture": {
                    "input_modalities": ["text", "image"],
                    "output_modalities": ["text"]
                },
                "pricing": { "prompt": "0.00003", "completion": "0.00015" }
            },
            {
                "id": "openai/text-embedding-3-small",
                "name": "Embeddings",
                "architecture": {
                    "input_modalities": ["text"],
                    "output_modalities": ["embeddings"]
                },
                "pricing": { "prompt": "0.00001", "completion": "0" }
            },
            {
                "id": "black-forest-labs/flux",
                "name": "Flux",
                "architecture": {
                    "input_modalities": ["text"],
                    "output_modalities": ["image"]
                },
                "pricing": { "prompt": "0", "completion": "0" }
            },
            {
                "id": "openai/whisper-1",
                "name": "Whisper",
                "architecture": {
                    "input_modalities": ["audio"],
                    "output_modalities": ["text"]
                },
                "pricing": { "prompt": "0", "completion": "0" }
            }
        ]
    })
    .to_string()
}

/// Nous list: same OpenRouter-style catalog, Nous ids.
fn nous_catalog() -> String {
    serde_json::json!({
        "data": [
            {
                "id": "nousresearch/hermes-4-70b",
                "name": "Hermes 4 70B",
                "architecture": {
                    "input_modalities": ["text"],
                    "output_modalities": ["text"]
                },
                "pricing": { "prompt": "0.000001", "completion": "0.000002" }
            },
            {
                "id": "openai/cheap-eye",
                "name": "Cheap Eye",
                "architecture": {
                    "input_modalities": ["text", "image"],
                    "output_modalities": ["text"]
                },
                "pricing": { "prompt": "0.000003", "completion": "0.000006" }
            },
            {
                "id": "nousresearch/hermes-4-405b",
                "name": "Hermes 4 405B",
                "architecture": {
                    "input_modalities": ["text"],
                    "output_modalities": ["text"]
                },
                "pricing": { "prompt": "0.00002", "completion": "0.00004" }
            }
        ]
    })
    .to_string()
}

/// Google list: two generateContent Brains plus embeddings and image-gen.
/// No vision flag, so chat Brains are treated as able to see. Default is first.
fn google_catalog() -> String {
    serde_json::json!({
        "models": [
            {
                "name": "models/gemini-test-default",
                "displayName": "Gemini Test Default",
                "supportedGenerationMethods": ["generateContent", "countTokens"]
            },
            {
                "name": "models/gemini-test-pick",
                "displayName": "Gemini Test Pick",
                "supportedGenerationMethods": ["generateContent"]
            },
            {
                "name": "models/text-embedding-004",
                "displayName": "Text Embedding 004",
                "supportedGenerationMethods": ["embedContent"]
            },
            {
                "name": "models/imagen-3.0-generate-002",
                "displayName": "Imagen 3",
                "supportedGenerationMethods": ["predict"]
            }
        ]
    })
    .to_string()
}

fn with_catalog(provider: ProviderName, chat: FakeTransport) -> FakeTransport {
    let catalog = match provider {
        ProviderName::Anthropic => anthropic_catalog(),
        ProviderName::OpenAI => openai_catalog(),
        ProviderName::Google => google_catalog(),
        ProviderName::OpenRouter => openrouter_catalog(),
        ProviderName::Nous => nous_catalog(),
    };
    FakeTransport::default().replies(200, catalog).then(chat)
}

fn session(
    provider: ProviderName,
    transport: FakeTransport,
) -> Session<LivePlanner<FakeTransport>, ViewReport> {
    let mut session = Session::start(
        LivePlanner::with_transport(with_catalog(provider, transport)),
        ViewReport::new(),
    );
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

/// Kit Part words in the Verb JSON land as Kit Parts, the same on every lab.
#[test]
fn kit_parts_land_the_same_across_providers() {
    for provider in ProviderName::ALL {
        let (status, body) = envelope(provider, KIT_PLAN);
        let mut session = session(provider, FakeTransport::default().replies(status, body));
        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect("the fake Provider returns a Kit plan");

        let objects = session.objects();
        assert_eq!(objects.len(), 2, "{provider:?}");
        assert_eq!(objects[0].name, "the cliff slab");
        assert_eq!(objects[0].part, Part::Kit(KitPart::CliffSlab));
        assert_eq!(objects[1].name, "the lantern room");
        assert_eq!(objects[1].part, Part::Kit(KitPart::LanternRoom));
    }
}

/// Sculpt Verbs in the JSON land the same on every lab: silhouette changes,
/// Object persists.
#[test]
fn sculpt_verbs_land_the_same_across_providers() {
    for provider in ProviderName::ALL {
        let (place_status, place_body) = envelope(provider, PLACE_ROOF);
        let (sculpt_status, sculpt_body) = envelope(provider, SCULPT_PLAN);
        let mut session = session(
            provider,
            FakeTransport::default()
                .replies(place_status, place_body)
                .replies(sculpt_status, sculpt_body),
        );
        session
            .submit_intent("a roof atop the lighthouse")
            .expect("the fake Provider places the roof");
        assert!(
            session.objects()[0].clay.composed_only(),
            "{provider:?} First take is composed, not weathered"
        );
        session
            .submit_intent("the roof is too steep")
            .expect("the fake Provider returns a Sculpt plan");

        let objects = session.objects();
        assert_eq!(objects.len(), 1, "{provider:?}");
        assert_eq!(objects[0].name, "the roof");
        assert!(
            !objects[0].clay.composed_only(),
            "{provider:?} must land Sculpt on the roof"
        );
        let last = session.view().last_frame().expect("framed");
        assert_eq!(last.object.as_deref(), Some("the roof"));
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

/// An Ask from the model is not a plan: the Viewport waits, no Verb lands.
#[test]
fn ask_json_waits_and_lands_no_verb() {
    const ASK: &str = r#"{"ask":"Which roof — the lantern roof or the shed roof?"}"#;
    let (status, body) = envelope(ProviderName::Anthropic, ASK);
    let mut session = session(
        ProviderName::Anthropic,
        FakeTransport::default().replies(status, body),
    );
    let said = session
        .submit_intent("the roof is too steep")
        .expect("an Ask is not a Key error");
    assert_eq!(
        session.ask(),
        Some("Which roof — the lantern roof or the shed roof?")
    );
    assert!(said.iter().any(|l| l.contains("lantern roof")));
    assert!(
        session.objects().is_empty(),
        "no Verb lands while the Viewport waits"
    );
}

/// `join` in the Verb JSON unions two placed Parts the same on every lab.
#[test]
fn join_verbs_land_the_same_across_providers() {
    for provider in ProviderName::ALL {
        let (status, body) = envelope(provider, JOIN_PLAN);
        let mut session = session(provider, FakeTransport::default().replies(status, body));
        session
            .submit_intent("a lighthouse from a tower and a lantern room")
            .expect("the fake Provider returns a join plan");

        let objects = session.objects();
        assert_eq!(objects.len(), 1, "{provider:?}");
        assert_eq!(objects[0].name, "the tower");
        assert!(
            objects[0].clay.joined(),
            "{provider:?} must land join as a union"
        );
        let last = session.view().last_frame().expect("framed");
        assert_eq!(last.object.as_deref(), Some("the tower"));
    }
}

/// `cut` in the Verb JSON subtracts one named Object from another, the same
/// on every lab.
#[test]
fn cut_verbs_land_the_same_across_providers() {
    for provider in ProviderName::ALL {
        let (status, body) = envelope(provider, CUT_PLAN);
        let mut session = session(provider, FakeTransport::default().replies(status, body));
        session
            .submit_intent("a tower with an arch cut through it")
            .expect("the fake Provider returns a cut plan");

        let objects = session.objects();
        assert_eq!(objects.len(), 1, "{provider:?}");
        assert_eq!(objects[0].name, "the tower");
        assert!(
            objects[0].clay.cut_from(),
            "{provider:?} must land cut as a subtract"
        );
        let last = session.view().last_frame().expect("framed");
        assert_eq!(last.object.as_deref(), Some("the tower"));
    }
}

/// `remove` in the Verb JSON is understood the same on every lab; without Point
/// Session still Asks.
#[test]
fn remove_without_point_asks_across_providers() {
    const PLACE: &str = r#"{
      "narration": ["Placing the shed."],
      "verbs": [{"verb": "place", "name": "the shed", "part": "box", "at": "beside the lighthouse"}]
    }"#;
    const REMOVE: &str = r#"{
      "narration": ["Removing the shed."],
      "verbs": [{"verb": "remove", "object": "the shed"}]
    }"#;
    for provider in ProviderName::ALL {
        let (place_status, place_body) = envelope(provider, PLACE);
        let (remove_status, remove_body) = envelope(provider, REMOVE);
        let mut session = session(
            provider,
            FakeTransport::default()
                .replies(place_status, place_body)
                .replies(remove_status, remove_body),
        );
        session.submit_intent("add a shed").expect("the shed lands");
        assert_eq!(session.objects().len(), 1, "{provider:?}");
        session
            .submit_intent("get rid of the shed")
            .expect("Ask is not an error");
        assert!(
            session.ask().is_some(),
            "{provider:?} must Ask before remove without Point"
        );
        assert_eq!(
            session.objects().len(),
            1,
            "{provider:?} must not delete while Asking"
        );
    }
}

/// Paginated Anthropic lists are combined into one Person-facing list.
#[test]
fn anthropic_follows_catalog_pages() {
    let page1 = serde_json::json!({
        "data": [{ "id": "first", "display_name": "First", "type": "model" }],
        "has_more": true,
        "first_id": "first",
        "last_id": "first"
    })
    .to_string();
    let page2 = serde_json::json!({
        "data": [{ "id": "second", "display_name": "Second", "type": "model" }],
        "has_more": false,
        "first_id": "second",
        "last_id": "second"
    })
    .to_string();
    let mut session = Session::start(
        LivePlanner::with_transport(
            FakeTransport::default()
                .replies(200, page1)
                .replies(200, page2),
        ),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-test");
    let brains = session.brains().expect("both pages");
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(ids, ["first", "second"]);
    let sent = session.provider().transport_sent();
    assert!(
        sent[0]
            .url
            .starts_with("https://api.anthropic.com/v1/models"),
        "{}",
        sent[0].url
    );
    assert!(
        sent[1].url.contains("after_id=first"),
        "the second page follows last_id: {}",
        sent[1].url
    );
}

/// After an Anthropic Key, the Person sees Brains from the live list.
#[test]
fn anthropic_lists_brains_from_the_live_catalog() {
    let mut session = session(ProviderName::Anthropic, FakeTransport::default());
    let brains = session.brains().expect("the fake catalog is offered");
    let names: Vec<&str> = brains.iter().map(|b| b.name.as_str()).collect();
    assert_eq!(names, ["Claude Words", "Claude Haiku 4.5"]);
    assert!(!brains[0].can_see, "image_input false is text-only");
    assert!(brains[1].can_see, "image_input true can see pictures");
}

/// Default with no prices is the first Brain that can see pictures.
#[test]
fn anthropic_default_is_the_first_that_can_see() {
    let mut session = session(
        ProviderName::Anthropic,
        FakeTransport::default().replies(200, anthropic_ok(PLAN)),
    );
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the fake lab returns a plan");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("claude-haiku-4-5")
    );
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/v1/messages"))
        .expect("a chat POST follows the catalog GET");
    assert!(
        chat.body.contains("claude-haiku-4-5"),
        "the Agent thinks with the default Brain's id: {}",
        chat.body
    );
}

/// The Person's pick is the id in the chat POST.
#[test]
fn anthropic_thinks_with_the_brain_the_person_picked() {
    let mut session = session(
        ProviderName::Anthropic,
        FakeTransport::default().replies(200, anthropic_ok(PLAN)),
    );
    session
        .set_brain("claude-words")
        .expect("text-only Brains stay on the list");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("words-only Intent works with a text-only Brain");
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/v1/messages"))
        .expect("chat POST");
    assert!(
        chat.body.contains("claude-words"),
        "the Agent thinks with the picked Brain's id"
    );
    assert!(
        chat.body.contains("The Person never names a Verb"),
        "the system prompt does not change when the Brain does"
    );
}

/// After an OpenAI Key, the Person sees chat Brains from the live list.
/// Embeddings, image-gen, and audio are not offered.
#[test]
fn openai_lists_brains_from_the_live_catalog() {
    let mut session = session(ProviderName::OpenAI, FakeTransport::default());
    let brains = session.brains().expect("the fake catalog is offered");
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(ids, ["gpt-test-default", "gpt-test-pick"]);
    assert!(
        brains.iter().all(|b| b.can_see),
        "OpenAI's list does not say whether a Brain can see; treat it as able to"
    );
    let sent = session.provider().transport_sent();
    assert!(
        sent[0].url.starts_with("https://api.openai.com/v1/models"),
        "{}",
        sent[0].url
    );
}

/// After a Google Key, the Person sees generateContent Brains from the live
/// list. Embeddings and image-gen are not offered. Ids drop the models/ prefix.
#[test]
fn google_lists_brains_from_the_live_catalog() {
    let mut session = session(ProviderName::Google, FakeTransport::default());
    let brains = session.brains().expect("the fake catalog is offered");
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(ids, ["gemini-test-default", "gemini-test-pick"]);
    let names: Vec<&str> = brains.iter().map(|b| b.name.as_str()).collect();
    assert_eq!(names, ["Gemini Test Default", "Gemini Test Pick"]);
    assert!(
        brains.iter().all(|b| b.can_see),
        "Google's list does not say whether a Brain can see; treat it as able to"
    );
    let sent = session.provider().transport_sent();
    assert!(
        sent[0]
            .url
            .starts_with("https://generativelanguage.googleapis.com/v1beta/models"),
        "{}",
        sent[0].url
    );
    assert!(
        !sent[0].url.contains(":generateContent"),
        "listing is GET /models, not a chat POST: {}",
        sent[0].url
    );
}

/// Default with no prices is the first chat Brain (OpenAI has no vision flag).
#[test]
fn openai_thinks_with_the_default_brain_id() {
    let mut session = session(
        ProviderName::OpenAI,
        FakeTransport::default().replies(200, openai_ok(PLAN)),
    );
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the fake lab returns a plan");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("gpt-test-default")
    );
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/v1/chat/completions"))
        .expect("a chat POST follows the catalog GET");
    assert!(
        chat.body.contains("gpt-test-default"),
        "the Agent thinks with the default Brain's id: {}",
        chat.body
    );
    assert!(
        !chat.body.contains("gpt-4.1-nano"),
        "no pinned SKU remains: {}",
        chat.body
    );
    assert!(
        chat.body.contains("The Person never names a Verb"),
        "the system prompt does not change across labs"
    );
}

/// Default with no prices is the first generateContent Brain.
#[test]
fn google_thinks_with_the_default_brain_id() {
    let mut session = session(
        ProviderName::Google,
        FakeTransport::default().replies(200, google_ok(PLAN)),
    );
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the fake lab returns a plan");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("gemini-test-default")
    );
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains(":generateContent"))
        .expect("a chat POST follows the catalog GET");
    assert!(
        chat.url.contains("gemini-test-default"),
        "the Agent thinks with the default Brain's id: {}",
        chat.url
    );
    assert!(
        !chat.url.contains("gemini-2.5-flash"),
        "no pinned SKU remains: {}",
        chat.url
    );
    assert!(
        chat.body.contains("The Person never names a Verb"),
        "the system prompt does not change across labs"
    );
}

/// The Person's OpenAI pick is the id in the chat POST.
#[test]
fn openai_thinks_with_the_brain_the_person_picked() {
    let mut session = session(
        ProviderName::OpenAI,
        FakeTransport::default().replies(200, openai_ok(PLAN)),
    );
    session
        .set_brain("gpt-test-pick")
        .expect("the pick is on the list");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("words-only Intent works");
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/v1/chat/completions"))
        .expect("chat POST");
    assert!(
        chat.body.contains("gpt-test-pick"),
        "the Agent thinks with the picked Brain's id"
    );
}

/// The Person's Google pick is the id in the generateContent URL.
#[test]
fn google_thinks_with_the_brain_the_person_picked() {
    let mut session = session(
        ProviderName::Google,
        FakeTransport::default().replies(200, google_ok(PLAN)),
    );
    session
        .set_brain("gemini-test-pick")
        .expect("the pick is on the list");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("words-only Intent works");
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains(":generateContent"))
        .expect("chat POST");
    assert!(
        chat.url.contains("gemini-test-pick"),
        "the Agent thinks with the picked Brain's id: {}",
        chat.url
    );
}

/// Paginated Google lists are combined into one Person-facing list.
#[test]
fn google_follows_catalog_pages() {
    let page1 = serde_json::json!({
        "models": [{
            "name": "models/first",
            "displayName": "First",
            "supportedGenerationMethods": ["generateContent"]
        }],
        "nextPageToken": "page-2"
    })
    .to_string();
    let page2 = serde_json::json!({
        "models": [{
            "name": "models/second",
            "displayName": "Second",
            "supportedGenerationMethods": ["generateContent"]
        }]
    })
    .to_string();
    let mut session = Session::start(
        LivePlanner::with_transport(
            FakeTransport::default()
                .replies(200, page1)
                .replies(200, page2),
        ),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Google);
    session.set_key("sk-test");
    let brains = session.brains().expect("both pages");
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(ids, ["first", "second"]);
    let sent = session.provider().transport_sent();
    assert!(
        sent[0]
            .url
            .starts_with("https://generativelanguage.googleapis.com/v1beta/models"),
        "{}",
        sent[0].url
    );
    assert!(
        sent[1].url.contains("pageToken=page-2"),
        "the second page follows nextPageToken: {}",
        sent[1].url
    );
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
    assert_eq!(
        session.talk().len(),
        3,
        "Intent plus the two Narration lines of the plan stay with the Scene"
    );
}

/// An invalid Key on the OpenAI catalog GET is an error they can act on.
#[test]
fn openai_catalog_rejects_an_invalid_key() {
    let body = serde_json::json!({
        "error": { "message": "Incorrect API key provided", "type": "invalid_request_error" }
    })
    .to_string();
    let mut session = Session::start(
        LivePlanner::with_transport(FakeTransport::default().replies(401, body)),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::OpenAI);
    session.set_key("sk-bogus");
    let err = session
        .brains()
        .expect_err("401 on the catalog GET is an invalid Key");
    assert_eq!(err, SessionError::Key(KeyError::Invalid));
}

/// An invalid Key on the Google catalog GET is an error they can act on.
#[test]
fn google_catalog_rejects_an_invalid_key() {
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
    let mut session = Session::start(
        LivePlanner::with_transport(FakeTransport::default().replies(400, body)),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Google);
    session.set_key("sk-bogus");
    let err = session
        .brains()
        .expect_err("400 API_KEY_INVALID on the catalog GET is an invalid Key");
    assert_eq!(err, SessionError::Key(KeyError::Invalid));
}

/// After an OpenRouter Key, the Person sees chat Brains from the live list.
/// Embeddings, image-gen, and audio-in are not offered. Ids are lab/sku.
#[test]
fn openrouter_lists_brains_from_the_live_catalog() {
    let mut session = session(ProviderName::OpenRouter, FakeTransport::default());
    let brains = session.brains().expect("the fake catalog is offered");
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(
        ids,
        [
            "meta-llama/llama-3.1-8b-instruct",
            "openai/cheap-eye",
            "anthropic/claude-haiku-4.5",
        ]
    );
    let names: Vec<&str> = brains.iter().map(|b| b.name.as_str()).collect();
    assert_eq!(
        names,
        ["Llama 3.1 8B", "Cheap Eye", "Claude Haiku 4.5"],
        "settings show Person-facing names"
    );
    assert!(!brains[0].can_see, "text-only input cannot see pictures");
    assert!(brains[1].can_see, "image in input_modalities can see");
    let sent = session.provider().transport_sent();
    assert_eq!(sent[0].url, "https://openrouter.ai/api/v1/models");
    assert!(
        sent[0]
            .headers
            .iter()
            .any(|(k, v)| k == "authorization" && v == "Bearer sk-test"),
        "listing uses the OpenRouter Key"
    );
    assert!(
        sent[0]
            .headers
            .iter()
            .any(|(k, v)| k == "HTTP-Referer" && v.contains("tessera")),
        "catalog GET identifies Tessera as the app"
    );
}

/// After a Nous Key, the Person sees chat Brains from the live list. Ids are
/// Nous's, not a first-party SKU.
#[test]
fn nous_lists_brains_from_the_live_catalog() {
    let mut session = session(ProviderName::Nous, FakeTransport::default());
    let brains = session.brains().expect("the fake catalog is offered");
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(
        ids,
        [
            "nousresearch/hermes-4-70b",
            "openai/cheap-eye",
            "nousresearch/hermes-4-405b",
        ]
    );
    let sent = session.provider().transport_sent();
    assert_eq!(
        sent[0].url,
        "https://inference-api.nousresearch.com/v1/models"
    );
    assert!(
        !sent[0].url.contains("portal.nousresearch.com"),
        "Nous is the Provider; Portal is the website"
    );
}

/// Default is the cheapest that can see; the chat POST names that OpenRouter id.
#[test]
fn openrouter_thinks_with_the_default_brain_id() {
    let mut session = session(
        ProviderName::OpenRouter,
        FakeTransport::default().replies(200, openai_ok(PLAN)),
    );
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the fake gateway returns a plan");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("openai/cheap-eye")
    );
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/chat/completions"))
        .expect("a chat POST follows the catalog GET");
    assert_eq!(chat.url, "https://openrouter.ai/api/v1/chat/completions");
    assert!(
        chat.body.contains("openai/cheap-eye"),
        "the Agent thinks with the OpenRouter Brain id: {}",
        chat.body
    );
    assert!(
        !chat.url.contains("api.openai.com") && !chat.url.contains("api.anthropic.com"),
        "a gateway Key is never sent to the lab that trained the weights: {}",
        chat.url
    );
    assert!(
        chat.body.contains("The Person never names a Verb"),
        "the system prompt does not change"
    );
    assert!(
        !chat.body.contains("<think>"),
        "no Hermes think pack on OpenRouter"
    );
    assert!(
        chat.headers
            .iter()
            .any(|(k, v)| k == "HTTP-Referer" && v == "https://github.com/Elshayib/tessera")
    );
    assert!(
        chat.headers
            .iter()
            .any(|(k, v)| k == "X-OpenRouter-Title" && v == "Tessera")
    );
}

/// Default is the cheapest that can see; the chat POST names that Nous id.
#[test]
fn nous_thinks_with_the_default_brain_id() {
    let mut session = session(
        ProviderName::Nous,
        FakeTransport::default().replies(200, openai_ok(PLAN)),
    );
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the fake gateway returns a plan");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("openai/cheap-eye")
    );
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/chat/completions"))
        .expect("a chat POST follows the catalog GET");
    assert_eq!(
        chat.url,
        "https://inference-api.nousresearch.com/v1/chat/completions"
    );
    assert!(
        chat.body.contains("openai/cheap-eye"),
        "the Agent thinks with the Nous Brain id: {}",
        chat.body
    );
    assert!(
        chat.body.contains("The Person never names a Verb"),
        "the system prompt does not change"
    );
    assert!(
        !chat.body.contains("<think>"),
        "no Hermes think pack, including on Nous"
    );
}

/// The Person's OpenRouter pick is the lab/sku id in the chat POST.
#[test]
fn openrouter_thinks_with_the_brain_the_person_picked() {
    let mut session = session(
        ProviderName::OpenRouter,
        FakeTransport::default().replies(200, openai_ok(PLAN)),
    );
    session
        .set_brain("anthropic/claude-haiku-4.5")
        .expect("the pick is on the list");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("words-only Intent works");
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/chat/completions"))
        .expect("chat POST");
    assert!(
        chat.body.contains("anthropic/claude-haiku-4.5"),
        "the Agent thinks with the picked OpenRouter id"
    );
    assert_eq!(chat.url, "https://openrouter.ai/api/v1/chat/completions");
}

/// The Person's Nous pick is the Nous id in the chat POST.
#[test]
fn nous_thinks_with_the_brain_the_person_picked() {
    let mut session = session(
        ProviderName::Nous,
        FakeTransport::default().replies(200, openai_ok(PLAN)),
    );
    session
        .set_brain("nousresearch/hermes-4-70b")
        .expect("the pick is on the list");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("words-only Intent works with a text-only Brain");
    let sent = session.provider().transport_sent();
    let chat = sent
        .iter()
        .find(|r| r.url.contains("/chat/completions"))
        .expect("chat POST");
    assert!(
        chat.body.contains("nousresearch/hermes-4-70b"),
        "the Agent thinks with the picked Nous id"
    );
    assert!(
        !chat.body.contains("<think>"),
        "picking Hermes does not add a think pack"
    );
}

/// An invalid Key on the OpenRouter catalog GET is an error they can act on.
#[test]
fn openrouter_catalog_rejects_an_invalid_key() {
    let body = serde_json::json!({
        "error": { "message": "User not found.", "code": 401 }
    })
    .to_string();
    let mut session = Session::start(
        LivePlanner::with_transport(FakeTransport::default().replies(401, body)),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::OpenRouter);
    session.set_key("sk-bogus");
    let err = session
        .brains()
        .expect_err("401 on the catalog GET is an invalid Key");
    assert_eq!(err, SessionError::Key(KeyError::Invalid));
}

/// An invalid Key on the Nous catalog GET is an error they can act on.
#[test]
fn nous_catalog_rejects_an_invalid_key() {
    let body = serde_json::json!({
        "error": { "message": "Incorrect API key provided", "type": "invalid_request_error" }
    })
    .to_string();
    let mut session = Session::start(
        LivePlanner::with_transport(FakeTransport::default().replies(401, body)),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Nous);
    session.set_key("sk-bogus");
    let err = session
        .brains()
        .expect_err("401 on the catalog GET is an invalid Key");
    assert_eq!(err, SessionError::Key(KeyError::Invalid));
}

/// Out of credit on an OpenAI-compatible gateway is actionable.
#[test]
fn openrouter_out_of_credit_is_actionable() {
    let body = serde_json::json!({
        "error": { "message": "Insufficient credits", "code": 402 }
    })
    .to_string();
    let mut session = session(
        ProviderName::OpenRouter,
        FakeTransport::default().replies(402, body),
    );
    let err = session
        .submit_intent("a lighthouse")
        .expect_err("402 is out of credit");
    assert_eq!(err, SessionError::Key(KeyError::OutOfCredit));
}
