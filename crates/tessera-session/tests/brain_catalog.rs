//! Brain from a live catalog (issues #16, #17): the Person pastes a Key and
//! picks a Brain from what that Provider currently offers. Tessera does not
//! pin a SKU. Anthropic, OpenAI, and Google share the same default and pick
//! rules. Settings hold one Key and one Brain at a time.
//!
//! Tests act as the Person: headless, scripted list of Brains, no live lab,
//! no real window.

use tessera_session::{
    Brain, BrainError, BrainKind, FileKeyStore, Intent, KeyError, Picture, Primitive,
    ProviderError, ProviderName, ScriptedProvider, Session, SessionError, ViewReport,
};

fn seeing(id: &str, name: &str) -> Brain {
    Brain {
        id: id.into(),
        name: name.into(),
        can_see: true,
        price: None,
        kind: BrainKind::Chat,
    }
}

fn seeing_priced(id: &str, name: &str, price: u64) -> Brain {
    Brain {
        id: id.into(),
        name: name.into(),
        can_see: true,
        price: Some(price),
        kind: BrainKind::Chat,
    }
}

fn text_only(id: &str, name: &str) -> Brain {
    Brain {
        id: id.into(),
        name: name.into(),
        can_see: false,
        price: None,
        kind: BrainKind::Chat,
    }
}

fn anthropic_with(brains: Vec<Brain>) -> Session<ScriptedProvider, ViewReport> {
    let mut session = Session::start(
        ScriptedProvider::default().offering(brains),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    session
}

/// After Provider is Anthropic and a Key is pasted, the Person sees a list of
/// Brains from what the Provider currently offers: chat, text in and out.
#[test]
fn person_sees_anthropic_brains_after_pasting_a_key() {
    let mut session = anthropic_with(vec![
        seeing("claude-sonnet-4-5", "Claude Sonnet 4.5"),
        seeing("claude-haiku-4-5", "Claude Haiku 4.5"),
        seeing("claude-opus-4-1", "Claude Opus 4.1"),
    ]);

    let brains = session.brains().expect("the scripted list is offered");
    let names: Vec<&str> = brains.iter().map(|b| b.name.as_str()).collect();
    assert_eq!(
        names,
        ["Claude Sonnet 4.5", "Claude Haiku 4.5", "Claude Opus 4.1",],
        "settings show Person-facing names from the live list, not a pinned SKU"
    );
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(
        ids,
        ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1",]
    );
}

/// Image-generation, embeddings, and audio are not offered for thinking.
#[test]
fn non_chat_offerings_are_hidden() {
    let mut session = anthropic_with(vec![
        seeing("claude-haiku-4-5", "Claude Haiku 4.5"),
        Brain {
            id: "claude-embed".into(),
            name: "Claude Embed".into(),
            can_see: false,
            price: None,
            kind: BrainKind::Embeddings,
        },
        Brain {
            id: "claude-paint".into(),
            name: "Claude Paint".into(),
            can_see: true,
            price: None,
            kind: BrainKind::ImageGen,
        },
        Brain {
            id: "claude-voice".into(),
            name: "Claude Voice".into(),
            can_see: false,
            price: None,
            kind: BrainKind::Audio,
        },
    ]);

    let brains = session.brains().expect("chat offerings remain");
    assert_eq!(brains.len(), 1);
    assert_eq!(brains[0].id, "claude-haiku-4-5");
}

/// The list is searchable in settings: a query matches name or id.
#[test]
fn brain_list_is_searchable() {
    let mut session = anthropic_with(vec![
        seeing("claude-sonnet-4-5", "Claude Sonnet 4.5"),
        seeing("claude-haiku-4-5", "Claude Haiku 4.5"),
        seeing("claude-opus-4-1", "Claude Opus 4.1"),
    ]);

    let found = session
        .brains_matching("HAIKU")
        .expect("search uses the live list");
    assert_eq!(found.len(), 1, "one Brain matches haiku");
    assert_eq!(found[0].id, "claude-haiku-4-5");

    let by_id = session
        .brains_matching("opus-4")
        .expect("id is searchable too");
    assert_eq!(by_id.len(), 1);
    assert_eq!(by_id[0].name, "Claude Opus 4.1");

    let all = session
        .brains_matching("")
        .expect("empty search is the full list");
    assert_eq!(all.len(), 3);
}

/// Default: cheapest that can see pictures.
#[test]
fn default_is_the_cheapest_that_can_see() {
    let mut session = anthropic_with(vec![
        seeing_priced("dear-eye", "Dear Eye", 30),
        seeing_priced("cheap-eye", "Cheap Eye", 3),
        Brain {
            id: "cheap-words".into(),
            name: "Cheap Words".into(),
            can_see: false,
            price: Some(1),
            kind: BrainKind::Chat,
        },
    ]);
    session.brains().expect("the list is offered");

    let chosen = session
        .chosen_brain()
        .expect("Tessera picks a default so they can type without shopping");
    assert_eq!(chosen.id, "cheap-eye");
}

/// Default: if the catalog has no price, the first that can see pictures.
#[test]
fn default_without_price_is_the_first_that_can_see() {
    let mut session = anthropic_with(vec![
        text_only("words", "Words Only"),
        seeing("first-eye", "First Eye"),
        seeing("later-eye", "Later Eye"),
    ]);
    session.brains().expect("the list is offered");

    let chosen = session.chosen_brain().expect("a default is picked");
    assert_eq!(chosen.id, "first-eye");
}

/// Default: if none can see, the cheapest (or first) chat Brain.
#[test]
fn default_when_none_can_see_is_the_cheapest_chat_brain() {
    let mut session = anthropic_with(vec![
        Brain {
            id: "dear-words".into(),
            name: "Dear Words".into(),
            can_see: false,
            price: Some(20),
            kind: BrainKind::Chat,
        },
        Brain {
            id: "cheap-words".into(),
            name: "Cheap Words".into(),
            can_see: false,
            price: Some(2),
            kind: BrainKind::Chat,
        },
    ]);
    session.brains().expect("the list is offered");

    let chosen = session.chosen_brain().expect("a default is picked");
    assert_eq!(chosen.id, "cheap-words");
}

/// The Person can pick a Brain; the Agent thinks with that Brain's id.
#[test]
fn person_picks_a_brain_and_the_agent_thinks_with_it() {
    let provider = ScriptedProvider::default()
        .offering(vec![
            seeing("claude-sonnet-4-5", "Claude Sonnet 4.5"),
            seeing("claude-haiku-4-5", "Claude Haiku 4.5"),
        ])
        .plan(ScriptedProvider::place_and_frame(
            "the lighthouse",
            Primitive::Cylinder,
            "on the cliff",
        ));
    let mut session = Session::start(provider, ViewReport::new());
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    session.brains().expect("the list is offered");
    session
        .set_brain("claude-haiku-4-5")
        .expect("Haiku is on the list");

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted plan lands");

    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("claude-haiku-4-5")
    );
    let creds = session.provider().received_credentials();
    assert_eq!(
        creds.last().and_then(|c| c.brain.as_deref()),
        Some("claude-haiku-4-5"),
        "the Agent thinks with the Brain the Person picked"
    );
}

/// Words-only Intent works with a text-only Brain.
#[test]
fn words_only_intent_works_with_a_text_only_brain() {
    let provider = ScriptedProvider::default()
        .offering(vec![text_only("words", "Words Only")])
        .plan(ScriptedProvider::place_and_frame(
            "the lighthouse",
            Primitive::Cylinder,
            "on the cliff",
        ));
    let mut session = Session::start(provider, ViewReport::new());
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    session
        .set_brain("words")
        .expect("text-only Brains stay on the list");

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("words-only Intent does not need a Brain that can see");
    assert_eq!(session.objects().len(), 1);
}

/// Pictures plus a Brain that cannot see them: an error they can act on.
#[test]
fn pictures_to_a_text_only_brain_are_an_actionable_error() {
    let mut session = anthropic_with(vec![text_only("words", "Words Only")]);
    session
        .set_brain("words")
        .expect("text-only stays on the list");

    let err = session
        .submit_intent(
            Intent::words("a lighthouse like this sketch")
                .with_pictures([Picture::sketch(b"sketch-bytes".to_vec())]),
        )
        .expect_err("a Brain that cannot see must not swallow the picture");

    assert_eq!(err, SessionError::Brain(BrainError::CannotSee));
    let action = err.to_string();
    assert!(
        action.contains("pictures") || action.contains("see"),
        "the error must say the Brain cannot see pictures: {action:?}"
    );
    assert!(
        session.objects().is_empty(),
        "the Viewport is not a silent freeze: no Scene appeared"
    );
}

/// A failed catalog fetch uses the last cached list so yesterday's offerings
/// still work offline.
#[test]
fn failed_catalog_fetch_uses_the_cached_list() {
    let path = std::env::temp_dir().join(format!(
        "tessera-catalog-cache-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    {
        let mut session = Session::start(
            ScriptedProvider::default().offering(vec![
                seeing("cheap-eye", "Cheap Eye"),
                seeing("dear-eye", "Dear Eye"),
            ]),
            ViewReport::new(),
        )
        .with_key_store(FileKeyStore::new(&path));
        session.set_provider(ProviderName::Anthropic);
        session.set_key("sk-ant");
        let brains = session.brains().expect("the live list is offered");
        let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
        assert_eq!(ids, ["cheap-eye", "dear-eye"]);
    }

    let mut session = Session::start(
        ScriptedProvider::default().catalog_fail(ProviderError::Unavailable("down".into())),
        ViewReport::new(),
    )
    .with_key_store(FileKeyStore::new(&path));
    let brains = session
        .brains()
        .expect("a down catalog still shows yesterday's offerings");
    let ids: Vec<&str> = brains.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(ids, ["cheap-eye", "dear-eye"]);
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("cheap-eye"),
        "the remembered default still thinks from the cache"
    );
    let _ = std::fs::remove_file(&path);
}

/// A failed catalog fetch with no cache is an error they can act on; retrying
/// from settings fetches again.
#[test]
fn failed_catalog_fetch_can_be_retried() {
    let mut session = Session::start(
        ScriptedProvider::default()
            .offering(vec![seeing("cheap-eye", "Cheap Eye")])
            .catalog_fail(ProviderError::Unavailable("down".into())),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    let err = session
        .brains()
        .expect_err("a down catalog with no cache is an error");
    match err {
        SessionError::Key(KeyError::Unavailable(reason)) => {
            assert!(reason.contains("down"), "{reason}");
        }
        other => panic!("expected Unavailable, got {other:?}"),
    }
    assert!(
        session.objects().is_empty(),
        "the Viewport is not a silent freeze"
    );

    session.provider_mut().recover_catalog();
    let brains = session
        .brains()
        .expect("retrying from settings fetches again");
    assert_eq!(brains.len(), 1);
    assert_eq!(brains[0].id, "cheap-eye");
}

/// A failed catalog fetch is an error they can act on, not a freeze.
#[test]
fn failed_catalog_fetch_is_an_actionable_error() {
    let mut session = Session::start(
        ScriptedProvider::default().catalog_fail(ProviderError::Unavailable("down".into())),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    let err = session
        .brains()
        .expect_err("a down catalog must not look like an empty list");
    match err {
        SessionError::Key(KeyError::Unavailable(reason)) => {
            assert!(reason.contains("down"), "{reason}");
        }
        other => panic!("expected Unavailable, got {other:?}"),
    }
}

/// Nothing offered is an actionable error, not a freeze.
#[test]
fn empty_catalog_is_an_actionable_error() {
    let mut session = anthropic_with(vec![]);
    let err = session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect_err("nothing offered means the Agent cannot think");

    assert_eq!(err, SessionError::Brain(BrainError::Missing));
    let action = err.to_string();
    assert!(
        action.contains("Brain"),
        "the error must name the Brain: {action:?}"
    );
    assert!(session.objects().is_empty());
}

/// A remembered Brain that the Provider no longer offers is an error; Tessera
/// does not silently swap to a new default.
#[test]
fn vanished_brain_is_an_actionable_error() {
    let path = std::env::temp_dir().join(format!(
        "tessera-vanished-brain-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    {
        let mut session = Session::start(
            ScriptedProvider::default().offering(vec![seeing("gone", "Gone")]),
            ViewReport::new(),
        )
        .with_key_store(FileKeyStore::new(&path));
        session.set_provider(ProviderName::Anthropic);
        session.set_key("sk-ant");
        session.set_brain("gone").expect("it is offered now");
    }

    let mut session = Session::start(
        ScriptedProvider::default().offering(vec![seeing("other", "Other")]),
        ViewReport::new(),
    )
    .with_key_store(FileKeyStore::new(&path));
    let err = session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect_err("a vanished Brain must not silently become Other");
    assert_eq!(err, SessionError::Brain(BrainError::Unknown));
    assert!(err.to_string().contains("Brain"));
    assert!(session.objects().is_empty());
    let _ = std::fs::remove_file(&path);
}

/// Changing Brain leaves the open Scene and Talk intact.
#[test]
fn changing_brain_leaves_the_open_scene_intact() {
    let provider = ScriptedProvider::default()
        .offering(vec![
            seeing("claude-sonnet-4-5", "Claude Sonnet 4.5"),
            seeing("claude-haiku-4-5", "Claude Haiku 4.5"),
        ])
        .plan(ScriptedProvider::place_and_frame(
            "the lighthouse",
            Primitive::Cylinder,
            "on the cliff",
        ));
    let mut session = Session::start(provider, ViewReport::new());
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    session
        .set_brain("claude-sonnet-4-5")
        .expect("Sonnet is offered");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted plan lands");
    let talk_len = session.talk().len();

    session
        .set_brain("claude-haiku-4-5")
        .expect("Haiku is offered");

    assert_eq!(session.objects().len(), 1, "the lighthouse is still there");
    assert_eq!(session.objects()[0].name, "the lighthouse");
    assert_eq!(
        session.talk().len(),
        talk_len,
        "the Talk is still there; settings are not the Scene"
    );
}

/// Key and Brain are not written into the Scene or the Talk.
#[test]
fn key_and_brain_are_not_in_the_scene_or_talk() {
    let path = std::env::temp_dir().join(format!(
        "tessera-brain-settings-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    let secret = "sk-secret-do-not-leak";
    let brain_id = "claude-haiku-4-5";

    {
        let provider = ScriptedProvider::default()
            .offering(vec![seeing(brain_id, "Claude Haiku 4.5")])
            .plan(ScriptedProvider::place_and_frame(
                "the lighthouse",
                Primitive::Cylinder,
                "on the cliff",
            ));
        let mut session =
            Session::start(provider, ViewReport::new()).with_key_store(FileKeyStore::new(&path));
        session.set_provider(ProviderName::Anthropic);
        session.set_key(secret);
        session.set_brain(brain_id).expect("Haiku is offered");
        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect("the scripted plan lands");

        let on_disk = std::fs::read_to_string(&path).expect("settings were written");
        assert!(
            on_disk.contains(secret),
            "the Key lives in settings on the machine"
        );
        assert!(
            on_disk.contains(brain_id),
            "the Brain lives in settings next to the Key: {on_disk}"
        );

        for line in session.talk() {
            assert!(
                !line.text.contains(secret),
                "the Talk must not carry the Key"
            );
            assert!(
                !line.text.contains(brain_id),
                "the Talk must not name the Brain"
            );
        }
        for object in session.objects() {
            assert!(!object.name.contains(secret));
            assert!(!object.name.contains(brain_id));
        }

        let scene_path = std::env::temp_dir().join(format!(
            "tessera-brain-scene-{}-{}.json",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        session.save(&scene_path).expect("the Scene is kept");
        let scene_on_disk = std::fs::read_to_string(&scene_path).expect("Scene was written");
        assert!(
            !scene_on_disk.contains(secret),
            "the Scene file must not carry the Key"
        );
        assert!(
            !scene_on_disk.contains(brain_id),
            "the Scene file must not carry the Brain"
        );
        let _ = std::fs::remove_file(&scene_path);
    }

    let mut session = Session::start(
        ScriptedProvider::default().offering(vec![seeing(brain_id, "Claude Haiku 4.5")]),
        ViewReport::new(),
    )
    .with_key_store(FileKeyStore::new(&path));
    assert!(session.has_key(), "a new Session loads the Key from disk");
    assert_eq!(session.chosen_provider(), Some(ProviderName::Anthropic));
    session.brains().expect("the list is offered");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some(brain_id),
        "a restart finds the Brain next to the Key"
    );
    assert!(
        session.objects().is_empty(),
        "settings are not a Scene: a new Session starts empty"
    );

    let _ = std::fs::remove_file(&path);
}

fn with_provider(
    provider: ProviderName,
    brains: Vec<Brain>,
) -> Session<ScriptedProvider, ViewReport> {
    let mut session = Session::start(
        ScriptedProvider::default().offering(brains),
        ViewReport::new(),
    );
    session.set_provider(provider);
    session.set_key("sk-test");
    session
}

const OPENAI_AND_GOOGLE: [ProviderName; 2] = [ProviderName::OpenAI, ProviderName::Google];

/// After picking OpenAI or Google and pasting that Provider's Key, the Person
/// sees a live list of Brains, with the same default and pick rules as Anthropic.
#[test]
fn openai_and_google_list_brains_after_a_key() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(
            provider,
            vec![
                seeing("cheap-eye", "Cheap Eye"),
                seeing("dear-eye", "Dear Eye"),
            ],
        );
        let brains = session
            .brains()
            .unwrap_or_else(|_| panic!("{provider:?} must offer the scripted list"));
        let names: Vec<&str> = brains.iter().map(|b| b.name.as_str()).collect();
        assert_eq!(
            names,
            ["Cheap Eye", "Dear Eye"],
            "{provider:?} settings show Person-facing names, not a pinned SKU"
        );
    }
}

/// Image-generation, embeddings, and audio stay hidden on OpenAI and Google.
#[test]
fn openai_and_google_hide_non_chat_offerings() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(
            provider,
            vec![
                seeing("chat", "Chat"),
                Brain {
                    id: "embed".into(),
                    name: "Embed".into(),
                    can_see: false,
                    price: None,
                    kind: BrainKind::Embeddings,
                },
                Brain {
                    id: "paint".into(),
                    name: "Paint".into(),
                    can_see: true,
                    price: None,
                    kind: BrainKind::ImageGen,
                },
                Brain {
                    id: "voice".into(),
                    name: "Voice".into(),
                    can_see: false,
                    price: None,
                    kind: BrainKind::Audio,
                },
            ],
        );
        let brains = session
            .brains()
            .unwrap_or_else(|_| panic!("{provider:?} chat offerings remain"));
        assert_eq!(brains.len(), 1, "{provider:?}");
        assert_eq!(brains[0].id, "chat");
    }
}

/// The list is searchable for OpenAI and Google the same way.
#[test]
fn openai_and_google_brain_list_is_searchable() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(
            provider,
            vec![
                seeing("gpt-4.1-nano", "GPT 4.1 Nano"),
                seeing("gpt-4.1", "GPT 4.1"),
            ],
        );
        let found = session
            .brains_matching("NANO")
            .unwrap_or_else(|_| panic!("{provider:?} search uses the live list"));
        assert_eq!(found.len(), 1, "{provider:?}");
        assert_eq!(found[0].id, "gpt-4.1-nano");
    }
}

/// Default on OpenAI and Google: cheapest that can see pictures.
#[test]
fn openai_and_google_default_is_the_cheapest_that_can_see() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(
            provider,
            vec![
                seeing_priced("dear-eye", "Dear Eye", 30),
                seeing_priced("cheap-eye", "Cheap Eye", 3),
                Brain {
                    id: "cheap-words".into(),
                    name: "Cheap Words".into(),
                    can_see: false,
                    price: Some(1),
                    kind: BrainKind::Chat,
                },
            ],
        );
        session.brains().expect("the list is offered");
        let chosen = session
            .chosen_brain()
            .unwrap_or_else(|| panic!("{provider:?} picks a default"));
        assert_eq!(chosen.id, "cheap-eye", "{provider:?}");
    }
}

/// The Person picks a Brain on OpenAI or Google; the Agent thinks with that id.
#[test]
fn openai_and_google_think_with_the_brain_the_person_picked() {
    for provider in OPENAI_AND_GOOGLE {
        let provider_script = ScriptedProvider::default()
            .offering(vec![seeing("first", "First"), seeing("picked", "Picked")])
            .plan(ScriptedProvider::place_and_frame(
                "the lighthouse",
                Primitive::Cylinder,
                "on the cliff",
            ));
        let mut session = Session::start(provider_script, ViewReport::new());
        session.set_provider(provider);
        session.set_key("sk-test");
        session
            .set_brain("picked")
            .unwrap_or_else(|_| panic!("{provider:?} pick is on the list"));

        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .unwrap_or_else(|_| panic!("{provider:?} scripted plan lands"));

        assert_eq!(
            session.chosen_brain().map(|b| b.id.as_str()),
            Some("picked"),
            "{provider:?}"
        );
        let creds = session.provider().received_credentials();
        assert_eq!(
            creds.last().and_then(|c| c.brain.as_deref()),
            Some("picked"),
            "{provider:?} the Agent thinks with the Brain the Person picked"
        );
    }
}

/// Words-only Intent works with a text-only Brain on OpenAI and Google.
#[test]
fn openai_and_google_words_only_work_with_a_text_only_brain() {
    for provider in OPENAI_AND_GOOGLE {
        let provider_script = ScriptedProvider::default()
            .offering(vec![text_only("words", "Words Only")])
            .plan(ScriptedProvider::place_and_frame(
                "the lighthouse",
                Primitive::Cylinder,
                "on the cliff",
            ));
        let mut session = Session::start(provider_script, ViewReport::new());
        session.set_provider(provider);
        session.set_key("sk-test");
        session
            .set_brain("words")
            .expect("text-only Brains stay on the list");

        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .unwrap_or_else(|_| panic!("{provider:?} words-only Intent must think"));
        assert_eq!(session.objects().len(), 1, "{provider:?}");
    }
}

/// Pictures plus a Brain that cannot see them: an error on OpenAI and Google.
#[test]
fn openai_and_google_pictures_to_a_text_only_brain_are_an_error() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(provider, vec![text_only("words", "Words Only")]);
        session
            .set_brain("words")
            .expect("text-only stays on the list");

        let err = session
            .submit_intent(
                Intent::words("a lighthouse like this sketch")
                    .with_pictures([Picture::sketch(b"sketch-bytes".to_vec())]),
            )
            .expect_err("a Brain that cannot see must not swallow the picture");

        assert_eq!(
            err,
            SessionError::Brain(BrainError::CannotSee),
            "{provider:?}"
        );
        assert!(
            session.objects().is_empty(),
            "{provider:?} Viewport is not a silent freeze"
        );
    }
}

/// Nothing offered is an actionable error on OpenAI and Google.
#[test]
fn openai_and_google_empty_catalog_is_an_actionable_error() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(provider, vec![]);
        let err = session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect_err("nothing offered means the Agent cannot think");
        assert_eq!(
            err,
            SessionError::Brain(BrainError::Missing),
            "{provider:?}"
        );
        assert!(session.objects().is_empty(), "{provider:?}");
    }
}

/// Changing Brain on OpenAI or Google leaves the open Scene and Talk intact.
#[test]
fn openai_and_google_changing_brain_leaves_the_open_scene_intact() {
    for provider in OPENAI_AND_GOOGLE {
        let provider_script = ScriptedProvider::default()
            .offering(vec![seeing("first", "First"), seeing("second", "Second")])
            .plan(ScriptedProvider::place_and_frame(
                "the lighthouse",
                Primitive::Cylinder,
                "on the cliff",
            ));
        let mut session = Session::start(provider_script, ViewReport::new());
        session.set_provider(provider);
        session.set_key("sk-test");
        session.set_brain("first").expect("first is offered");
        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect("the scripted plan lands");
        let talk_len = session.talk().len();

        session.set_brain("second").expect("second is offered");

        assert_eq!(session.objects().len(), 1, "{provider:?}");
        assert_eq!(session.objects()[0].name, "the lighthouse");
        assert_eq!(session.talk().len(), talk_len, "{provider:?}");
    }
}

/// A new Provider with a Key but no remembered Brain receives the default
/// from its live list. The previous Provider's Brain stays remembered.
#[test]
fn switching_provider_picks_a_new_default_brain() {
    let provider = ScriptedProvider::default()
        .offering(vec![
            seeing("first-default", "First Default"),
            seeing("person-pick", "Person Pick"),
        ])
        .plan(ScriptedProvider::place_and_frame(
            "the lighthouse",
            Primitive::Cylinder,
            "on the cliff",
        ));
    let mut session = Session::start(provider, ViewReport::new());
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-one");
    session
        .set_brain("person-pick")
        .expect("the Person's pick is offered");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the lighthouse lands");
    assert_eq!(session.objects().len(), 1);
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("person-pick")
    );

    session.set_provider(ProviderName::OpenAI);
    session.set_key("sk-openai");
    session.brains().expect("OpenAI offers the scripted list");
    let chosen = session
        .chosen_brain()
        .expect("OpenAI gets a default so they can type without shopping");
    assert_eq!(
        chosen.id, "first-default",
        "a new Provider with no remembered Brain gets the default"
    );
    assert_eq!(session.objects()[0].name, "the lighthouse");
}

/// A catalog refresh updates the list, not a Brain already chosen — whether
/// Tessera picked the default or the Person did.
#[test]
fn catalog_refresh_updates_the_list_not_the_chosen_brain() {
    let mut session = Session::start(
        ScriptedProvider::default()
            .offering(vec![
                seeing_priced("kept", "Kept", 10),
                seeing_priced("dear", "Dear", 50),
            ])
            .then_offering(vec![
                seeing_priced("cheap-now", "Cheap Now", 1),
                seeing_priced("kept", "Kept", 10),
                seeing_priced("dear", "Dear", 50),
            ]),
        ViewReport::new(),
    );
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    let first = session.brains().expect("the first list is offered");
    let first_ids: Vec<&str> = first.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(first_ids, ["kept", "dear"]);
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("kept"),
        "Tessera picks the cheapest that can see"
    );

    let refreshed = session.brains().expect("a refresh fetches again");
    let refreshed_ids: Vec<&str> = refreshed.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(
        refreshed_ids,
        ["cheap-now", "kept", "dear"],
        "the list updates"
    );
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("kept"),
        "Tessera's default is not swapped for a cheaper new offering"
    );

    session.set_brain("dear").expect("Dear is still offered");
    let after_pick = session.brains().expect("a later refresh still fetches");
    assert!(
        after_pick.iter().any(|b| b.id == "cheap-now"),
        "the refreshed list is still what settings show"
    );
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("dear"),
        "the Person's pick is not swapped either"
    );
}

/// Restarting restores the active Provider, per-Provider Keys and Brains,
/// and cached catalogs. Offline still thinks from the cache.
#[test]
fn restart_restores_active_provider_keys_brains_and_catalogs() {
    let path = std::env::temp_dir().join(format!(
        "tessera-restart-settings-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    {
        let mut session = Session::start(
            ScriptedProvider::default().offering(vec![
                seeing("first-default", "First Default"),
                seeing("person-pick", "Person Pick"),
            ]),
            ViewReport::new(),
        )
        .with_key_store(FileKeyStore::new(&path));
        session.set_provider(ProviderName::Anthropic);
        session.set_key("sk-ant");
        session
            .set_brain("person-pick")
            .expect("the Person's pick is offered");
        session.set_provider(ProviderName::Google);
        session.set_key("sk-google");
        session.brains().expect("Google gets a default");
        assert_eq!(
            session.chosen_brain().map(|b| b.id.as_str()),
            Some("first-default")
        );
    }

    let mut session = Session::start(
        ScriptedProvider::default().catalog_fail(ProviderError::Unavailable("down".into())),
        ViewReport::new(),
    )
    .with_key_store(FileKeyStore::new(&path));
    assert_eq!(session.chosen_provider(), Some(ProviderName::Google));
    assert!(session.has_key(), "Google's Key is still on the machine");
    let google = session
        .brains()
        .expect("Google's cached catalog still works offline");
    let google_ids: Vec<&str> = google.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(google_ids, ["first-default", "person-pick"]);
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("first-default")
    );

    session.set_provider(ProviderName::Anthropic);
    assert!(
        session.has_key(),
        "Anthropic's Key is still on the machine after a restart"
    );
    let anthropic = session
        .brains()
        .expect("Anthropic's cached catalog still works offline");
    let anthropic_ids: Vec<&str> = anthropic.iter().map(|b| b.id.as_str()).collect();
    assert_eq!(anthropic_ids, ["first-default", "person-pick"]);
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("person-pick"),
        "Anthropic's Brain is still the Person's pick"
    );
    let _ = std::fs::remove_file(&path);
}

/// A machine that only had the old single Key + Provider still thinks: that
/// pair becomes that Provider's remembered settings.
#[test]
fn legacy_single_key_and_provider_still_thinks() {
    let path = std::env::temp_dir().join(format!(
        "tessera-legacy-settings-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    std::fs::write(
        &path,
        r#"{
  "provider": "openai",
  "key": "sk-legacy",
  "brain": "scripted"
}"#,
    )
    .expect("legacy settings written");

    let provider = ScriptedProvider::default().plan(ScriptedProvider::place_and_frame(
        "the lighthouse",
        Primitive::Cylinder,
        "on the cliff",
    ));
    let mut session =
        Session::start(provider, ViewReport::new()).with_key_store(FileKeyStore::new(&path));
    assert_eq!(session.chosen_provider(), Some(ProviderName::OpenAI));
    assert!(session.has_key());
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the old pair still thinks");
    let creds = session.provider().received_credentials();
    assert_eq!(creds.last().map(|c| c.key.as_str()), Some("sk-legacy"));
    assert_eq!(
        creds.last().and_then(|c| c.brain.as_deref()),
        Some("scripted")
    );
    assert_eq!(session.objects().len(), 1);
    let _ = std::fs::remove_file(&path);
}

/// Switching Provider restores that Provider's remembered Key and Brain.
/// Anthropic → another lab → Anthropic does not require pasting or re-picking.
#[test]
fn switching_provider_restores_that_providers_key_and_brain() {
    let provider = ScriptedProvider::default()
        .offering(vec![
            seeing("first-default", "First Default"),
            seeing("person-pick", "Person Pick"),
        ])
        .plan(ScriptedProvider::place_and_frame(
            "the lighthouse",
            Primitive::Cylinder,
            "on the cliff",
        ))
        .plan(ScriptedProvider::place_and_frame(
            "the lantern",
            Primitive::Sphere,
            "on the lighthouse",
        ));
    let mut session = Session::start(provider, ViewReport::new());
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    session
        .set_brain("person-pick")
        .expect("the Person's pick is offered");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the lighthouse lands");

    session.set_provider(ProviderName::Google);
    session.set_key("sk-google");
    session.brains().expect("Google offers the scripted list");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("first-default"),
        "a new Provider with no remembered Brain gets the default"
    );

    session.set_provider(ProviderName::Anthropic);
    session.brains().expect("Anthropic's list is still offered");
    assert_eq!(
        session.key(),
        Some("sk-ant"),
        "returning to Anthropic does not require pasting the Key again"
    );
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some("person-pick"),
        "returning to Anthropic does not require re-picking its Brain"
    );

    session
        .submit_intent("a lantern on the lighthouse")
        .expect("Anthropic's remembered Key still thinks");
    let creds = session.provider().received_credentials();
    assert_eq!(
        creds.last().map(|c| c.key.as_str()),
        Some("sk-ant"),
        "the Agent thinks with Anthropic's remembered Key, not Google's"
    );
    assert_eq!(
        creds.last().and_then(|c| c.brain.as_deref()),
        Some("person-pick"),
        "the Agent thinks with Anthropic's remembered Brain"
    );
    assert_eq!(session.objects().len(), 2, "the open Scene stayed");
}

/// Key and Brain stay in settings, not the Scene, for OpenAI (Google is the
/// same store).
#[test]
fn openai_key_and_brain_are_not_in_the_scene_or_talk() {
    let path = std::env::temp_dir().join(format!(
        "tessera-openai-brain-settings-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    let secret = "sk-openai-secret";
    let brain_id = "gpt-4.1-nano";

    {
        let provider = ScriptedProvider::default()
            .offering(vec![seeing(brain_id, "GPT 4.1 Nano")])
            .plan(ScriptedProvider::place_and_frame(
                "the lighthouse",
                Primitive::Cylinder,
                "on the cliff",
            ));
        let mut session =
            Session::start(provider, ViewReport::new()).with_key_store(FileKeyStore::new(&path));
        session.set_provider(ProviderName::OpenAI);
        session.set_key(secret);
        session.set_brain(brain_id).expect("it is offered");
        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect("the scripted plan lands");

        let on_disk = std::fs::read_to_string(&path).expect("settings were written");
        assert!(on_disk.contains(secret), "the Key lives in settings");
        assert!(
            on_disk.contains(brain_id),
            "the Brain lives in settings next to the Key: {on_disk}"
        );

        for line in session.talk() {
            assert!(!line.text.contains(secret), "Talk must not carry the Key");
            assert!(
                !line.text.contains(brain_id),
                "Talk must not name the Brain"
            );
        }

        let scene_path = std::env::temp_dir().join(format!(
            "tessera-openai-brain-scene-{}-{}.json",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        session.save(&scene_path).expect("the Scene is kept");
        let scene_on_disk = std::fs::read_to_string(&scene_path).expect("Scene was written");
        assert!(
            !scene_on_disk.contains(secret),
            "Scene must not carry the Key"
        );
        assert!(
            !scene_on_disk.contains(brain_id),
            "Scene must not carry the Brain"
        );
        let _ = std::fs::remove_file(&scene_path);
    }

    let mut session = Session::start(
        ScriptedProvider::default().offering(vec![seeing(brain_id, "GPT 4.1 Nano")]),
        ViewReport::new(),
    )
    .with_key_store(FileKeyStore::new(&path));
    assert!(session.has_key(), "a new Session loads the Key from disk");
    assert_eq!(session.chosen_provider(), Some(ProviderName::OpenAI));
    session.brains().expect("the list is offered");
    assert_eq!(
        session.chosen_brain().map(|b| b.id.as_str()),
        Some(brain_id),
        "a restart finds the Brain next to the Key"
    );
    assert!(session.objects().is_empty());

    let _ = std::fs::remove_file(&path);
}

/// Default without prices: first that can see, on OpenAI and Google.
#[test]
fn openai_and_google_default_without_price_is_the_first_that_can_see() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(
            provider,
            vec![
                text_only("words", "Words Only"),
                seeing("first-eye", "First Eye"),
                seeing("later-eye", "Later Eye"),
            ],
        );
        session.brains().expect("the list is offered");
        let chosen = session.chosen_brain().expect("a default is picked");
        assert_eq!(chosen.id, "first-eye", "{provider:?}");
    }
}

/// Default when none can see: cheapest chat Brain, on OpenAI and Google.
#[test]
fn openai_and_google_default_when_none_can_see_is_the_cheapest_chat() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = with_provider(
            provider,
            vec![
                Brain {
                    id: "dear-words".into(),
                    name: "Dear Words".into(),
                    can_see: false,
                    price: Some(20),
                    kind: BrainKind::Chat,
                },
                Brain {
                    id: "cheap-words".into(),
                    name: "Cheap Words".into(),
                    can_see: false,
                    price: Some(2),
                    kind: BrainKind::Chat,
                },
            ],
        );
        session.brains().expect("the list is offered");
        let chosen = session.chosen_brain().expect("a default is picked");
        assert_eq!(chosen.id, "cheap-words", "{provider:?}");
    }
}

/// A down catalog is an error they can act on, on OpenAI and Google.
#[test]
fn openai_and_google_failed_catalog_is_an_actionable_error() {
    for provider in OPENAI_AND_GOOGLE {
        let mut session = Session::start(
            ScriptedProvider::default().catalog_fail(ProviderError::Unavailable("down".into())),
            ViewReport::new(),
        );
        session.set_provider(provider);
        session.set_key("sk-test");
        let err = session
            .brains()
            .expect_err("a down catalog must not look like an empty list");
        match err {
            SessionError::Key(KeyError::Unavailable(reason)) => {
                assert!(reason.contains("down"), "{provider:?} {reason}");
            }
            other => panic!("{provider:?} expected Unavailable, got {other:?}"),
        }
    }
}

/// A remembered Brain the Provider no longer offers is an error on OpenAI
/// and Google; Tessera does not silently swap.
#[test]
fn openai_and_google_vanished_brain_is_an_actionable_error() {
    for provider in OPENAI_AND_GOOGLE {
        let path = std::env::temp_dir().join(format!(
            "tessera-vanished-{}-{}-{}.json",
            provider.word(),
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        {
            let mut session = Session::start(
                ScriptedProvider::default().offering(vec![seeing("gone", "Gone")]),
                ViewReport::new(),
            )
            .with_key_store(FileKeyStore::new(&path));
            session.set_provider(provider);
            session.set_key("sk-test");
            session.set_brain("gone").expect("it is offered now");
        }

        let mut session = Session::start(
            ScriptedProvider::default().offering(vec![seeing("other", "Other")]),
            ViewReport::new(),
        )
        .with_key_store(FileKeyStore::new(&path));
        let err = session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect_err("a vanished Brain must not silently become Other");
        assert_eq!(
            err,
            SessionError::Brain(BrainError::Unknown),
            "{provider:?}"
        );
        assert!(session.objects().is_empty(), "{provider:?}");
        let _ = std::fs::remove_file(&path);
    }
}
