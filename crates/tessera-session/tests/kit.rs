//! Kit parts (issue #5): the same lighthouse Intent is composed from named
//! Kit Parts in architecture, nature, and props — not a pile of cylinders.
//! Primitives still work; the Kit does not replace them.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken, no
//! Orbit or Point used.

use tessera_session::{
    FrameTarget, KitPart, LightCondition, MaterialFamily, ObjectRef, Part, Plan, Primitive,
    Provider, ProviderName, ScriptedProvider, Session, Verb, View, ViewReport,
};

fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key("test-key-the-person-pasted");
}

/// A First take made of lighthouse-shaped pieces, not twelve cylinders.
fn kit_first_take_plan() -> Plan {
    Plan::new(
        vec![
            "A cliff slab under the sky, not a box pretending to be rock.".to_string(),
            "A rock at the foot of the slab.".to_string(),
            "Ground around it so the place sits somewhere.".to_string(),
            "Raising the tower atop the slab.".to_string(),
            "The lantern room sits on the tower.".to_string(),
            "A roof cap on the lantern room.".to_string(),
            "A doorway in the tower.".to_string(),
            "A window bay on the seaward side.".to_string(),
            "Railing around the lantern room.".to_string(),
            "A lamp in the lantern room.".to_string(),
            "Setting the light to dusk.".to_string(),
            "Dressing the sky in dusk haze.".to_string(),
            "The cliff slab wears weathered stone.".to_string(),
            "The rock wears weathered stone.".to_string(),
            "The ground wears rock.".to_string(),
            "Painted wood on the tower.".to_string(),
            "Painted wood on the lantern room.".to_string(),
            "Painted wood on the roof cap.".to_string(),
            "Painted wood on the doorway.".to_string(),
            "Painted wood on the window bay.".to_string(),
            "Painted iron on the railing.".to_string(),
            "A lit lamp.".to_string(),
            "Framing the lantern room so you can judge it.".to_string(),
        ],
        vec![
            Verb::place {
                name: ObjectRef("the cliff slab".to_string()),
                part: Part::Kit(KitPart::CliffSlab),
                at: "under the sky".to_string(),
            },
            Verb::place {
                name: ObjectRef("the rock".to_string()),
                part: Part::Kit(KitPart::Rock),
                at: "at the foot of the cliff slab".to_string(),
            },
            Verb::place {
                name: ObjectRef("the ground".to_string()),
                part: Part::Kit(KitPart::Ground),
                at: "around the cliff slab".to_string(),
            },
            Verb::place {
                name: ObjectRef("the tower".to_string()),
                part: Part::Kit(KitPart::Tower),
                at: "atop the cliff slab".to_string(),
            },
            Verb::place {
                name: ObjectRef("the lantern room".to_string()),
                part: Part::Kit(KitPart::LanternRoom),
                at: "atop the tower".to_string(),
            },
            Verb::place {
                name: ObjectRef("the roof cap".to_string()),
                part: Part::Kit(KitPart::RoofCap),
                at: "atop the lantern room".to_string(),
            },
            Verb::place {
                name: ObjectRef("the doorway".to_string()),
                part: Part::Kit(KitPart::Doorway),
                at: "in the tower".to_string(),
            },
            Verb::place {
                name: ObjectRef("the window bay".to_string()),
                part: Part::Kit(KitPart::WindowBay),
                at: "in the tower".to_string(),
            },
            Verb::place {
                name: ObjectRef("the railing".to_string()),
                part: Part::Kit(KitPart::Railing),
                at: "around the lantern room".to_string(),
            },
            Verb::place {
                name: ObjectRef("the lamp".to_string()),
                part: Part::Kit(KitPart::Lamp),
                at: "in the lantern room".to_string(),
            },
            Verb::light(LightCondition::Dusk),
            Verb::sky(MaterialFamily("dusk sky".to_string())),
            Verb::wear {
                object: ObjectRef("the cliff slab".to_string()),
                family: MaterialFamily("weathered stone".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the rock".to_string()),
                family: MaterialFamily("weathered stone".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the ground".to_string()),
                family: MaterialFamily("rock".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the tower".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the lantern room".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the roof cap".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the doorway".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the window bay".to_string()),
                family: MaterialFamily("painted wood".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the railing".to_string()),
                family: MaterialFamily("painted iron".to_string()),
            },
            Verb::wear {
                object: ObjectRef("the lamp".to_string()),
                family: MaterialFamily("lit glass".to_string()),
            },
            Verb::frame(FrameTarget::Object(ObjectRef(
                "the lantern room".to_string(),
            ))),
        ],
    )
}

/// Tracer: "a weathered lighthouse on a cliff at dusk" composed from the Kit.
#[test]
fn lighthouse_first_take_is_composed_from_kit_parts() {
    let provider = ScriptedProvider::default().plan(kit_first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted Kit First take lands");

    let objects = session.objects();
    let names: Vec<&str> = objects.iter().map(|o| o.name.as_str()).collect();
    assert_eq!(
        names,
        [
            "the cliff slab",
            "the rock",
            "the ground",
            "the tower",
            "the lantern room",
            "the roof cap",
            "the doorway",
            "the window bay",
            "the railing",
            "the lamp",
        ],
        "named Objects come from the Kit, not a pile of cylinders"
    );

    let parts: Vec<Part> = objects.iter().map(|o| o.part).collect();
    assert_eq!(
        parts,
        [
            Part::Kit(KitPart::CliffSlab),
            Part::Kit(KitPart::Rock),
            Part::Kit(KitPart::Ground),
            Part::Kit(KitPart::Tower),
            Part::Kit(KitPart::LanternRoom),
            Part::Kit(KitPart::RoofCap),
            Part::Kit(KitPart::Doorway),
            Part::Kit(KitPart::WindowBay),
            Part::Kit(KitPart::Railing),
            Part::Kit(KitPart::Lamp),
        ]
    );
    assert!(
        parts.iter().all(|p| matches!(p, Part::Kit(_))),
        "this First take must not fall back to Primitives"
    );

    assert_eq!(session.light(), Some(LightCondition::Dusk));
    assert_eq!(session.sky_family(), Some("dusk sky"));
    assert_eq!(session.marks(), vec!["First take"]);
    let last_frame = session
        .view()
        .last_frame()
        .expect("the First take ends framed on the work");
    assert_eq!(last_frame.object.as_deref(), Some("the lantern room"));
}

/// Primitives still work; the Kit does not replace them (spec story 44).
#[test]
fn primitives_still_work_the_kit_does_not_replace_them() {
    let provider = ScriptedProvider::default().plan(ScriptedProvider::place_and_frame(
        "the buoy",
        Primitive::Sphere,
        "beside the cliff",
    ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a buoy beside the cliff")
        .expect("a Primitive place still lands");

    let objects = session.objects();
    assert_eq!(objects.len(), 1);
    assert_eq!(objects[0].name, "the buoy");
    assert_eq!(objects[0].part, Part::Primitive(Primitive::Sphere));
}
