//! Undo and Marks (issue #7): the Person can Undo the last completed Verb
//! (and stack that), Mark a state they liked, and restore a Mark. The First
//! take is already a Mark. A Stopped Verb that never completed is not on the
//! Undo stack.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent, no Orbit or Point used.

use tessera_session::{
    Amount, Axis, FrameTarget, LightCondition, MaterialFamily, ObjectRef, Plan, Primitive,
    Provider, ProviderName, ScriptedProvider, Session, Verb, View, ViewReport,
};

fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key("test-key-the-person-pasted");
}

fn clay_of<P: Provider, V: View>(session: &Session<P, V>, name: &str) -> tessera_session::Clay {
    session
        .objects()
        .iter()
        .find(|o| o.name == name)
        .unwrap_or_else(|| panic!("the Scene should still have {name}"))
        .clay
        .clone()
}

/// One Scene-changing Verb, so Undo of "the last Verb" is something the Person
/// can notice. (`place_and_frame` ends on `frame`, which does not change Clay.)
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

/// Tracer: Undo the last completed Verb; the Scene matches before that Verb.
#[test]
fn undo_reverts_the_last_completed_verb() {
    let provider = ScriptedProvider::default()
        .plan(place("the lighthouse", Primitive::Cylinder, "on the cliff"))
        .plan(place("the shed", Primitive::Box, "beside the lighthouse"));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session
        .submit_intent("add a shed beside it")
        .expect("the shed lands");
    assert_eq!(session.objects().len(), 2);
    assert_eq!(session.objects()[1].name, "the shed");

    session.undo().expect("there is a completed Verb to Undo");

    assert_eq!(
        session.objects().len(),
        1,
        "Undo must revert the last Verb; the shed should be gone"
    );
    assert_eq!(session.objects()[0].name, "the lighthouse");
    assert_eq!(
        session
            .view()
            .last_frame()
            .and_then(|f| f.object.as_deref()),
        Some("the lighthouse"),
        "Undo puts the camera back on the work as it was"
    );
}

/// Undo stacks: two Undos walk back two Verbs.
#[test]
fn undo_stacks_two_verbs() {
    let provider = ScriptedProvider::default()
        .plan(place("the lighthouse", Primitive::Cylinder, "on the cliff"))
        .plan(place("the shed", Primitive::Box, "beside the lighthouse"))
        .plan(place("the door", Primitive::Box, "in the lighthouse"));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session.submit_intent("add a shed").expect("the shed lands");
    session.submit_intent("add a door").expect("the door lands");
    assert_eq!(session.objects().len(), 3);

    session.undo().expect("the door undoes");
    assert_eq!(session.objects().len(), 2, "first Undo walks back one Verb");
    assert_eq!(session.objects()[1].name, "the shed");

    session.undo().expect("the shed undoes");
    assert_eq!(
        session.objects().len(),
        1,
        "second Undo walks back the Verb before that"
    );
    assert_eq!(session.objects()[0].name, "the lighthouse");
}

/// A Stopped Verb that never completed is not on the Undo stack. Stop leaves
/// the Scene at the last completed Verb; one Undo walks that back, not a
/// ghost of the abandoned step.
#[test]
fn a_stopped_verb_that_never_completed_is_not_on_the_undo_stack() {
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
    // First Intent Frames once (the lighthouse). The Person hits Stop after
    // the shed of the second Intent Frames — the door never completes.
    let view = ViewReport::new().person_stops_after_frames(2);
    let mut session = Session::start(provider, view);
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session
        .submit_intent("add a shed and a door")
        .expect("the take stops after the shed");

    let names: Vec<&str> = session.objects().iter().map(|o| o.name.as_str()).collect();
    assert_eq!(
        names,
        vec!["the lighthouse", "the shed"],
        "Stop must leave the Scene at the last completed Verb; the door never landed"
    );

    session.undo().expect("the shed was completed and can Undo");
    let names: Vec<&str> = session.objects().iter().map(|o| o.name.as_str()).collect();
    assert_eq!(
        names,
        vec!["the lighthouse"],
        "one Undo walks back the last completed Verb; the Stopped door is not on the stack"
    );
}

/// The Person can create a named Mark and restore it; the Scene matches that
/// Mark — including the Talk as it was then (spec: Scene+Talk-at-that-state).
#[test]
fn person_names_a_mark_and_restores_it() {
    let provider = ScriptedProvider::default()
        .plan(place("the lighthouse", Primitive::Cylinder, "on the cliff"))
        .plan(place("the shed", Primitive::Box, "beside the lighthouse"));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session.mark("at dusk, before the extra windows");
    assert!(
        session
            .marks()
            .iter()
            .any(|n| n == "at dusk, before the extra windows"),
        "the Person's named Mark must be among the Marks: {:?}",
        session.marks()
    );

    session
        .submit_intent("add a shed beside it")
        .expect("the shed lands");
    assert_eq!(session.objects().len(), 2);
    assert!(
        session
            .talk()
            .iter()
            .any(|line| line.text.contains("the shed")),
        "Rehearsal Talk mentions the shed before restore"
    );

    session
        .restore("at dusk, before the extra windows")
        .expect("the named Mark exists");
    assert_eq!(
        session.objects().len(),
        1,
        "restoring the Mark returns that state of the Scene"
    );
    assert_eq!(session.objects()[0].name, "the lighthouse");
    assert!(
        session
            .talk()
            .iter()
            .all(|line| !line.text.contains("the shed")),
        "restoring a Mark returns the Talk at that state too"
    );
}

fn first_take_plan() -> Plan {
    Plan::new(
        vec![
            "Placing the cliff.".to_string(),
            "Raising the lighthouse.".to_string(),
            "Setting the light to dusk.".to_string(),
            "Dressing the sky in dusk haze.".to_string(),
            "The cliff wears weathered stone.".to_string(),
            "Painted wood for the tower.".to_string(),
            "Framing the lighthouse.".to_string(),
        ],
        vec![
            Verb::place {
                name: ObjectRef("the cliff".to_string()),
                part: Primitive::Box.into(),
                at: "under the sky".to_string(),
            },
            Verb::place {
                name: ObjectRef("the lighthouse".to_string()),
                part: Primitive::Cylinder.into(),
                at: "atop the cliff".to_string(),
            },
            Verb::light(LightCondition::Dusk),
            Verb::sky(MaterialFamily("dusk sky".to_string())),
            Verb::wear {
                object: ObjectRef("the cliff".to_string()),
                family: MaterialFamily("weathered stone".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the lighthouse".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::frame(FrameTarget::Object(ObjectRef("the lighthouse".to_string()))),
        ],
    )
}

/// Restoring the automatic First-take Mark returns the First take.
#[test]
fn restoring_the_first_take_mark_returns_the_first_take() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(place("the shed", Primitive::Box, "beside the lighthouse"));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    assert_eq!(session.marks(), vec!["First take"]);
    assert_eq!(session.objects().len(), 2);
    assert_eq!(session.light(), Some(LightCondition::Dusk));

    session
        .submit_intent("add a shed beside it")
        .expect("the shed lands");
    assert_eq!(session.objects().len(), 3);

    session
        .restore("First take")
        .expect("the automatic First-take Mark exists");
    assert_eq!(
        session.objects().len(),
        2,
        "restoring the First take returns the First take"
    );
    assert_eq!(session.objects()[0].name, "the cliff");
    assert_eq!(session.objects()[1].name, "the lighthouse");
    assert_eq!(session.light(), Some(LightCondition::Dusk));
    assert_eq!(session.sky_family(), Some("dusk sky"));
    assert_eq!(
        session
            .view()
            .last_frame()
            .and_then(|f| f.object.as_deref()),
        Some("the lighthouse"),
        "restoring the First take Frames the work as the First take did"
    );
}

/// Restore is a Verb-sized step: Undo after restore returns to the Scene as
/// it was, so the Person can step back from a restore they did not mean.
#[test]
fn undo_after_restore_returns_to_the_scene_before_restore() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(place("the shed", Primitive::Box, "beside the lighthouse"));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    session
        .submit_intent("add a shed beside it")
        .expect("the shed lands");
    assert_eq!(session.objects().len(), 3);

    session
        .restore("First take")
        .expect("the automatic First-take Mark exists");
    assert_eq!(session.objects().len(), 2);

    session
        .undo()
        .expect("restore is a Verb-sized step on the Undo stack");
    assert_eq!(
        session.objects().len(),
        3,
        "Undo after restore returns the Scene from before the restore"
    );
    assert_eq!(session.objects()[2].name, "the shed");
}

/// Undo of a Sculpt walks Clay back: the last Verb, not a new Scene.
#[test]
fn undo_reverts_a_sculpt() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec!["Tapering the lighthouse along its up.".to_string()],
            vec![Verb::taper {
                object: ObjectRef("the lighthouse".to_string()),
                amount: Amount::More,
                along: Axis::Up,
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    let clay_before = clay_of(&session, "the lighthouse");
    assert!(clay_before.composed_only());

    session
        .submit_intent("the lighthouse is too steep")
        .expect("the Sculpt lands");
    assert_ne!(clay_of(&session, "the lighthouse"), clay_before);

    session.undo().expect("the Sculpt was a completed Verb");
    assert_eq!(
        clay_of(&session, "the lighthouse"),
        clay_before,
        "Undo of a Sculpt returns that Object's Clay as it was"
    );
}

/// Stop with no take in progress does not Stop the next Intent.
#[test]
fn stop_between_takes_does_not_stop_the_next_intent() {
    let provider = ScriptedProvider::default()
        .plan(place("the lighthouse", Primitive::Cylinder, "on the cliff"))
        .plan(place("the shed", Primitive::Box, "beside the lighthouse"));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse")
        .expect("the lighthouse lands");
    session.stop();
    session
        .submit_intent("add a shed")
        .expect("the next Intent still lands");
    assert_eq!(
        session.objects().len(),
        2,
        "Stop applies to a take in progress, not the Intent that comes after"
    );
}
