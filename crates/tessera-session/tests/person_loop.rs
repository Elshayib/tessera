//! Tests act as the Person (spec #1: Testing Decisions). They submit Intent and
//! assert what a Person can notice: Narration, named Objects, what the camera
//! is on. They never issue Verbs, never open a real window, and never call a
//! live Provider — the Provider here is scripted, the View is a recorder.

use tessera_session::{ScriptedProvider, Session, ViewReport};

/// The Person starts a Scene with no account: Session::start takes nothing but
/// a Provider and a View. There is no signup, no login, no key required to open
/// a Scene (the Key is a #4 concern).
#[test]
fn person_starts_a_scene_with_no_account() {
    let provider = ScriptedProvider::default();
    let view = ViewReport::new();
    let session = Session::start(provider, view);

    // A fresh Scene starts empty of Objects (spec story 31: "a fresh Intent is a
    // fresh place").
    assert!(
        session.objects().is_empty(),
        "a new Scene must start with no Objects in it"
    );
    // ...and empty of Talk.
    assert!(
        session.talk().is_empty(),
        "a new Scene must start with no Talk in it"
    );
}

#[test]
fn person_types_intent_and_the_agent_places_a_named_object() {
    let provider = ScriptedProvider::default().plan(ScriptedProvider::place_and_frame(
        "the lighthouse",
        "a cylinder",
        "on the cliff",
    ));
    let mut session = Session::start(provider, ViewReport::new());

    session.submit_intent("a weathered lighthouse on a cliff at dusk");

    let objects = session.objects();
    assert_eq!(objects.len(), 1, "the Intent should have placed one Object");
    assert_eq!(
        objects[0].name, "the lighthouse",
        "the Object the Agent placed must carry the name the Agent gave it"
    );
}

#[test]
fn narration_says_what_happened_using_the_objects_name() {
    let provider = ScriptedProvider::default().plan(ScriptedProvider::place_and_frame(
        "the lighthouse",
        "a cylinder",
        "on the cliff",
    ));
    let mut session = Session::start(provider, ViewReport::new());

    let said = session.submit_intent("a weathered lighthouse on a cliff at dusk");
    assert!(
        !said.is_empty(),
        "the Agent must Narrate; a silent Viewport loses the beginner (ADR-0004)"
    );
    let joined = said.join(" ");
    assert!(
        joined.contains("the lighthouse"),
        "Narration must use the Object's name so the Person can say it back: {joined:?}"
    );
}

#[test]
fn the_agent_frames_the_work_so_the_person_is_looking_at_it() {
    let provider = ScriptedProvider::default().plan(ScriptedProvider::place_and_frame(
        "the lighthouse",
        "a cylinder",
        "on the cliff",
    ));
    let mut session = Session::start(provider, ViewReport::new());

    session.submit_intent("a weathered lighthouse on a cliff at dusk");

    let last_frame = session
        .view()
        .last_frame()
        .expect("the Agent must Frame on the work after placing an Object");
    assert_eq!(
        last_frame.object.as_deref(),
        Some("the lighthouse"),
        "the camera should be on the Object that just changed"
    );
}

#[test]
fn the_talk_accumulates_across_intents() {
    let provider = ScriptedProvider::default()
        .plan(ScriptedProvider::place_and_frame(
            "the lighthouse",
            "a cylinder",
            "on the cliff",
        ))
        .plan(ScriptedProvider::place_and_frame(
            "the cliff",
            "a box",
            "under the lighthouse",
        ));
    let mut session = Session::start(provider, ViewReport::new());

    session.submit_intent("a weathered lighthouse on a cliff at dusk");
    session.submit_intent("put it on a cliff");

    let talk = session.talk();
    assert_eq!(
        talk.len(),
        4,
        "the Talk keeps every Narration line; opening yesterday's Scene continues the Rehearsal"
    );
    let first = &talk[0].text;
    assert!(
        first.contains("the lighthouse"),
        "the first Narration is still in the Talk, not overwritten by later turns"
    );
    assert_eq!(
        session.objects().len(),
        2,
        "the second Intent must land the second plan, not replay the first"
    );
    assert_eq!(session.objects()[1].name, "the cliff");
}
