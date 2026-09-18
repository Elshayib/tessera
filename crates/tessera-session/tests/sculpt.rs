//! Rehearsal and Sculpt (issue #6): after the First take, the Person talks at
//! the same Scene — "the roof is too steep," "more weathered." Sculpt Verbs
//! change silhouettes. Weathering is Rehearsal, not a requirement of the First
//! take.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent, no Orbit or Point used.

use tessera_session::{
    Amount, Axis, Clay, FrameTarget, LightCondition, MaterialFamily, ObjectRef, Plan, Primitive,
    Provider, ProviderName, Region, ScriptedProvider, Session, Verb, View, ViewReport,
};

fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key("test-key-the-person-pasted");
}

/// A First take that names a roof, so later Talk can say "too steep."
fn first_take_plan() -> Plan {
    Plan::new(
        vec![
            "A lighthouse on a cliff at dusk — placing the cliff first.".to_string(),
            "Raising the lighthouse atop it, out of a cylinder.".to_string(),
            "Capping it with a roof.".to_string(),
            "Setting the light to dusk.".to_string(),
            "Dressing the sky in dusk haze.".to_string(),
            "The rock wears weathered stone.".to_string(),
            "Painted wood for the tower.".to_string(),
            "Painted wood for the roof.".to_string(),
            "Framing the roof so you can judge it.".to_string(),
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
            Verb::place {
                name: ObjectRef("the roof".to_string()),
                part: Primitive::Cone.into(),
                at: "atop the lighthouse".to_string(),
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
            Verb::wear {
                object: ObjectRef("the roof".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::frame(FrameTarget::Object(ObjectRef("the roof".to_string()))),
        ],
    )
}

fn clay_of<P: Provider, V: View>(session: &Session<P, V>, name: &str) -> Clay {
    session
        .objects()
        .iter()
        .find(|o| o.name == name)
        .unwrap_or_else(|| panic!("the Scene should still have {name}"))
        .clay
        .clone()
}

/// Tracer: "the roof is too steep" is Rehearsal on the same Scene. The roof
/// stays; its silhouette changes.
#[test]
fn too_steep_changes_the_named_objects_silhouette() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec![
                "The roof is too steep — tapering it along its up.".to_string(),
                "Framing the roof so you can judge it.".to_string(),
            ],
            vec![
                Verb::taper {
                    object: ObjectRef("the roof".to_string()),
                    amount: Amount::More,
                    along: Axis::Up,
                },
                Verb::frame(FrameTarget::Object(ObjectRef("the roof".to_string()))),
            ],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let names_before: Vec<String> = session.objects().iter().map(|o| o.name.clone()).collect();
    let roof_before = clay_of(&session, "the roof");
    let cliff_before = clay_of(&session, "the cliff");
    assert!(
        roof_before.composed_only(),
        "the First take is composed, not sculpted"
    );

    session
        .submit_intent("the roof is too steep")
        .expect("the scripted Rehearsal lands");

    let names_after: Vec<String> = session.objects().iter().map(|o| o.name.clone()).collect();
    assert_eq!(
        names_after, names_before,
        "Rehearsal is the same Scene; Objects persist"
    );
    let roof_after = clay_of(&session, "the roof");
    assert_ne!(
        roof_after, roof_before,
        "too steep must change the roof's silhouette"
    );
    assert!(!roof_after.composed_only(), "the roof has been Sculpted");
    assert_eq!(
        clay_of(&session, "the cliff"),
        cliff_before,
        "Sculpt of the roof must not replace the rest of the Scene"
    );

    let last_frame = session.view().last_frame().expect("Sculpt Frames the work");
    assert_eq!(
        last_frame.object.as_deref(),
        Some("the roof"),
        "the camera should be on the Object that just changed"
    );
}

/// Weathering is Rehearsal: "more weathered" works the named Object after the
/// First take, which itself is composed, not weathered.
#[test]
fn more_weathered_is_rehearsal_not_the_first_take() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec![
                "Weathering the cliff more, as if by wind.".to_string(),
                "Framing the cliff so you can judge it.".to_string(),
            ],
            vec![
                Verb::weather {
                    object: ObjectRef("the cliff".to_string()),
                    amount: Amount::More,
                },
                Verb::frame(FrameTarget::Object(ObjectRef("the cliff".to_string()))),
            ],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    assert!(
        session.objects().iter().all(|o| o.clay.composed_only()),
        "weathering is not required of the First take"
    );
    let cliff_before = clay_of(&session, "the cliff");
    let roof_before = clay_of(&session, "the roof");

    session
        .submit_intent("more weathered")
        .expect("the scripted Rehearsal lands");

    assert_eq!(session.objects().len(), 3, "the Scene is not replaced");
    assert_ne!(
        clay_of(&session, "the cliff"),
        cliff_before,
        "more weathered must change the cliff's silhouette"
    );
    assert_eq!(
        clay_of(&session, "the roof"),
        roof_before,
        "weathering the cliff leaves the roof as it was"
    );
}

/// Carve and inflate are Object-level Sculpts: they work a named silhouette
/// (a side, a coarse amount), never a brush stroke.
#[test]
fn carve_and_inflate_change_named_silhouettes() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec![
                "Carving the windward side of the cliff a little.".to_string(),
                "Inflating the lighthouse at the base, a lot.".to_string(),
                "Framing the lighthouse so you can judge it.".to_string(),
            ],
            vec![
                Verb::carve {
                    object: ObjectRef("the cliff".to_string()),
                    amount: Amount::ALittle,
                    region: Region::Windward,
                },
                Verb::inflate {
                    object: ObjectRef("the lighthouse".to_string()),
                    amount: Amount::ALot,
                    region: Region::Base,
                },
                Verb::frame(FrameTarget::Object(ObjectRef("the lighthouse".to_string()))),
            ],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let cliff_before = clay_of(&session, "the cliff");
    let lighthouse_before = clay_of(&session, "the lighthouse");
    let roof_before = clay_of(&session, "the roof");

    session
        .submit_intent("cut into the windward cliff and fatten the tower base")
        .expect("the scripted Rehearsal lands");

    assert_eq!(session.objects().len(), 3);
    assert_ne!(clay_of(&session, "the cliff"), cliff_before);
    assert_ne!(clay_of(&session, "the lighthouse"), lighthouse_before);
    assert_eq!(
        clay_of(&session, "the roof"),
        roof_before,
        "carve and inflate of other Objects leave the roof"
    );
}

/// Narration says what changed, using the Object's name, so the Person can
/// follow Rehearsal in the chat (spec story 14).
#[test]
fn rehearsal_narration_says_what_changed() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec![
                "The roof is too steep — tapering it along its up.".to_string(),
                "Framing the roof so you can judge it.".to_string(),
            ],
            vec![
                Verb::taper {
                    object: ObjectRef("the roof".to_string()),
                    amount: Amount::More,
                    along: Axis::Up,
                },
                Verb::frame(FrameTarget::Object(ObjectRef("the roof".to_string()))),
            ],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");
    let said = session
        .submit_intent("the roof is too steep")
        .expect("the scripted Rehearsal lands");

    let joined = said.join(" ");
    assert!(
        joined.contains("the roof"),
        "Narration must name the Object that changed: {joined:?}"
    );
    assert!(
        joined.contains("too steep") || joined.contains("tapering"),
        "Narration must say what changed: {joined:?}"
    );
}

/// Restoring the First take walks Clay back too: a Sculpted roof is not a new Scene.
#[test]
fn restoring_the_first_take_returns_unsculpted_clay() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec!["Tapering the roof.".to_string()],
            vec![Verb::taper {
                object: ObjectRef("the roof".to_string()),
                amount: Amount::More,
                along: Axis::Up,
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");
    session
        .submit_intent("the roof is too steep")
        .expect("the scripted Rehearsal lands");
    assert!(!clay_of(&session, "the roof").composed_only());

    session
        .restore("First take")
        .expect("the automatic First-take Mark exists");
    assert!(
        clay_of(&session, "the roof").composed_only(),
        "the First take's silhouette comes back with the Mark"
    );
}
