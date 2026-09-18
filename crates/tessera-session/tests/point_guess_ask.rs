//! Point, Guess, and Ask (issue #8): words still work alone; optional Point
//! means "this"; the Agent Asks only when the next Verb would be hard to Undo.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent. Point stands in for a click on a named Object.

use tessera_session::{
    Amount, Axis, FrameTarget, LightCondition, MaterialFamily, ObjectRef, Plan, Primitive,
    Provider, ProviderName, Region, ScriptedProvider, Session, Verb, View, ViewReport,
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

/// One named roof, already a First take, so later Talk can say "the roof."
fn scene_with_one_roof() -> Plan {
    Plan::new(
        vec![
            "Placing the cliff.".to_string(),
            "Raising the lighthouse.".to_string(),
            "Capping it with a roof.".to_string(),
            "Setting the light to dusk.".to_string(),
            "Dressing the sky in dusk haze.".to_string(),
            "Weathered stone for the cliff.".to_string(),
            "Painted wood for the lighthouse.".to_string(),
            "Painted wood for the roof.".to_string(),
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
        ],
    )
}

/// With one matching Object, "the roof" Guesses, Narration names the guess,
/// and work continues — no Ask (ADR-0017).
#[test]
fn the_roof_guesses_the_one_match_and_keeps_moving() {
    let provider = ScriptedProvider::default()
        .plan(scene_with_one_roof())
        .plan(Plan::new(
            vec![
                "Guessing you mean the roof — tapering it along its up.".to_string(),
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
        .expect("the First take lands");
    let roof_before = clay_of(&session, "the roof");

    let said = session
        .submit_intent("the roof is too steep")
        .expect("the Guess must land, not freeze the Viewport");

    assert!(
        session.ask().is_none(),
        "one matching Object is a Guess, not an Ask"
    );
    let joined = said.join(" ");
    assert!(
        joined.contains("Guessing") && joined.contains("the roof"),
        "Narration must name the guess: {joined:?}"
    );
    assert_ne!(
        clay_of(&session, "the roof"),
        roof_before,
        "work continues: the roof's silhouette changes"
    );
}

/// The Person Points at a named Object (standing in for a click). Later
/// "this" binds to it. Words still named the Object in Narration first
/// (ADR-0013); Point is optional, never required.
#[test]
fn pointing_binds_this_on_the_next_intent() {
    let provider = ScriptedProvider::default()
        .plan(scene_with_one_roof())
        .plan(Plan::new(
            vec![
                "Carving the windward side of this — the roof.".to_string(),
                "Framing the roof so you can judge it.".to_string(),
            ],
            vec![
                Verb::carve {
                    object: ObjectRef("this".to_string()),
                    amount: Amount::ALittle,
                    region: Region::Windward,
                },
                Verb::frame(FrameTarget::Object(ObjectRef("this".to_string()))),
            ],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    let roof_before = clay_of(&session, "the roof");
    let cliff_before = clay_of(&session, "the cliff");

    session
        .point("the roof")
        .expect("the roof is in the Scene to Point at");

    session
        .submit_intent("cut into this")
        .expect("this binds to the Pointed Object");

    assert_ne!(
        clay_of(&session, "the roof"),
        roof_before,
        "this must bind to the Pointed roof"
    );
    assert_eq!(
        clay_of(&session, "the cliff"),
        cliff_before,
        "Point binds this, not a different Object"
    );
    let last_frame = session.view().last_frame().expect("Sculpt Frames the work");
    assert_eq!(
        last_frame.object.as_deref(),
        Some("the roof"),
        "Framing this must land on the Pointed Object"
    );
}

/// Two roofs, no Point: the Agent Asks. The Viewport waits. No Verb lands
/// until the Person answers (ADR-0017).
#[test]
fn two_roofs_without_point_asks_and_waits() {
    let two_roofs = Plan::new(
        vec![
            "Placing the lantern roof.".to_string(),
            "Placing the shed roof.".to_string(),
            "Setting the light to dusk.".to_string(),
            "Dressing the sky.".to_string(),
            "Painted wood for the lantern roof.".to_string(),
            "Painted wood for the shed roof.".to_string(),
        ],
        vec![
            Verb::place {
                name: ObjectRef("the lantern roof".to_string()),
                part: Primitive::Cone.into(),
                at: "atop the lighthouse".to_string(),
            },
            Verb::place {
                name: ObjectRef("the shed roof".to_string()),
                part: Primitive::Cone.into(),
                at: "on the shed".to_string(),
            },
            Verb::light(LightCondition::Dusk),
            Verb::sky(MaterialFamily("dusk sky".to_string())),
            Verb::wear {
                object: ObjectRef("the lantern roof".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the shed roof".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
        ],
    );
    let provider = ScriptedProvider::default()
        .plan(two_roofs)
        .ask("Which roof — the lantern roof or the shed roof?")
        .plan(Plan::new(
            vec!["Guessing you mean the lantern roof — tapering it.".to_string()],
            vec![Verb::taper {
                object: ObjectRef("the lantern roof".to_string()),
                amount: Amount::More,
                along: Axis::Up,
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a lighthouse and a shed")
        .expect("both roofs land");
    let lantern_before = clay_of(&session, "the lantern roof");
    let shed_before = clay_of(&session, "the shed roof");
    let frame_before = session.view().last_frame().cloned();

    let said = session
        .submit_intent("the roof is too steep")
        .expect("an Ask is not an error");

    assert_eq!(
        session.ask(),
        Some("Which roof — the lantern roof or the shed roof?"),
        "two possible roofs and no Point is an Ask"
    );
    assert!(
        said.iter()
            .any(|line| line.contains("lantern roof") && line.contains("shed roof")),
        "the Ask is spoken: {said:?}"
    );
    assert_eq!(
        clay_of(&session, "the lantern roof"),
        lantern_before,
        "no Verb lands while the Viewport waits"
    );
    assert_eq!(clay_of(&session, "the shed roof"), shed_before);
    assert_eq!(
        session.view().last_frame().cloned(),
        frame_before,
        "the Viewport waits on the last Frame"
    );

    let said = session
        .submit_intent("the lantern roof")
        .expect("the Person's answer lets work continue");

    assert!(
        session.ask().is_none(),
        "answering the Ask resumes the loop"
    );
    assert_ne!(
        clay_of(&session, "the lantern roof"),
        lantern_before,
        "the answer lands on the named roof"
    );
    assert_eq!(
        clay_of(&session, "the shed roof"),
        shed_before,
        "the other roof is left alone"
    );
    let joined = said.join(" ");
    assert!(
        joined.contains("the lantern roof"),
        "Narration names the guess after the answer: {joined:?}"
    );
}

/// `remove` without Point is hard to Undo: the Agent Asks, nothing is deleted.
#[test]
fn remove_without_point_asks() {
    let provider = ScriptedProvider::default()
        .plan(scene_with_one_roof())
        .plan(Plan::new(
            vec!["Removing the roof.".to_string()],
            vec![Verb::remove {
                object: ObjectRef("the roof".to_string()),
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    let names_before: Vec<String> = session.objects().iter().map(|o| o.name.clone()).collect();

    let said = session
        .submit_intent("get rid of the roof")
        .expect("an Ask is not an error");

    assert!(
        session.ask().is_some(),
        "remove without Point must Ask, not Guess"
    );
    assert!(
        said.iter()
            .any(|line| line.to_lowercase().contains("remove")
                || line.to_lowercase().contains("point")),
        "the Ask must say why the Viewport is waiting: {said:?}"
    );
    let names_after: Vec<String> = session.objects().iter().map(|o| o.name.clone()).collect();
    assert_eq!(
        names_after, names_before,
        "no Object is removed while the Ask is pending"
    );
    assert!(
        session.objects().iter().any(|o| o.name == "the roof"),
        "the roof is still there"
    );
}

/// After Ask, words still work: naming the Object confirms remove. They never
/// have to click (ADR-0013).
#[test]
fn remove_confirmed_in_words_after_ask() {
    let provider = ScriptedProvider::default()
        .plan(scene_with_one_roof())
        .plan(Plan::new(
            vec!["Removing the roof.".to_string()],
            vec![Verb::remove {
                object: ObjectRef("the roof".to_string()),
            }],
        ))
        .plan(Plan::new(
            vec!["Removing the roof.".to_string()],
            vec![Verb::remove {
                object: ObjectRef("the roof".to_string()),
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    session
        .submit_intent("get rid of the roof")
        .expect("first remove Asks");
    assert!(session.ask().is_some());

    session
        .submit_intent("the roof")
        .expect("naming it answers the Ask");

    assert!(session.ask().is_none(), "the answer lets remove land");
    assert!(
        session.objects().iter().all(|o| o.name != "the roof"),
        "the named roof is gone without a click"
    );
}

/// "this" with no Point is an Ask, not a missing Object.
#[test]
fn this_without_point_asks() {
    let provider = ScriptedProvider::default()
        .plan(scene_with_one_roof())
        .plan(Plan::new(
            vec!["Carving the windward side of this.".to_string()],
            vec![Verb::carve {
                object: ObjectRef("this".to_string()),
                amount: Amount::ALittle,
                region: Region::Windward,
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    let roof_before = clay_of(&session, "the roof");

    let said = session
        .submit_intent("cut into this")
        .expect("unbound this is an Ask, not an error");

    assert_eq!(
        session.ask(),
        Some("Which Object do you mean? Point at it, or name it.")
    );
    assert!(
        said.iter()
            .any(|line| line.contains("Point") || line.contains("name"))
    );
    assert_eq!(
        clay_of(&session, "the roof"),
        roof_before,
        "no Verb lands on unbound this"
    );
}

/// `remove` with that Object Pointed acts: the Object is gone.
#[test]
fn remove_with_point_acts() {
    let provider = ScriptedProvider::default()
        .plan(scene_with_one_roof())
        .plan(Plan::new(
            vec!["Removing the roof.".to_string()],
            vec![Verb::remove {
                object: ObjectRef("this".to_string()),
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    session
        .point("the roof")
        .expect("the roof is in the Scene to Point at");

    session
        .submit_intent("get rid of this")
        .expect("remove with Point acts");

    assert!(session.ask().is_none(), "Pointed remove is not an Ask");
    assert!(
        session.objects().iter().all(|o| o.name != "the roof"),
        "the Pointed roof is gone"
    );
    assert!(
        session.objects().iter().any(|o| o.name == "the lighthouse"),
        "the rest of the Scene stays"
    );
}

/// Ask is the exception, not the default: a named Sculpt with no Point still
/// Guesses and works. The core loop never required a click (ADR-0013).
#[test]
fn named_sculpt_without_point_does_not_ask() {
    let provider = ScriptedProvider::default()
        .plan(scene_with_one_roof())
        .plan(Plan::new(
            vec!["Weathering the cliff more.".to_string()],
            vec![Verb::weather {
                object: ObjectRef("the cliff".to_string()),
                amount: Amount::More,
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the First take lands");
    // Deliberately no Point.
    session
        .submit_intent("more weathered")
        .expect("words still work alone");

    assert!(
        session.ask().is_none(),
        "Ask is the exception; a named Sculpt Guesses"
    );
    assert!(
        !clay_of(&session, "the cliff").composed_only(),
        "work continued without a click"
    );
}
