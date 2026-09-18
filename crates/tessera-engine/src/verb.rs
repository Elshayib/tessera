//! The Verb set: the Agent's entire surface against the Engine (ADR-0002).
//!
//! Scene-level and object-level only. No coordinates, no vertex lists, no shader
//! nodes in arguments. The Person never names a Verb.

use crate::kit::KitPart;

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

/// A Part with no identity beyond its shape.
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

/// A piece the Agent may `place` while Composing: a Primitive, or a named Part
/// from the Kit. The Kit does not replace Primitives.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Part {
    Primitive(Primitive),
    Kit(KitPart),
}

impl Part {
    /// The Agent's coarse word for the piece (`"cylinder"`, `"lantern room"`).
    pub fn word(self) -> &'static str {
        match self {
            Part::Primitive(p) => p.word(),
            Part::Kit(k) => k.word(),
        }
    }

    /// Parse a Primitive word or a Kit Part word.
    pub fn from_word(word: &str) -> Option<Self> {
        Primitive::from_word(word)
            .map(Part::Primitive)
            .or_else(|| KitPart::from_word(word).map(Part::Kit))
    }
}

impl From<Primitive> for Part {
    fn from(value: Primitive) -> Self {
        Part::Primitive(value)
    }
}

impl From<KitPart> for Part {
    fn from(value: KitPart) -> Self {
        Part::Kit(value)
    }
}

/// How much a Sculpt asks for, in the Agent's coarse words. Never a millimetre.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Amount {
    ALittle,
    More,
    ALot,
}

impl Amount {
    /// The Agent's coarse word for the amount.
    pub fn word(self) -> &'static str {
        match self {
            Amount::ALittle => "a little",
            Amount::More => "more",
            Amount::ALot => "a lot",
        }
    }

    /// Parse the Agent's coarse word back into an amount.
    pub fn from_word(word: &str) -> Option<Self> {
        match word {
            "a little" => Some(Self::ALittle),
            "more" => Some(Self::More),
            "a lot" => Some(Self::ALot),
            _ => None,
        }
    }
}

/// A whole-object side a Sculpt may name. Never a brush stroke.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Region {
    Windward,
    Top,
    Base,
}

impl Region {
    /// The Agent's coarse word for the side.
    pub fn word(self) -> &'static str {
        match self {
            Region::Windward => "windward",
            Region::Top => "top",
            Region::Base => "base",
        }
    }

    /// Parse the Agent's coarse word back into a side.
    pub fn from_word(word: &str) -> Option<Self> {
        match word {
            "windward" => Some(Self::Windward),
            "top" => Some(Self::Top),
            "base" => Some(Self::Base),
            _ => None,
        }
    }
}

/// Along the Object's own up or along, for `taper`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Axis {
    Up,
    Along,
}

impl Axis {
    /// The Agent's coarse word for the axis.
    pub fn word(self) -> &'static str {
        match self {
            Axis::Up => "up",
            Axis::Along => "along",
        }
    }

    /// Parse the Agent's coarse word back into an axis.
    pub fn from_word(word: &str) -> Option<Self> {
        match word {
            "up" => Some(Self::Up),
            "along" => Some(Self::Along),
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
/// Only the Verbs v1 has specified exist here. Verbs not yet landed (#12)
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
    /// Compose: create an Object from a Primitive or Kit Part, with a name, at
    /// a relative place ("on the cliff"). The Engine resolves place.
    place {
        name: ObjectRef,
        part: Part,
        at: String,
    },
    /// Look: set a Material family on a named Object.
    wear {
        object: ObjectRef,
        family: MaterialFamily,
    },
    /// Sculpt: cut into the silhouette of a named Object, on a whole-object side.
    carve {
        object: ObjectRef,
        amount: Amount,
        region: Region,
    },
    /// Sculpt: push the silhouette out, same coarse arguments as carve.
    inflate {
        object: ObjectRef,
        amount: Amount,
        region: Region,
    },
    /// Sculpt: narrow or widen a named Object along its own up/along.
    taper {
        object: ObjectRef,
        amount: Amount,
        along: Axis,
    },
    /// Sculpt: wear the silhouette as if by age or wind. Rehearsal, not First take.
    weather { object: ObjectRef, amount: Amount },
    /// Object-level: delete a named Object. Session Asks unless that Object is
    /// Pointed (issue #8).
    remove { object: ObjectRef },
}
