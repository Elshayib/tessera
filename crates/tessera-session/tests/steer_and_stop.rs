//! Steer and Stop (issue #13): while the Agent is working, the Person can
//! talk over (Steer: current Verb finishes, then the new Intent is taken) or
//! halt (Stop: the in-flight Verb does not land; the Scene stays at the last
//! completed Verb). After Stop they talk again from that state.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent, no Orbit or Point used.

use tessera_session::{
    ObjectRef, Plan, Primitive, Provider, ProviderName, ScriptedProvider, Session, Verb, View,
    ViewReport,
};

fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key("test-key-the-person-pasted");
}

/// One Scene-changing Verb, so a Frame is one completed place.
fn place(name: &str, part: Primitive, at: &str) -> Plan {
    Plan::new(
        vec![format!("Placing {name} {at}.")],
        vec![Verb::place {
            name: ObjectRef(name.to_string()),
            part: part.into(),
            at: at.to_string(),
        }],
    )
}

fn names<P: Provider, V: View>(session: &Session<P, V>) -> Vec<&str> {
    session.objects().iter().map(|o| o.name.as_str()).collect()
}

/// Spec story 23: Steer during a multi-Verb Rehearsal. The current Verb
/// completes; the rest of that take is abandoned; the new Intent runs.
#[test]
fn person_steers_during_a_multi_verb_rehearsal() {
    let provider = ScriptedProvider::default()
        .plan(place("the lighthouse", Primitive::Cylinder, "on the cliff"))
        .plan(Plan::new(
            vec![
                "Placing the shed beside it.".to_string(),
                "Placing the door in the lighthouse.".to_string(),
            ],
            vec![
                Verb::place {
                    name: ObjectRef("the shed".to_string()),
                    part: Primitive::Box.into(),
                    at: "beside the lighthouse".to_string(),
                },
                Verb::place {
                    name: ObjectRef("the door".to_string()),
                    part: Primitive::Box.into(),
                    at: "in the lighthouse".to_string(),
                },
            ],
        ))
        .plan(place("the window", Primitive::Box, "in the lighthouse"));
    // First Intent Frames once (the lighthouse). The Person Steers after the
    // shed of the second Intent Frames — the door never completes; the window
    // is the new Intent.
    let view = ViewReport::new().person_steers_after_frames(2, "not the door — the window");
    let mut session = Session::start(provider, view);
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session
        .submit_intent("add a shed and a door")
        .expect("Steer finishes the shed, then takes the new Intent");

    assert_eq!(
        names(&session),
        vec!["the lighthouse", "the shed", "the window"],
        "the shed must land; the door must not; the steered window must"
    );
    let talk: Vec<String> = session.talk().into_iter().map(|l| l.text).collect();
    assert!(
        talk.iter().any(|line| line == "not the door — the window"),
        "Steer is Talk; the new Intent's words live with the Scene: {talk:?}"
    );
    let received: Vec<&str> = session
        .provider()
        .received()
        .iter()
        .map(|i| i.words.as_str())
        .collect();
    assert_eq!(
        received,
        vec![
            "a lighthouse",
            "add a shed and a door",
            "not the door — the window"
        ],
        "the Agent must plan the steered Intent, not finish the abandoned door"
    );
}

/// Spec story 24–25: Stop during a take. The in-flight Verb does not land;
/// the Scene matches the last completed Verb.
#[test]
fn person_stops_and_the_in_flight_verb_does_not_land() {
    let provider = ScriptedProvider::default()
        .plan(place("the lighthouse", Primitive::Cylinder, "on the cliff"))
        .plan(Plan::new(
            vec![
                "Placing the shed beside it.".to_string(),
                "Placing the door in the lighthouse.".to_string(),
            ],
            vec![
                Verb::place {
                    name: ObjectRef("the shed".to_string()),
                    part: Primitive::Box.into(),
                    at: "beside the lighthouse".to_string(),
                },
                Verb::place {
                    name: ObjectRef("the door".to_string()),
                    part: Primitive::Box.into(),
                    at: "in the lighthouse".to_string(),
                },
            ],
        ));
    let view = ViewReport::new().person_stops_after_frames(2);
    let mut session = Session::start(provider, view);
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session
        .submit_intent("add a shed and a door")
        .expect("the take Stops after the shed");

    assert_eq!(
        names(&session),
        vec!["the lighthouse", "the shed"],
        "Stop must leave the Scene at the last completed Verb; the door never landed"
    );
}

/// Spec story 25: after Stop, the Person talks again from that known state.
#[test]
fn after_stop_the_person_can_talk_again_from_that_state() {
    let provider = ScriptedProvider::default()
        .plan(place("the lighthouse", Primitive::Cylinder, "on the cliff"))
        .plan(Plan::new(
            vec![
                "Placing the shed beside it.".to_string(),
                "Placing the door in the lighthouse.".to_string(),
            ],
            vec![
                Verb::place {
                    name: ObjectRef("the shed".to_string()),
                    part: Primitive::Box.into(),
                    at: "beside the lighthouse".to_string(),
                },
                Verb::place {
                    name: ObjectRef("the door".to_string()),
                    part: Primitive::Box.into(),
                    at: "in the lighthouse".to_string(),
                },
            ],
        ))
        .plan(place("the window", Primitive::Box, "in the lighthouse"));
    let view = ViewReport::new().person_stops_after_frames(2);
    let mut session = Session::start(provider, view);
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session
        .submit_intent("add a shed and a door")
        .expect("the take Stops after the shed");
    session
        .submit_intent("add a window instead")
        .expect("after Stop they can talk again");

    assert_eq!(
        names(&session),
        vec!["the lighthouse", "the shed", "the window"],
        "talk after Stop starts from the last completed Verb, not the abandoned door"
    );
}
