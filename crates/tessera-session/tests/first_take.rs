//! The First take (issue #3): a Person types "a weathered lighthouse on a cliff
//! at dusk" and gets a readable place — lighthouse-shape on cliff-shape — with
//! light that matches the Intent, Material families already on the Objects and
//! sky, names in Narration, and an automatic First-take Mark. Composed from
//! Primitives only. Weathering and taste are Rehearsal (#6), not required here.
//!
//! As always, the tests act as the Person: headless, scripted Provider, no
//! Verbs spoken, no Orbit or Point used.

use tessera_session::{
    FrameTarget, LightCondition, MaterialFamily, ObjectRef, Plan, Primitive, Provider,
    ProviderName, ScriptedProvider, Session, Verb, View, ViewReport,
};

/// The Person pastes a Key and picks a Provider before the first Intent:
/// since #4 the Agent needs both to think at all.
fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key("test-key-the-person-pasted");
}

/// The scripted Provider's answer to the tracer Intent: the plan a real
/// Provider's first response should have. Compose from Primitives, light the
/// Scene, wear Material families, and Frame the work.
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
                part: Primitive::Box,
                at: "under the sky".to_string(),
            },
            Verb::place {
                name: ObjectRef("the lighthouse".to_string()),
                part: Primitive::Cylinder,
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

/// The tracer: the First take of "a weathered lighthouse on a cliff at dusk".
#[test]
fn first_take_is_a_readable_place_lit_like_dusk() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    // A readable place: named Objects, not a blob (spec story 11).
    let objects = session.objects();
    assert_eq!(objects.len(), 2, "lighthouse-shape on cliff-shape");
    assert_eq!(objects[0].name, "the cliff");
    assert_eq!(objects[1].name, "the lighthouse");

    // Light matches dusk (spec story 41).
    assert_eq!(session.light(), Some(LightCondition::Dusk));

    // Sky and Objects already wear Material families (spec story 42).
    assert_eq!(
        session.sky_family(),
        Some("dusk sky"),
        "the sky wears a named look on the First take"
    );
    assert_eq!(
        session.objects()[0].family.as_ref().map(|f| f.0.as_str()),
        Some("weathered stone"),
        "the cliff already wears a Material family"
    );
    assert_eq!(
        session.objects()[1].family.as_ref().map(|f| f.0.as_str()),
        Some("painted wood"),
        "the tower already wears a Material family"
    );

    // The Agent Frames the work: the camera is on what just changed.
    let last_frame = session
        .view()
        .last_frame()
        .expect("the First take ends framed on the work");
    assert_eq!(
        last_frame.object.as_deref(),
        Some("the lighthouse"),
        "the camera should be on the lighthouse"
    );
}

/// Narration names the Objects so later Talk can say "the roof" (spec story 21).
#[test]
fn first_take_narration_names_the_objects() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    let said = session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let joined = said.join(" ");
    for name in ["the cliff", "the lighthouse"] {
        assert!(
            joined.contains(name),
            "Narration must name {name} so Talk can bind it: {joined:?}"
        );
    }
}

/// The First take is automatically a Mark (spec story 12), and the Person can
/// restore it after later work muddies the Scene.
#[test]
fn first_take_is_automatically_a_mark_and_restorable() {
    let provider = ScriptedProvider::default().plan(first_take_plan()).plan(
        ScriptedProvider::place_and_frame("the shed", Primitive::Box, "beside the lighthouse"),
    );
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    // The Person never names this Mark; the Agent did.
    assert_eq!(session.marks(), vec!["First take"]);
    // Rehearsal adds something they end up hating.
    session
        .submit_intent("add a shed beside it")
        .expect("the shed plan lands");
    assert_eq!(session.objects().len(), 3);

    // Restore walks the Scene back to the First take.
    session
        .restore("First take")
        .expect("the automatic First-take Mark exists");
    assert_eq!(
        session.objects().len(),
        2,
        "restoring the First take returns the First take"
    );
    assert_eq!(session.light(), Some(LightCondition::Dusk));
    assert_eq!(
        session.objects()[1].family.as_ref().map(|f| f.0.as_str()),
        Some("painted wood"),
        "Material families come back with the Mark"
    );
}

/// "Compose uses only Primitives" holds by construction: the Verb's `part` is a
/// `Primitive`, so no plan can even name a Kit Part. What must still work is a
/// plan that aims `wear` at an Object the Scene does not have — the take stops
/// with an error the Person can act on, and the Scene keeps what landed.
#[test]
fn a_plan_that_names_a_missing_object_stops_the_take() {
    let plan = Plan::new(
        vec![
            "Placing the tower.".to_string(),
            "Dressing the tower.".to_string(),
        ],
        vec![
            Verb::place {
                name: ObjectRef("the tower".to_string()),
                part: Primitive::Cylinder,
                at: "on the cliff".to_string(),
            },
            Verb::wear {
                object: ObjectRef("the shed".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
        ],
    );
    let provider = ScriptedProvider::default().plan(plan);
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    let err = session
        .submit_intent("build a tower and dress it")
        .expect_err("wear aimed at an unknown Object must stop the take");

    assert_eq!(
        err,
        tessera_session::SessionError::UnknownObject("the shed".to_string()),
        "the error names the Object the plan could not find"
    );
    // The Scene keeps every Verb that landed before the error.
    assert_eq!(session.objects().len(), 1);
    assert_eq!(session.objects()[0].name, "the tower");
    // The take never reached the First-take bar, so no Mark was recorded.
    assert!(session.marks().is_empty());
}

/// The Person did not Orbit and did not Point; the loop works anyway.
#[test]
fn first_take_survives_without_orbit_or_point() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    // No Orbit, no Point in this file at all — the assertions above are the
    // whole loop. If it ran, the core loop held with no 3D skill.
    assert!(!session.objects().is_empty());
}
