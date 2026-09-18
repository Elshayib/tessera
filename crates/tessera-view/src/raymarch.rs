//! CPU raymarch of Clay. The live Viewport and Still/Turntable capture share
//! this so the Person and a friend see the same silhouette.

use tessera_engine::LightCondition;

use crate::{Camera, ShownScene};

const CLAY_RGB: [u8; 3] = [0xC4, 0x6B, 0x3A];
const SKY_DUSK: [u8; 3] = [0x2A, 0x30, 0x48];

/// RGB bytes, row-major, 3 bytes per pixel, no padding.
pub fn rgb(scene: &ShownScene, camera: Camera, width: u32, height: u32) -> Vec<u8> {
    let target = look_at(scene);
    let eye = [
        target[0] + camera.azimuth.sin() * camera.distance,
        target[1] + camera.elevation,
        target[2] + camera.azimuth.cos() * camera.distance,
    ];
    let sky = sky_rgb(scene.light);
    let mut out = Vec::with_capacity((width * height * 3) as usize);
    for y in 0..height {
        for x in 0..width {
            let (origin, dir) = camera_ray(x, y, width, height, eye, target);
            out.extend_from_slice(&shade(scene, origin, dir, sky));
        }
    }
    out
}

fn look_at(scene: &ShownScene) -> [f32; 3] {
    if scene.objects.is_empty() {
        return [0.0, 0.0, 0.0];
    }
    let n = scene.objects.len() as f32;
    let s = scene.objects.iter().fold([0.0; 3], |a, o| {
        [a[0] + o.at[0], a[1] + o.at[1], a[2] + o.at[2]]
    });
    [s[0] / n, s[1] / n, s[2] / n]
}

fn shade(scene: &ShownScene, origin: [f32; 3], dir: [f32; 3], sky: [u8; 3]) -> [u8; 3] {
    match march(scene, origin, dir) {
        None => sky,
        Some((p, family)) => {
            let n = normal(scene, p);
            let light = normalize([-0.4, 0.7, 0.5]);
            let lambert = (n[0] * light[0] + n[1] * light[1] + n[2] * light[2]).max(0.0);
            let k = 0.35 + 0.65 * lambert;
            let base = family_rgb(family.as_deref());
            [
                (base[0] as f32 * k) as u8,
                (base[1] as f32 * k) as u8,
                (base[2] as f32 * k) as u8,
            ]
        }
    }
}

fn camera_ray(
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    eye: [f32; 3],
    target: [f32; 3],
) -> ([f32; 3], [f32; 3]) {
    let forward = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
    let right = normalize(cross(forward, [0.0, 1.0, 0.0]));
    let up = cross(right, forward);
    let u = (x as f32 + 0.5) / width as f32 - 0.5;
    let v = 0.5 - (y as f32 + 0.5) / height as f32;
    let fov = 0.9;
    let dir = normalize([
        forward[0] + right[0] * u * fov + up[0] * v * fov,
        forward[1] + right[1] * u * fov + up[1] * v * fov,
        forward[2] + right[2] * u * fov + up[2] * v * fov,
    ]);
    (eye, dir)
}

fn march(
    scene: &ShownScene,
    origin: [f32; 3],
    dir: [f32; 3],
) -> Option<([f32; 3], Option<String>)> {
    let mut t = 0.0;
    for _ in 0..64 {
        let p = [
            origin[0] + dir[0] * t,
            origin[1] + dir[1] * t,
            origin[2] + dir[2] * t,
        ];
        let (d, family) = sample(scene, p);
        if d < 0.002 {
            return Some((p, family));
        }
        t += d.max(0.002);
        if t > 24.0 {
            return None;
        }
    }
    None
}

fn sample(scene: &ShownScene, p: [f32; 3]) -> (f32, Option<String>) {
    let mut best = f32::MAX;
    let mut family = None;
    for o in &scene.objects {
        let q = [p[0] - o.at[0], p[1] - o.at[1], p[2] - o.at[2]];
        let d = o.clay.sample(q);
        if d < best {
            best = d;
            family = o.family.clone();
        }
    }
    (best, family)
}

fn normal(scene: &ShownScene, p: [f32; 3]) -> [f32; 3] {
    let e = 0.002;
    let s = |q| sample(scene, q).0;
    normalize([
        s([p[0] + e, p[1], p[2]]) - s([p[0] - e, p[1], p[2]]),
        s([p[0], p[1] + e, p[2]]) - s([p[0], p[1] - e, p[2]]),
        s([p[0], p[1], p[2] + e]) - s([p[0], p[1], p[2] - e]),
    ])
}

fn family_rgb(family: Option<&str>) -> [u8; 3] {
    match family {
        Some(f) if f.contains("stone") => [0x8A, 0x7A, 0x68],
        Some(f) if f.contains("wood") => [0xC4, 0x6B, 0x3A],
        Some(f) if f.contains("lamp") || f.contains("lit") => [0xE8, 0xC0, 0x5C],
        _ => CLAY_RGB,
    }
}

fn sky_rgb(light: Option<LightCondition>) -> [u8; 3] {
    match light {
        Some(LightCondition::Dawn) => [0x6A, 0x58, 0x68],
        Some(LightCondition::Noon) => [0x87, 0xB4, 0xD8],
        Some(LightCondition::Overcast) => [0x6E, 0x74, 0x7C],
        Some(LightCondition::Night) => [0x0E, 0x12, 0x22],
        Some(LightCondition::Dusk) | None => SKY_DUSK,
    }
}

fn normalize(v: [f32; 3]) -> [f32; 3] {
    let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-8);
    [v[0] / l, v[1] / l, v[2] / l]
}

fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

/// Default camera for a Still of a single Object at the origin, matching the
/// capture the Person keeps (issue #10).
pub fn still_camera(azimuth: f32) -> Camera {
    Camera {
        azimuth,
        elevation: 0.45,
        distance: 1.8,
    }
}
