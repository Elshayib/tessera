//! The Verb set: the Agent's entire surface against the Engine (ADR-0002).
//!
//! Scene-level and object-level only. No coordinates, no vertex lists, no shader
//! nodes in arguments. The Person never names a Verb.

/// The Object a Verb acts on, by the name the Agent gave it in Narration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObjectRef(pub String);

/// What `frame` puts the camera on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FrameTarget {
    /// A named Object ("the lighthouse").
    Object(ObjectRef),
    /// The Scene as a place.
    Scene,
}

/// A named, high-leverage operation the Agent is allowed to issue.
///
/// Only the Verbs v1 has specified exist here. Verbs not yet landed (#3, #6, #12)
/// will join this enum as their tickets are built; the Agent surface stays small.
// Variant names are lowercase on purpose: they are the spec's Verb vocabulary
// ("place", "frame", ...), the words the Agent speaks.
#[allow(non_camel_case_types)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verb {
    /// Scene-level: camera on a named Object or on the Scene.
    frame(FrameTarget),
    /// Compose: create an Object from a Primitive or Kit Part, with a name, at a
    /// relative place ("on the cliff"). The Engine resolves place.
    place {
        name: ObjectRef,
        part: String,
        at: String,
    },
}
