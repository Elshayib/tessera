//! Join and cut (issue #12): Compose can union and subtract whole named
//! Objects — a tower cut by an arch — with no vertices in the Agent's mouth.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent, no Orbit or Point used.

use tessera_session::{
    KitPart, ObjectRef, Part, Plan, Provider, ProviderName, ScriptedProvider, Session, Verb, View,
    ViewReport,
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

fn place(name: &str, part: Part, at: &str) -> Plan {
    Plan::new(
        vec![format!("Placing {name} {at}.")],
        vec![Verb::place {
            name: ObjectRef(name.to_string()),
            part,
            at: at.to_string(),
        }],
    )
}

/// Tracer: two placed Parts become one named Object, the union of both.
#[test]
fn join_unions_two_placed_parts_into_one_named_object() {
    let provider = ScriptedProvider::default()
        .plan(place(
            "the tower",
            Part::Kit(KitPart::Tower),
            "on the cliff",
        ))
        .plan(place(
            "the lantern room",
            Part::Kit(KitPart::LanternRoom),
            "atop the tower",
        ))
        .plan(Plan::new(
            vec!["Joining the lantern room onto the tower.".to_string()],
            vec![Verb::join {
                object: ObjectRef("the tower".to_string()),
                with: ObjectRef("the lantern room".to_string()),
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a tower on the cliff")
        .expect("the tower lands");
    session
        .submit_intent("a lantern room on top")
        .expect("the lantern room lands");
    assert_eq!(
        session.objects().len(),
        2,
        "two Parts placed, not yet joined"
    );
    let tower_before = clay_of(&session, "the tower");
    assert!(
        tower_before.composed_only(),
        "placed Clay is composed, not sculpted"
    );

    session
        .submit_intent("join them into one lighthouse")
        .expect("the scripted join lands");

    let objects = session.objects();
    assert_eq!(
        objects.len(),
        1,
        "join unions two named Objects into one named Object"
    );
    assert_eq!(objects[0].name, "the tower");
    assert!(
        objects.iter().all(|o| o.name != "the lantern room"),
        "the joined-in Object is no longer a separate thing"
    );
    let tower = clay_of(&session, "the tower");
    assert!(
        tower.joined(),
        "the remaining Object is the union of the two placed Parts"
    );
    assert!(
        tower.composed_only(),
        "join is Compose, not a Sculpt of the silhouette"
    );
    assert_ne!(
        tower, tower_before,
        "the union is not the tower as it was placed"
    );
    let last_frame = session.view().last_frame().expect("join Frames the work");
    assert_eq!(
        last_frame.object.as_deref(),
        Some("the tower"),
        "the camera should be on the Object that just changed"
    );
}

/// Tracer: a tower cut by an arch. The tower remains; the arch is subtracted.
#[test]
fn cut_subtracts_one_named_object_from_another() {
    let provider = ScriptedProvider::default()
        .plan(place(
            "the tower",
            Part::Kit(KitPart::Tower),
            "on the cliff",
        ))
        .plan(place(
            "the arch",
            Part::Kit(KitPart::Doorway),
            "in the tower",
        ))
        .plan(Plan::new(
            vec!["Cutting an arch through the tower.".to_string()],
            vec![Verb::cut {
                object: ObjectRef("the tower".to_string()),
                with: ObjectRef("the arch".to_string()),
            }],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a tower on the cliff")
        .expect("the tower lands");
    session
        .submit_intent("an arch through it")
        .expect("the arch lands");
    assert_eq!(session.objects().len(), 2);
    let tower_before = clay_of(&session, "the tower");

    session
        .submit_intent("cut an arch through the tower")
        .expect("the scripted cut lands");

    let objects = session.objects();
    assert_eq!(
        objects.len(),
        1,
        "the cutter is consumed; the tower remains"
    );
    assert_eq!(objects[0].name, "the tower");
    let tower = clay_of(&session, "the tower");
    assert!(
        tower.cut_from(),
        "the remaining Object has had the other subtracted from it"
    );
    assert!(
        tower.composed_only(),
        "cut is Compose, not a Sculpt of the silhouette"
    );
    assert_ne!(
        tower, tower_before,
        "a tower cut by an arch is not the tower as placed"
    );
    let last_frame = session.view().last_frame().expect("cut Frames the work");
    assert_eq!(
        last_frame.object.as_deref(),
        Some("the tower"),
        "the camera should be on the Object that just changed"
    );
}
