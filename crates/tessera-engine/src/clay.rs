//! Clay is how the Engine holds form (ADR-0008): Pieces joined, carved, and
//! inflated without talking about vertices. A Mesh is poured from Clay later for
//! Game-ready export, which is not part of v1.
//!
//! Clay is a signed distance field: the Part it was composed from, then the
//! Sculpts that have worked its silhouette. Product tests compare Clay values
//! and `composed_only`; they do not sample the field.

use crate::kit::KitPart;
use crate::verb::{Amount, Axis, MaterialFamily, Part, Primitive, Region};

/// One thing in the Scene, addressed as a whole: its place, its silhouette's
/// shape, and the Material family it wears.
#[derive(Debug, Clone)]
pub struct Object {
    /// The name used in Narration and later Talk ("the lantern roof").
    pub name: String,
    /// Relative place in the Scene, in the Agent's coarse words ("on the cliff",
    /// "atop the tower"). The Engine resolves it; the Agent never passes
    /// coordinates.
    pub place: String,
    /// Engine-resolved translation of `place`. Viewport-only; not Agent-facing.
    translation: [f32; 3],
    /// The Part it was composed from: a Primitive or a named Kit Part.
    pub part: Part,
    /// The named look this Object wears; set on the First take, never a shader.
    pub family: Option<MaterialFamily>,
    /// The silhouette as Clay: composed Part, then Sculpts.
    pub clay: Clay,
}

impl Object {
    pub fn new(name: impl Into<String>, place: impl Into<String>, part: Part) -> Self {
        let place = place.into();
        Self {
            name: name.into(),
            translation: [0.0, 0.0, 0.0],
            place,
            part,
            family: None,
            clay: Clay::composed(part),
        }
    }

    /// Place this Object among the ones already in the Scene. The Engine
    /// resolves the coarse words; the Agent still passed no coordinates.
    pub fn among(
        name: impl Into<String>,
        place: impl Into<String>,
        part: Part,
        others: &[Object],
    ) -> Self {
        let place = place.into();
        let translation = resolve_place(&place, others);
        Self {
            name: name.into(),
            translation,
            place,
            part,
            family: None,
            clay: Clay::composed(part),
        }
    }

    /// Where the Engine put this Object. The Viewport raymarches from here.
    pub fn translation(&self) -> [f32; 3] {
        self.translation
    }
}

/// Turn the Agent's coarse place words into a translation among Objects
/// already in the Scene.
fn resolve_place(at: &str, others: &[Object]) -> [f32; 3] {
    let hay = at.to_ascii_lowercase();
    for o in others.iter().rev() {
        let name = o.name.trim_start_matches("the ").to_ascii_lowercase();
        if !hay.contains(&name) {
            continue;
        }
        let t = o.translation;
        if hay.contains("atop") || hay.contains("on the") || hay.starts_with("on ") {
            return [t[0], t[1] + 1.0, t[2]];
        }
        if hay.contains("beside") || hay.contains("next to") {
            return [t[0] + 1.2, t[1], t[2]];
        }
        if hay.contains("under") {
            return [t[0], t[1] - 1.0, t[2]];
        }
        if hay.contains("in the") || hay.contains("in ") {
            return t;
        }
    }
    if others.is_empty() {
        [0.0, 0.0, 0.0]
    } else {
        [others.len() as f32 * 1.4, 0.0, 0.0]
    }
}

/// The form of an Object. Callers Sculpt through named operations; they never
/// set a vertex. Negative samples are inside the silhouette.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Clay {
    part: Part,
    sculpts: Vec<Sculpt>,
}

/// One Object-level Sculpt that has landed on this Clay.
#[derive(Debug, Clone, PartialEq, Eq)]
enum Sculpt {
    Carve { amount: Amount, region: Region },
    Inflate { amount: Amount, region: Region },
    Taper { amount: Amount, along: Axis },
    Weather { amount: Amount },
}

impl Clay {
    /// The silhouette as placed, before any Sculpt.
    pub fn composed(part: Part) -> Self {
        Self {
            part,
            sculpts: Vec::new(),
        }
    }

    /// True when no Sculpt has touched this silhouette. The First take is
    /// composed this way; weathering is Rehearsal.
    pub fn composed_only(&self) -> bool {
        self.sculpts.is_empty()
    }

    /// Cut into the silhouette on a whole-object side.
    pub fn carve(&mut self, amount: Amount, region: Region) {
        self.sculpts.push(Sculpt::Carve { amount, region });
    }

    /// Push the silhouette out on a whole-object side.
    pub fn inflate(&mut self, amount: Amount, region: Region) {
        self.sculpts.push(Sculpt::Inflate { amount, region });
    }

    /// Narrow along the Object's own up/along. (Widen is `inflate`.)
    pub fn taper(&mut self, amount: Amount, along: Axis) {
        self.sculpts.push(Sculpt::Taper { amount, along });
    }

    /// Wear the silhouette as if by age or wind.
    pub fn weather(&mut self, amount: Amount) {
        self.sculpts.push(Sculpt::Weather { amount });
    }

    /// Signed distance at a point in the Object's own space. Negative is inside.
    /// The Viewport raymarches this; product tests do not.
    pub fn sample(&self, p: [f32; 3]) -> f32 {
        let mut q = p;
        for sculpt in &self.sculpts {
            if let Sculpt::Taper { amount, along } = sculpt {
                q = taper_point(q, *amount, *along);
            }
        }
        let mut d = part_sdf(self.part, q);
        for sculpt in &self.sculpts {
            match sculpt {
                Sculpt::Taper { .. } => {}
                Sculpt::Weather { amount } => d += amount_k(*amount),
                Sculpt::Carve { amount, region } => {
                    d = sdf_sub(d, region_cutter(q, *region, *amount));
                }
                Sculpt::Inflate { amount, region } => {
                    d = sdf_union(d, region_blob(q, *region, *amount));
                }
            }
        }
        d
    }
}

fn amount_k(amount: Amount) -> f32 {
    match amount {
        Amount::ALittle => 0.06,
        Amount::More => 0.14,
        Amount::ALot => 0.28,
    }
}

fn part_sdf(part: Part, p: [f32; 3]) -> f32 {
    match part {
        Part::Primitive(primitive) => primitive_sdf(primitive, p),
        Part::Kit(kit) => primitive_sdf(kit_stand_in(kit), p),
    }
}

/// Kit Parts are still Clay, not meshes: each has a Primitive stand-in until
/// the Viewport ticket gives them authored fields.
fn kit_stand_in(part: KitPart) -> Primitive {
    match part {
        KitPart::Tower | KitPart::LanternRoom => Primitive::Cylinder,
        KitPart::Doorway | KitPart::WindowBay | KitPart::CliffSlab | KitPart::Ground => {
            Primitive::Box
        }
        KitPart::RoofCap => Primitive::Cone,
        KitPart::Rock => Primitive::Sphere,
        KitPart::Railing => Primitive::Torus,
        KitPart::Lamp => Primitive::Sphere,
    }
}

fn primitive_sdf(primitive: Primitive, p: [f32; 3]) -> f32 {
    match primitive {
        Primitive::Box => sdf_box(p, [0.5, 0.5, 0.5]),
        Primitive::Sphere => length3(p) - 0.5,
        Primitive::Cylinder => sdf_cylinder(p, 0.4, 0.5),
        Primitive::Capsule => sdf_capsule(p, 0.35, 0.5),
        Primitive::Cone => sdf_cone(p, 0.5, 0.5),
        Primitive::Torus => sdf_torus(p, 0.35, 0.12),
    }
}

fn taper_point(p: [f32; 3], amount: Amount, along: Axis) -> [f32; 3] {
    let k = amount_k(amount);
    match along {
        Axis::Up => {
            let s = 1.0 + k * p[1].max(0.0);
            [p[0] * s, p[1], p[2] * s]
        }
        Axis::Along => {
            let s = 1.0 + k * p[2].max(0.0);
            [p[0] * s, p[1] * s, p[2]]
        }
    }
}

fn region_cutter(p: [f32; 3], region: Region, amount: Amount) -> f32 {
    let t = 0.25 + amount_k(amount);
    match region {
        Region::Windward => sdf_box([p[0], p[1], p[2] + 0.5], [0.7, 0.7, t]),
        Region::Top => sdf_box([p[0], p[1] - 0.5, p[2]], [0.7, t, 0.7]),
        Region::Base => sdf_box([p[0], p[1] + 0.5, p[2]], [0.7, t, 0.7]),
    }
}

fn region_blob(p: [f32; 3], region: Region, amount: Amount) -> f32 {
    let r = 0.2 + amount_k(amount);
    let c = match region {
        Region::Windward => [0.0, 0.0, -0.5],
        Region::Top => [0.0, 0.5, 0.0],
        Region::Base => [0.0, -0.5, 0.0],
    };
    length3([p[0] - c[0], p[1] - c[1], p[2] - c[2]]) - r
}

fn sdf_sub(a: f32, b: f32) -> f32 {
    a.max(-b)
}

fn sdf_union(a: f32, b: f32) -> f32 {
    a.min(b)
}

fn sdf_box(p: [f32; 3], b: [f32; 3]) -> f32 {
    let q = [p[0].abs() - b[0], p[1].abs() - b[1], p[2].abs() - b[2]];
    let outside = length3([q[0].max(0.0), q[1].max(0.0), q[2].max(0.0)]);
    outside + q[0].max(q[1]).max(q[2]).min(0.0)
}

fn sdf_cylinder(p: [f32; 3], radius: f32, half_h: f32) -> f32 {
    let d = [length2(p[0], p[2]) - radius, p[1].abs() - half_h];
    d[0].max(d[1]).min(0.0) + length2(d[0].max(0.0), d[1].max(0.0))
}

fn sdf_capsule(p: [f32; 3], radius: f32, half_h: f32) -> f32 {
    let y = p[1].clamp(-half_h, half_h);
    length3([p[0], p[1] - y, p[2]]) - radius
}

fn sdf_cone(p: [f32; 3], radius: f32, half_h: f32) -> f32 {
    let q = [length2(p[0], p[2]), p[1]];
    let tip = [0.0, half_h];
    let base = [radius, -half_h];
    let w = [q[0] - tip[0], q[1] - tip[1]];
    let v = [base[0] - tip[0], base[1] - tip[1]];
    let t = ((w[0] * v[0] + w[1] * v[1]) / (v[0] * v[0] + v[1] * v[1])).clamp(0.0, 1.0);
    let d = [w[0] - v[0] * t, w[1] - v[1] * t];
    let signed = (q[0] * v[1] - q[1] * v[0]).signum();
    signed * length2(d[0], d[1])
}

fn sdf_torus(p: [f32; 3], major: f32, minor: f32) -> f32 {
    let q = length2(p[0], p[2]) - major;
    length2(q, p[1]) - minor
}

fn length2(x: f32, y: f32) -> f32 {
    (x * x + y * y).sqrt()
}

fn length3(p: [f32; 3]) -> f32 {
    (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]).sqrt()
}

#[cfg(test)]
mod tests {
    use super::{Clay, Object};
    use crate::verb::{Amount, Axis, Part, Primitive, Region};

    /// Weathering wears the silhouette inward (ADR-0008, issue #6).
    #[test]
    fn weather_wears_the_signed_field_inward() {
        let mut clay = Clay::composed(Part::Primitive(Primitive::Sphere));
        assert!(
            clay.sample([0.48, 0.0, 0.0]) < 0.0,
            "just inside a composed sphere"
        );
        clay.weather(Amount::ALot);
        assert!(
            clay.sample([0.48, 0.0, 0.0]) > 0.0,
            "weathering must eat that point off the silhouette"
        );
    }

    #[test]
    fn taper_narrows_the_top() {
        let mut clay = Clay::composed(Part::Primitive(Primitive::Cylinder));
        let before = clay.sample([0.35, 0.3, 0.0]);
        clay.taper(Amount::ALot, Axis::Up);
        let after = clay.sample([0.35, 0.3, 0.0]);
        assert!(
            after > before,
            "taper along up must pull the top in, so the same point is less inside"
        );
    }

    #[test]
    fn carve_cuts_the_named_side() {
        let mut clay = Clay::composed(Part::Primitive(Primitive::Box));
        assert!(clay.sample([0.0, 0.0, -0.45]) < 0.0);
        clay.carve(Amount::ALot, Region::Windward);
        assert!(
            clay.sample([0.0, 0.0, -0.45]) > 0.0,
            "carve windward must cut the -Z side"
        );
    }

    #[test]
    fn atop_sits_above_the_named_object() {
        let cliff = Object::new(
            "the cliff",
            "under the sky",
            Part::Primitive(Primitive::Box),
        );
        let lighthouse = Object::among(
            "the lighthouse",
            "atop the cliff",
            Part::Primitive(Primitive::Cylinder),
            std::slice::from_ref(&cliff),
        );
        assert!(
            lighthouse.translation()[1] > cliff.translation()[1],
            "the lighthouse must sit above the cliff, not share its place"
        );
    }

    #[test]
    fn inflate_pushes_the_named_side_out() {
        let mut clay = Clay::composed(Part::Primitive(Primitive::Box));
        assert!(clay.sample([0.0, -0.7, 0.0]) > 0.0);
        clay.inflate(Amount::ALot, Region::Base);
        assert!(
            clay.sample([0.0, -0.7, 0.0]) < 0.0,
            "inflate base must grow the silhouette downward"
        );
    }
}
