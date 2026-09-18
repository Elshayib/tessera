//! Brain from a live catalog (issue #16): the Person pastes an Anthropic Key
//! and picks a Brain from what Anthropic currently offers. Tessera does not
//! pin a SKU. OpenAI and Google still think; this ticket does not redo their
//! catalogs.
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
