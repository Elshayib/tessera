//! Key and Providers (issue #4): the Person pastes a Key, picks Anthropic,
//! OpenAI, or Google, and a bad Key shows an error they can act on. Changing
//! Key or Provider leaves the open Scene intact. The Key lives in settings on
//! the machine, never in the Scene.
//!
//! Tests act as the Person: headless, scripted Provider (or a scripted trouble),
//! no live lab, no Verbs spoken by the test.

use tessera_session::{
    FileKeyStore, KeyError, Primitive, ProviderError, ProviderName, ScriptedProvider, Session,
    SessionError, ViewReport,
};

fn place_lighthouse() -> ScriptedProvider {
    ScriptedProvider::default().plan(ScriptedProvider::place_and_frame(
        "the lighthouse",
        Primitive::Cylinder,
        "on the cliff",
    ))
}

/// The Person can paste a Key and pick any of the three Providers.
#[test]
fn person_sets_a_key_and_chooses_each_provider() {
    for name in ProviderName::ALL {
        let mut session = Session::start(ScriptedProvider::default(), ViewReport::new());
        session.set_provider(name);
        session.set_key("sk-test");

        assert_eq!(
            session.chosen_provider(),
            Some(name),
            "the chosen Provider is the one the Person picked"
        );
        assert!(
            session.has_key(),
            "after pasting, a Key is set so the Agent can think"
        );
    }
}

/// A missing Key is an error the Person can act on, not a frozen Viewport.
#[test]
fn missing_key_is_an_actionable_error() {
    let mut session = Session::start(ScriptedProvider::default(), ViewReport::new());
    session.set_provider(ProviderName::Anthropic);

    let err = session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect_err("without a Key the Agent cannot think");

    assert_eq!(err, SessionError::Key(KeyError::Missing));
    let action = err.to_string();
    assert!(
        action.contains("Key"),
        "the error must name the Key so they know what to paste: {action:?}"
    );
    assert!(
        session.objects().is_empty(),
        "a missing Key must not pretend a Scene appeared"
    );
}

/// Picking a Provider is required; a Key belongs to one (ADR-0016).
#[test]
fn missing_provider_is_an_actionable_error() {
    let mut session = Session::start(ScriptedProvider::default(), ViewReport::new());
    session.set_key("sk-test");

    let err = session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect_err("without a Provider the Agent cannot think");

    assert_eq!(err, SessionError::Key(KeyError::MissingProvider));
    let action = err.to_string();
    assert!(
        action.contains("Anthropic") && action.contains("OpenAI") && action.contains("Google"),
        "the error must name the short list: {action:?}"
    );
}

/// An invalid Key is an error they can act on.
#[test]
fn invalid_key_is_an_actionable_error() {
    let provider = ScriptedProvider::default().fail(ProviderError::InvalidKey);
    let mut session = Session::start(provider, ViewReport::new());
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-bogus");

    let err = session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect_err("a rejected Key must surface");

    assert_eq!(err, SessionError::Key(KeyError::Invalid));
    let action = err.to_string();
    assert!(
        action.contains("Key"),
        "the error must name the Key: {action:?}"
    );
}

/// An out-of-credit Key is an error they can act on.
#[test]
fn out_of_credit_key_is_an_actionable_error() {
    let provider = ScriptedProvider::default().fail(ProviderError::OutOfCredit);
    let mut session = Session::start(provider, ViewReport::new());
    session.set_provider(ProviderName::OpenAI);
    session.set_key("sk-broke");

    let err = session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect_err("an out-of-credit Key must surface");

    assert_eq!(err, SessionError::Key(KeyError::OutOfCredit));
    let action = err.to_string();
    assert!(
        action.to_lowercase().contains("credit"),
        "the error must say the Key is out of credit: {action:?}"
    );
}

/// Changing Key or Provider leaves the open Scene intact (spec story 50).
#[test]
fn changing_key_or_provider_leaves_the_open_scene_intact() {
    let mut session = Session::start(place_lighthouse(), ViewReport::new());
    session.set_provider(ProviderName::Anthropic);
    session.set_key("sk-ant");
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted plan lands");
    assert_eq!(session.objects().len(), 1);
    let talk_len = session.talk().len();

    session.set_provider(ProviderName::Google);
    session.set_key("sk-google");

    assert_eq!(
        session.objects().len(),
        1,
        "the lighthouse is still there after changing Provider and Key"
    );
    assert_eq!(session.objects()[0].name, "the lighthouse");
    assert_eq!(
        session.talk().len(),
        talk_len,
        "the Talk is still there; settings are not the Scene"
    );
}

/// The Key is stored on the machine in settings, not in the Scene. A new Session
/// loading those settings has the Key and an empty Scene.
#[test]
fn key_lives_in_settings_on_the_machine_not_in_the_scene() {
    let path = std::env::temp_dir().join(format!(
        "tessera-settings-{}-{}.json",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos()
    ));
    let secret = "sk-secret-do-not-leak";

    {
        let mut session = Session::start(place_lighthouse(), ViewReport::new())
            .with_key_store(FileKeyStore::new(&path));
        session.set_provider(ProviderName::OpenAI);
        session.set_key(secret);
        session
            .submit_intent("a weathered lighthouse on a cliff at dusk")
            .expect("the scripted plan lands");

        let on_disk = std::fs::read_to_string(&path).expect("settings were written");
        assert!(
            on_disk.contains(secret),
            "the Key must live in the settings file on the machine"
        );
        assert!(
            on_disk.to_lowercase().contains("openai"),
            "the chosen Provider must live next to the Key: {on_disk}"
        );

        for line in session.talk() {
            assert!(
                !line.text.contains(secret),
                "the Talk must not carry the Key"
            );
        }
        for object in session.objects() {
            assert!(!object.name.contains(secret));
            assert!(!object.place.contains(secret));
            assert!(!object.part.contains(secret));
        }
    }

    let session = Session::start(ScriptedProvider::default(), ViewReport::new())
        .with_key_store(FileKeyStore::new(&path));
    assert!(session.has_key(), "a new Session loads the Key from disk");
    assert_eq!(session.chosen_provider(), Some(ProviderName::OpenAI));
    assert!(
        session.objects().is_empty(),
        "settings are not a Scene: a new Session starts empty"
    );

    let _ = std::fs::remove_file(&path);
}
