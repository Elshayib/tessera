//! Windows Viewport and Orbit (issue #11, ADR-0004, ADR-0007).
//!
//! The Person watches Clay appear as Verbs land. They may Orbit; the Agent
//! does not fight an Orbit in progress, then Frames again on the next Verb.
//! The core loop works if they never Orbit.
//!
//! Tests act as the Person: headless, scripted Provider, recording View. They
//! never open a real window.

use tessera_session::{
    FrameTarget, LightCondition, LiveView, MaterialFamily, ObjectRef, Plan, Primitive, Provider,
    ProviderName, ScriptedProvider, Session, Verb, View, ViewReport,
};

fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key("test-key-the-person-pasted");
}

fn first_take_plan() -> Plan {
    Plan::new(
        vec![
            "A lighthouse on a cliff at dusk — placing the cliff first.".to_string(),
            "Raising the lighthouse atop it, out of a cylinder.".to_string(),
            "Setting the light to dusk.".to_string(),
            "Dressing the sky in dusk haze.".to_string(),
            "The rock wears weathered stone.".to_string(),
            "Painted wood and a lit lamp for the tower.".to_string(),
            "Framing the lighthouse so you can judge it.".to_string(),
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

/// Spec story 13: watch the Viewport while Verbs land, not a spinner then a result.
#[test]
fn viewport_shows_clay_updating_as_the_first_take_lands() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let updates = session.view().scene_updates();
    assert!(
        updates.len() >= 3,
        "Clay must appear as Verbs land, not once at the end; saw {} Viewport updates",
        updates.len()
    );
    assert!(
        updates
            .iter()
            .any(|names| names.iter().any(|n| n == "the cliff")
                && names.iter().all(|n| n != "the lighthouse")),
        "the cliff must show before the lighthouse is placed: {updates:?}"
    );
    let last = updates.last().expect("the Viewport showed the take");
    assert!(
        last.iter().any(|n| n == "the cliff") && last.iter().any(|n| n == "the lighthouse"),
        "the last Viewport update is the place, both Objects: {last:?}"
    );
}

/// Spec story 16: the Person may Orbit to judge the other side.
#[test]
fn person_may_orbit_to_judge_the_other_side() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let before = session.view().camera();
    session.orbit(std::f32::consts::PI, 0.0);

    let after = session.view().camera();
    assert!(
        (after.azimuth - before.azimuth - std::f32::consts::PI).abs() < 0.001,
        "Orbit turns the camera; azimuth {before:?} -> {after:?}"
    );
    assert_eq!(
        session
            .view()
            .last_frame()
            .and_then(|f| f.object.as_deref()),
        Some("the lighthouse"),
        "Orbit is optional looking, not a new Frame"
    );
}

fn frame_the_cliff() -> Plan {
    Plan::new(
        vec!["Framing the cliff so you can judge it.".to_string()],
        vec![Verb::frame(FrameTarget::Object(ObjectRef(
            "the cliff".to_string(),
        )))],
    )
}

/// Spec story 17: the Agent does not steal the camera during an Orbit.
#[test]
fn agent_does_not_fight_an_orbit_in_progress() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(frame_the_cliff());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");
    session.orbit(std::f32::consts::PI, 0.0);
    let azimuth = session.view().camera().azimuth;

    session
        .submit_intent("show me the cliff")
        .expect("the Agent still works during Orbit");

    assert!(
        (session.view().camera().azimuth - azimuth).abs() < 0.001,
        "the camera must stay where the Person turned it while they are Orbiting"
    );
    assert_eq!(
        session
            .view()
            .last_frame()
            .and_then(|f| f.object.as_deref()),
        Some("the lighthouse"),
        "a Frame during Orbit must not snatch the camera onto the cliff"
    );
}

/// Spec story 18: after Orbit ends, the next Verb Frames the work again.
#[test]
fn next_verb_after_orbit_frames_again() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(frame_the_cliff())
        .plan(frame_the_cliff());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");
    session.orbit(std::f32::consts::PI, 0.0);
    session
        .submit_intent("show me the cliff")
        .expect("fought Frame is ignored");
    session.end_orbit();
    assert!(
        (session.view().camera().azimuth - std::f32::consts::PI).abs() < 0.001,
        "ending Orbit does not Frame; the Person stays on the angle they chose until the next Verb"
    );

    session
        .submit_intent("look at the cliff")
        .expect("the next Verb Frames");

    assert_eq!(
        session
            .view()
            .last_frame()
            .and_then(|f| f.object.as_deref()),
        Some("the cliff"),
        "the next Verb after Orbit must Frame the work so they are not stuck on a bad angle"
    );
    assert!(
        session.view().camera().azimuth.abs() < 0.001,
        "Frame puts them back on the work, not the Orbit they finished"
    );
}

/// Spec story 19: the core loop works if they never Orbit.
#[test]
fn core_loop_works_if_they_never_orbit() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    assert_eq!(
        session
            .view()
            .last_frame()
            .and_then(|f| f.object.as_deref()),
        Some("the lighthouse")
    );
    assert!(
        !session.view().camera().azimuth.is_nan(),
        "the camera is on the work without the Person ever Orbiting"
    );
    assert_eq!(session.marks(), vec!["First take".to_string()]);
}

/// Spec: product tests do not open a real window; LiveView is headless state
/// the installed app paints.
#[test]
fn live_view_is_headless_and_shows_clay_as_verbs_land() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let view = LiveView::new();
    let mut session = Session::start(provider, view);
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let snap = session.view().snapshot();
    assert!(
        snap.scene
            .objects
            .iter()
            .any(|o| o.name == "the lighthouse"),
        "the live Viewport holds Clay of the place, without a window"
    );
    assert_eq!(
        snap.frame.and_then(|f| f.object),
        Some("the lighthouse".into())
    );
    assert!(
        snap.talk.iter().any(|l| l.contains("lighthouse")),
        "Narration lands on the Viewport as Verbs do, not once at the end: {:?}",
        snap.talk
    );
}
