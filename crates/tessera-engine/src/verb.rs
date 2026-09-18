//! The Verb set: the Agent's entire surface against the Engine (ADR-0002).
//!
//! Scene-level and object-level only. No coordinates, no vertex lists, no shader
//! nodes in arguments. The Person never names a Verb.

/// The Object a Verb acts on, by the name the Agent gave it in Narration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObjectRef(pub String);

/// A Material family: a named look for a surface or the sky ("weathered stone"),
/// never a shader graph. The First take already wears these.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MaterialFamily(pub String);

/// What `frame` puts the camera on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FrameTarget {
    /// A named Object ("the lighthouse").
    Object(ObjectRef),
    /// The Scene as a place.
    Scene,
}

/// A Part with no identity beyond its shape. v1 Compose uses only these; named
/// Kit Parts join the Verb surface with #5.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Primitive {
    Box,
    Sphere,
    Cylinder,
    Capsule,
    Cone,
    Torus,
}

impl Primitive {
    /// The Agent's coarse word for the shape, as Narration names it.
    pub fn word(self) -> &'static str {
        match self {
            Primitive::Box => "box",
            Primitive::Sphere => "sphere",
            Primitive::Cylinder => "cylinder",
            Primitive::Capsule => "capsule",
            Primitive::Cone => "cone",
            Primitive::Torus => "torus",
        }
    }

    /// Parse the Agent's coarse word back into a Primitive.
    pub fn from_word(word: &str) -> Option<Self> {
        match word {
            "box" => Some(Self::Box),
            "sphere" => Some(Self::Sphere),
            "cylinder" => Some(Self::Cylinder),
            "capsule" => Some(Self::Capsule),
            "cone" => Some(Self::Cone),
            "torus" => Some(Self::Torus),
            _ => None,
        }
    }
}

/// Named lighting for the whole Scene, matching the Intent ("at dusk").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LightCondition {
    Dawn,
    Noon,
    Overcast,
    Dusk,
    Night,
}

impl LightCondition {
    /// The Agent's coarse word for the condition, as Narration names it.
    pub fn word(self) -> &'static str {
        match self {
            LightCondition::Dawn => "dawn",
            LightCondition::Noon => "noon",
            LightCondition::Overcast => "overcast",
            LightCondition::Dusk => "dusk",
            LightCondition::Night => "night",
        }
    }

    /// Parse the Agent's coarse word back into a light condition.
    pub fn from_word(word: &str) -> Option<Self> {
        match word {
            "dawn" => Some(Self::Dawn),
            "noon" => Some(Self::Noon),
            "overcast" => Some(Self::Overcast),
            "dusk" => Some(Self::Dusk),
            "night" => Some(Self::Night),
            _ => None,
        }
    }
}

/// A named, high-leverage operation the Agent is allowed to issue.
///
/// Only the Verbs v1 has specified exist here. Verbs not yet landed (#6, #12)
/// will join this enum as their tickets are built; the Agent surface stays small.
// Variant names are lowercase on purpose: they are the spec's Verb vocabulary
// ("place", "frame", ...), the words the Agent speaks.
#[allow(non_camel_case_types)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verb {
    /// Scene-level: camera on a named Object or on the Scene.
    frame(FrameTarget),
    /// Scene-level: named condition matching the Intent (dusk, noon, ...).
    light(LightCondition),
    /// Scene-level: a Material family for the environment (the sky).
    sky(MaterialFamily),
    /// Compose: create an Object from a Primitive, with a name, at a relative
    /// place ("on the cliff"). The Engine resolves place.
    place {
        name: ObjectRef,
        part: Primitive,
        at: String,
    },
    /// Look: set a Material family on a named Object.
    wear {
        object: ObjectRef,
        family: MaterialFamily,
    },
}
