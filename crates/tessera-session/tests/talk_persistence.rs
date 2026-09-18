//! Yesterday's Scene still has the Talk (issue #14, ADR-0014, ADR-0010).
//! Close, open the file: the place is there and so is the conversation.
//! Rehearsal continues. The Key is not in the file. A new Scene starts empty.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent. They save and open through Session, never by reading the Engine.

use std::path::PathBuf;

use tessera_session::{
    Amount, Axis, FrameTarget, Intent, LightCondition, MaterialFamily, ObjectRef, Picture, Plan,
    Primitive, Provider, ProviderName, Region, ScriptedProvider, Session, Verb, View, ViewReport,
};

const KEY: &str = "sk-ant-person-key-MUST-NOT-LEAK";
const SKETCH: &[u8] = b"a sketch of a lighthouse silhouette";

fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key(KEY);
}

fn scene_path(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("tessera-scene-{}-{}", std::process::id(), name));
    std::fs::create_dir_all(&dir).expect("temp dir for a Scene file");
    dir.join("lighthouse.tessera")
}

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

fn names<P: Provider, V: View>(session: &Session<P, V>) -> Vec<&str> {
    session.objects().iter().map(|o| o.name.as_str()).collect()
}

fn talk_text<P: Provider, V: View>(session: &Session<P, V>) -> Vec<String> {
    session.talk().into_iter().map(|l| l.text).collect()
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

/// Spec stories 29–31, 34: First take and Rehearsal, save, a fresh Session
/// opens the file. Clay, Objects, names, light, sky, Marks, and Talk
/// (Intent, pictures, Narration, Steer) round-trip. "the roof" still binds.
#[test]
fn yesterday_s_scene_still_has_the_talk() {
    let path = scene_path("talk");
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec![
                "The roof is too steep — tapering it along its up.".to_string(),
                "Carving the windward cliff a little.".to_string(),
            ],
            vec![
                Verb::taper {
                    object: ObjectRef("the roof".to_string()),
                    amount: Amount::More,
                    along: Axis::Up,
                },
                Verb::carve {
                    object: ObjectRef("the cliff".to_string()),
                    amount: Amount::ALittle,
                    region: Region::Windward,
                },
            ],
        ))
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
        .plan(Plan::new(
            vec!["Placing the window in the lighthouse.".to_string()],
            vec![Verb::place {
                name: ObjectRef("the window".to_string()),
                part: Primitive::Box.into(),
                at: "in the lighthouse".to_string(),
            }],
        ));
    // First take Frames 4 times (3 places + frame). Sculpt Frames twice
    // (taper, carve). Steer after the shed of the next take (frame 7).
    let view = ViewReport::new().person_steers_after_frames(7, "not the door — the window");
    let mut session = Session::start(provider, view);
    person_pastes_key(&mut session);

    session
        .submit_intent(
            Intent::words("a weathered lighthouse on a cliff at dusk")
                .with_pictures([Picture::sketch(SKETCH.to_vec())]),
        )
        .expect("the scripted First take lands");
    session.mark("at dusk, before the extra windows");
    session
        .submit_intent("the roof is too steep, and the cliff more wind-beaten")
        .expect("the scripted Rehearsal lands");
    session
        .submit_intent("add a shed and a door")
        .expect("Steer finishes the shed, then takes the new Intent");

    session.save(&path).expect("the Scene file is kept");

    let roof_after_rehearsal = clay_of(&session, "the roof");
    let cliff_after_rehearsal = clay_of(&session, "the cliff");
    let yesterday_talk = talk_text(&session);
    let yesterday_marks = session.marks();

    let mut yesterday = Session::start(
        ScriptedProvider::default().plan(Plan::new(
            vec!["Weathering the roof a little — still the lantern roof.".to_string()],
            vec![Verb::weather {
                object: ObjectRef("the roof".to_string()),
                amount: Amount::ALittle,
            }],
        )),
        ViewReport::new(),
    );
    person_pastes_key(&mut yesterday);
    yesterday.open(&path).expect("yesterday's Scene opens");

    assert_eq!(
        names(&yesterday),
        vec![
            "the cliff",
            "the lighthouse",
            "the roof",
            "the shed",
            "the window"
        ],
        "the place must round-trip; the steered window, not the abandoned door"
    );
    assert_eq!(yesterday.light(), Some(LightCondition::Dusk));
    assert_eq!(yesterday.sky_family(), Some("dusk sky"));
    assert_eq!(
        yesterday.objects()[1].place,
        "atop the cliff",
        "relative place words round-trip with the Object"
    );
    assert_eq!(
        yesterday.objects()[2].part,
        Primitive::Cone.into(),
        "the Part the roof was composed from round-trips"
    );
    assert_eq!(
        yesterday.objects()[2].family.as_ref().map(|f| f.0.as_str()),
        Some("painted wood"),
        "the roof still wears its Material family"
    );
    assert_eq!(
        yesterday
            .view()
            .last_frame()
            .and_then(|f| f.object.as_deref()),
        Some("the window"),
        "the camera is still on the work as it was"
    );
    assert_eq!(
        clay_of(&yesterday, "the roof"),
        roof_after_rehearsal,
        "Sculpted Clay must round-trip"
    );
    assert_eq!(
        clay_of(&yesterday, "the cliff"),
        cliff_after_rehearsal,
        "the windward carve must round-trip"
    );
    assert_eq!(
        talk_text(&yesterday),
        yesterday_talk,
        "Talk (Intent, Narration, Steer) lives in the Scene file"
    );
    assert!(
        yesterday_talk
            .iter()
            .any(|l| l.contains("not the door — the window")),
        "steered words must be in the Talk: {yesterday_talk:?}"
    );
    let pictures: Vec<_> = yesterday
        .talk()
        .into_iter()
        .flat_map(|l| l.pictures)
        .collect();
    assert_eq!(pictures.len(), 1, "pictures travel with Intent in the Talk");
    assert_eq!(pictures[0].bytes(), SKETCH);
    assert_eq!(yesterday.marks(), yesterday_marks);
    assert!(
        yesterday.marks().iter().any(|m| m == "First take"),
        "the First take Mark round-trips"
    );
    assert!(
        yesterday
            .marks()
            .iter()
            .any(|m| m == "at dusk, before the extra windows"),
        "a named Mark round-trips"
    );

    let roof_before_today = clay_of(&yesterday, "the roof");
    yesterday
        .submit_intent("the roof is too steep")
        .expect("Rehearsal continues on yesterday's place; the roof still binds");
    assert_ne!(
        clay_of(&yesterday, "the roof"),
        roof_before_today,
        "after reopen, 'the roof' still names the lantern roof"
    );

    yesterday
        .restore("at dusk, before the extra windows")
        .expect("the named Mark is in the file");
    assert_eq!(
        names(&yesterday),
        vec!["the cliff", "the lighthouse", "the roof"],
        "restoring a Mark after reopen returns that take"
    );
    assert!(
        clay_of(&yesterday, "the roof").composed_only(),
        "the Mark's Clay is the First take, before the taper"
    );
}

/// Spec story 6: the Key lives in app settings, never in the Scene file.
#[test]
fn the_key_is_not_in_the_scene_file() {
    let path = scene_path("key");
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);
    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");
    session.save(&path).expect("the Scene file is kept");

    let text = std::fs::read_to_string(&path).expect("the Scene file is text we can inspect");
    assert!(
        !text.contains(KEY),
        "sending a Scene to a friend must not leak the Key"
    );
    assert!(
        !text.to_ascii_lowercase().contains("sk-ant"),
        "no Key-shaped value belongs in the Scene file: {text}"
    );
}

/// Spec story 31: a new Scene starts empty of Talk and Clay.
#[test]
fn a_new_scene_starts_empty_of_talk_and_clay() {
    let session = Session::start(ScriptedProvider::default(), ViewReport::new());
    assert!(
        session.talk().is_empty(),
        "a new Scene must start with no Talk in it"
    );
    assert!(
        session.objects().is_empty(),
        "a new Scene must start with no Clay in it"
    );
}
