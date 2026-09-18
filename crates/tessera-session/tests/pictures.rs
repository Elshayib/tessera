//! Pictures as Intent (issue #9, ADR-0011). The Person may drop one or more
//! pictures with their words. Pictures condition the Agent. They are never a
//! back door into an image-to-3D generator. The Agent still Composes and Sculpts.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent.

use tessera_session::{
    Amount, Axis, Clay, FrameTarget, Intent, LightCondition, MaterialFamily, ObjectRef, Picture,
    PictureKind, Plan, Primitive, Provider, ProviderName, Region, ScriptedProvider, Session, Verb,
    View, ViewReport,
};

fn person_pastes_key<P: Provider, V: View>(session: &mut Session<P, V>) {
    session.set_provider(ProviderName::Anthropic);
    session.set_key("test-key-the-person-pasted");
}

/// Stand-in bytes. Tests never decode pixels; they assert the picture travels.
const SKETCH: &[u8] = b"a sketch of a lighthouse silhouette";
const PHOTO: &[u8] = b"a photo of dusk light";

/// Spec story 8: drop pictures with words. Spec story 9 / testing decisions:
/// the scripted Provider is given those pictures with the words.
#[test]
fn person_drops_pictures_with_words_and_the_provider_receives_them() {
    let provider = ScriptedProvider::default().plan(ScriptedProvider::place_and_frame(
        "the lighthouse",
        Primitive::Cylinder,
        "on the cliff",
    ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent(
            Intent::words("a weathered lighthouse on a cliff at dusk").with_pictures([
                Picture::sketch(SKETCH.to_vec()),
                Picture::photo(PHOTO.to_vec()),
            ]),
        )
        .expect("the scripted plan lands");

    let received = session.provider().received();
    assert_eq!(
        received.len(),
        1,
        "one Intent should have reached the Provider"
    );
    assert_eq!(
        received[0].words, "a weathered lighthouse on a cliff at dusk",
        "the Provider must get the words, not pictures in place of them"
    );
    let pictures = received[0].pictures();
    assert_eq!(
        pictures.len(),
        2,
        "every dropped picture travels with Intent"
    );
    assert_eq!(pictures[0].kind(), PictureKind::Sketch);
    assert_eq!(pictures[0].bytes(), SKETCH);
    assert_eq!(pictures[1].kind(), PictureKind::Photo);
    assert_eq!(pictures[1].bytes(), PHOTO);
}

/// Pictures persist with the Talk (ADR-0014). In-session and on Mark restore
/// they belong to that state; the Scene file round-trip is issue #14.
#[test]
fn pictures_stay_in_the_talk() {
    let provider = ScriptedProvider::default()
        .plan(ScriptedProvider::place_and_frame(
            "the lighthouse",
            Primitive::Cylinder,
            "on the cliff",
        ))
        .plan(ScriptedProvider::place_and_frame(
            "the shed",
            Primitive::Box,
            "beside the lighthouse",
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent(
            Intent::words("a weathered lighthouse on a cliff at dusk")
                .with_pictures([Picture::sketch(SKETCH.to_vec())]),
        )
        .expect("the scripted plan lands");
    session.mark("at dusk, before the extra windows");

    session
        .submit_intent(
            Intent::words("add a shed beside it").with_pictures([Picture::photo(PHOTO.to_vec())]),
        )
        .expect("the shed plan lands");

    let pictures: Vec<Picture> = session
        .talk()
        .into_iter()
        .flat_map(|line| line.pictures)
        .collect();
    assert_eq!(
        pictures.len(),
        2,
        "both pictures stay with the Talk in-session"
    );
    assert_eq!(pictures[0].bytes(), SKETCH);
    assert_eq!(pictures[1].bytes(), PHOTO);

    session
        .restore("at dusk, before the extra windows")
        .expect("the named Mark exists");
    let pictures: Vec<Picture> = session
        .talk()
        .into_iter()
        .flat_map(|line| line.pictures)
        .collect();
    assert_eq!(
        pictures.len(),
        1,
        "restoring a Mark returns the Talk — and its pictures — at that state"
    );
    assert_eq!(pictures[0].bytes(), SKETCH);
    assert_eq!(pictures[0].kind(), PictureKind::Sketch);
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

/// A picture is Intent, not a scan to copy (ADR-0011). The Agent still
/// Composes named Objects and Sculpts silhouettes; no generator is invoked.
#[test]
fn pictures_are_intent_the_agent_still_composes_and_sculpts() {
    let provider = ScriptedProvider::default()
        .plan(Plan::new(
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
        ))
        .plan(Plan::new(
            vec![
                "The roof is too steep — tapering it along its up.".to_string(),
                "Carving the windward cliff a little.".to_string(),
                "Framing the roof so you can judge it.".to_string(),
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
                Verb::frame(FrameTarget::Object(ObjectRef("the roof".to_string()))),
            ],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent(
            Intent::words("a weathered lighthouse on a cliff at dusk")
                .with_pictures([Picture::sketch(SKETCH.to_vec())]),
        )
        .expect("the scripted First take lands");

    assert_eq!(
        session.objects().len(),
        3,
        "Compose still places named Objects"
    );
    assert_eq!(session.objects()[0].name, "the cliff");
    assert_eq!(session.objects()[1].name, "the lighthouse");
    assert_eq!(session.objects()[2].name, "the roof");
    assert_eq!(session.light(), Some(LightCondition::Dusk));
    assert!(
        session.objects().iter().all(|o| o.clay.composed_only()),
        "a picture is not a Mesh scan; First take Clay is still composed"
    );

    let roof_before = clay_of(&session, "the roof");
    session
        .submit_intent(
            Intent::words("the roof is too steep, and the cliff more wind-beaten")
                .with_pictures([Picture::screenshot(PHOTO.to_vec())]),
        )
        .expect("the scripted Rehearsal lands");

    assert_eq!(
        session.objects().len(),
        3,
        "Sculpt is still Rehearsal on the same Scene, not a new generated place"
    );
    assert_ne!(
        clay_of(&session, "the roof"),
        roof_before,
        "Sculpt still changes the silhouette after a picture"
    );
    assert!(
        !clay_of(&session, "the roof").composed_only(),
        "the roof has been Sculpted"
    );
    assert!(
        !clay_of(&session, "the cliff").composed_only(),
        "the cliff has been Sculpted"
    );
}
