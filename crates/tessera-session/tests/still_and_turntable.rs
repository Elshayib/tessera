//! Still and Turntable (issue #10, ADR-0003, ADR-0012). When the Person likes
//! the work they keep a Still of the framed view and a short Turntable video.
//! A friend opens those without Tessera. No Mesh export.
//!
//! Tests act as the Person: headless, scripted Provider, no Verbs spoken as
//! Intent, no GPU window.

use std::path::PathBuf;

use tessera_session::{
    FrameTarget, LightCondition, MaterialFamily, ObjectRef, Plan, Primitive, Provider,
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

fn keep_path(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "tessera-still-turntable-{}-{}",
        std::process::id(),
        name
    ));
    std::fs::create_dir_all(&dir).expect("temp dir for kept Work");
    dir.join(name)
}

/// Spec story 32: keep a Still of the framed view to send to a friend.
#[test]
fn person_keeps_a_still_of_the_framed_view() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let path = keep_path("lighthouse.png");
    session
        .keep_still(&path)
        .expect("the Person can keep a Still after a First take");

    let bytes = std::fs::read(&path).expect("a Still is a file on disk");
    assert!(
        bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "a Still is a picture file a friend can open without Tessera, got {:x?}",
        &bytes[..bytes.len().min(8)]
    );
    let still = session
        .view()
        .last_still()
        .expect("the Viewport captured a Still of the framed view");
    assert_eq!(
        still.object.as_deref(),
        Some("the lighthouse"),
        "the Still is of the framed view, not some other picture"
    );
    let colors = unique_png_colors(&bytes);
    assert!(
        colors >= 2,
        "the Still is a picture of the framed silhouette, not a blank tile ({colors} colors)"
    );
}

/// Spec story 33: keep a short Turntable video so a friend can judge it as 3D.
#[test]
fn person_keeps_a_short_turntable_video() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let path = keep_path("lighthouse.gif");
    session
        .keep_turntable(&path)
        .expect("the Person can keep a Turntable after a First take");

    let bytes = std::fs::read(&path).expect("a Turntable is a file on disk");
    assert!(
        bytes.starts_with(b"GIF89a"),
        "a Turntable is a video a friend can open without Tessera, got {:x?}",
        &bytes[..bytes.len().min(6)]
    );
    let frames = gif_image_frames(&bytes);
    assert!(
        frames >= 8,
        "an orbit is many views, not a Still; found {frames} image frames"
    );
    let orbit = session
        .view()
        .last_orbit_views()
        .expect("the Viewport captured a Turntable");
    assert!(
        orbit >= 8,
        "the Turntable is a short orbit, not one camera angle"
    );
}

/// Spec story 55 / ADR-0003: Mesh export is absent in v1. What they keep is a
/// picture and a video, never GLB or FBX.
#[test]
fn keeping_work_does_not_offer_a_mesh() {
    let provider = ScriptedProvider::default().plan(first_take_plan());
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");

    let still = keep_path("work.png");
    let turntable = keep_path("work.gif");
    session.keep_still(&still).expect("Still");
    session.keep_turntable(&turntable).expect("Turntable");

    let still_bytes = std::fs::read(&still).unwrap();
    let video_bytes = std::fs::read(&turntable).unwrap();
    assert!(
        still_bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
        "the keepable picture is a PNG, not a Mesh"
    );
    assert!(
        video_bytes.starts_with(b"GIF89a"),
        "the keepable motion is a video, not a Mesh"
    );
    for (name, bytes) in [
        ("still", still_bytes.as_slice()),
        ("turntable", video_bytes.as_slice()),
    ] {
        assert!(
            !bytes.starts_with(b"glTF") && !bytes.starts_with(b"Kaydara FBX"),
            "{name} must not be GLB/glTF/FBX; Mesh export is out of v1"
        );
    }
}

/// Spec story 32: a Still of the lighthouse is not the same picture as a Still
/// of the cliff — the file is of the framed view.
#[test]
fn stills_of_different_frames_are_different_pictures() {
    let provider = ScriptedProvider::default()
        .plan(first_take_plan())
        .plan(Plan::new(
            vec!["Framing the cliff so you can judge it.".to_string()],
            vec![Verb::frame(FrameTarget::Object(ObjectRef(
                "the cliff".to_string(),
            )))],
        ));
    let mut session = Session::start(provider, ViewReport::new());
    person_pastes_key(&mut session);

    session
        .submit_intent("a weathered lighthouse on a cliff at dusk")
        .expect("the scripted First take lands");
    let lighthouse = keep_path("framed-lighthouse.png");
    session
        .keep_still(&lighthouse)
        .expect("Still of lighthouse");

    session
        .submit_intent("show me the cliff")
        .expect("the cliff is framed");
    let cliff = keep_path("framed-cliff.png");
    session.keep_still(&cliff).expect("Still of cliff");

    let a = std::fs::read(&lighthouse).unwrap();
    let b = std::fs::read(&cliff).unwrap();
    assert_ne!(
        png_idat_bytes(&a),
        png_idat_bytes(&b),
        "a Still of the lighthouse must not be the same picture as a Still of the cliff"
    );
}

/// Count image descriptors in a GIF. Walks blocks so LZW bytes equal to 0x2C
/// are not mistaken for frames.
fn gif_image_frames(bytes: &[u8]) -> usize {
    assert!(
        bytes.starts_with(b"GIF89a"),
        "Turntable must be a GIF a friend can open"
    );
    let packed = bytes[10];
    let mut i = 13;
    if packed & 0x80 != 0 {
        i += 3 * (1 << ((packed & 0x07) + 1));
    }
    let mut frames = 0;
    while i < bytes.len() {
        match bytes[i] {
            0x3B => break,
            0x2C => {
                frames += 1;
                i += 10;
                let packed = bytes[i - 1];
                if packed & 0x80 != 0 {
                    i += 3 * (1 << ((packed & 0x07) + 1));
                }
                i += 1;
                while i < bytes.len() && bytes[i] != 0 {
                    i += 1 + usize::from(bytes[i]);
                }
                i += 1;
            }
            0x21 => {
                i += 2;
                while i < bytes.len() && bytes[i] != 0 {
                    i += 1 + usize::from(bytes[i]);
                }
                i += 1;
            }
            other => panic!("unexpected GIF block {other:#x} at {i}"),
        }
    }
    frames
}

fn png_idat_bytes(png: &[u8]) -> Vec<u8> {
    assert!(png.starts_with(b"\x89PNG\r\n\x1a\n"));
    let mut i = 8;
    while i + 8 <= png.len() {
        let len = u32::from_be_bytes(png[i..i + 4].try_into().unwrap()) as usize;
        let ty = &png[i + 4..i + 8];
        let data = &png[i + 8..i + 8 + len];
        if ty == b"IDAT" {
            return data.to_vec();
        }
        if ty == b"IEND" {
            break;
        }
        i += 12 + len;
    }
    panic!("PNG has no IDAT")
}

fn unique_png_colors(png: &[u8]) -> usize {
    let idat = png_idat_bytes(png);
    // Stored zlib: header 2, then stored blocks until last, then adler32.
    assert_eq!(idat[0], 0x78);
    let mut i = 2;
    let mut raw = Vec::new();
    loop {
        let last = idat[i] & 1 == 1;
        let len = u16::from_le_bytes(idat[i + 1..i + 3].try_into().unwrap()) as usize;
        raw.extend_from_slice(&idat[i + 5..i + 5 + len]);
        i += 5 + len;
        if last {
            break;
        }
    }
    let mut colors = std::collections::BTreeSet::new();
    let stride = 1 + png_width(png) * 3;
    for row in raw.chunks(stride) {
        for px in row[1..].chunks(3) {
            colors.insert([px[0], px[1], px[2]]);
        }
    }
    colors.len()
}

fn png_width(png: &[u8]) -> usize {
    // IHDR is the first chunk: 8 sig + 4 len + 4 type + 4 width
    u32::from_be_bytes(png[16..20].try_into().unwrap()) as usize
}
