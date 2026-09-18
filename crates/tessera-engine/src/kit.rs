//! The shipped Kit: named Parts in architecture, nature, and props (ADR-0009).
//!
//! Every Part here is Tessera-authored and MIT-licensed. Third-party packs with
//! a different license do not ship in the Kit (ADR-0020). The Kit is not the
//! product; it is just enough that "lighthouse on a cliff" is made of
//! lighthouse-shaped pieces, not twelve cylinders.

use serde::{Deserialize, Serialize};

/// The three families the v1 Kit is filed under.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KitFamily {
    Architecture,
    Nature,
    Props,
}

/// A named Part from the shipped Kit. v1's minimum catalog for the lighthouse
/// tracer: tower, lantern room, doorway, window bay, roof cap; cliff slab,
/// rock, ground; railing, lamp.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KitPart {
    Tower,
    #[serde(rename = "lantern room")]
    LanternRoom,
    Doorway,
    #[serde(rename = "window bay")]
    WindowBay,
    #[serde(rename = "roof cap")]
    RoofCap,
    #[serde(rename = "cliff slab")]
    CliffSlab,
    Rock,
    Ground,
    Railing,
    Lamp,
}

impl KitPart {
    /// The whole v1 catalog, in spec order. Growing the Kit means adding a
    /// variant here — there is no side door for a third-party pack.
    pub const ALL: [KitPart; 10] = [
        KitPart::Tower,
        KitPart::LanternRoom,
        KitPart::Doorway,
        KitPart::WindowBay,
        KitPart::RoofCap,
        KitPart::CliffSlab,
        KitPart::Rock,
        KitPart::Ground,
        KitPart::Railing,
        KitPart::Lamp,
    ];

    /// The Agent's coarse word for the Part, as Narration and `place` name it.
    pub fn word(self) -> &'static str {
        match self {
            KitPart::Tower => "tower",
            KitPart::LanternRoom => "lantern room",
            KitPart::Doorway => "doorway",
            KitPart::WindowBay => "window bay",
            KitPart::RoofCap => "roof cap",
            KitPart::CliffSlab => "cliff slab",
            KitPart::Rock => "rock",
            KitPart::Ground => "ground",
            KitPart::Railing => "railing",
            KitPart::Lamp => "lamp",
        }
    }

    /// Parse the Agent's coarse word back into a Kit Part.
    pub fn from_word(word: &str) -> Option<Self> {
        match word {
            "tower" => Some(Self::Tower),
            "lantern room" => Some(Self::LanternRoom),
            "doorway" => Some(Self::Doorway),
            "window bay" => Some(Self::WindowBay),
            "roof cap" => Some(Self::RoofCap),
            "cliff slab" => Some(Self::CliffSlab),
            "rock" => Some(Self::Rock),
            "ground" => Some(Self::Ground),
            "railing" => Some(Self::Railing),
            "lamp" => Some(Self::Lamp),
            _ => None,
        }
    }

    /// Which family this Part is filed under.
    pub fn family(self) -> KitFamily {
        match self {
            KitPart::Tower
            | KitPart::LanternRoom
            | KitPart::Doorway
            | KitPart::WindowBay
            | KitPart::RoofCap => KitFamily::Architecture,
            KitPart::CliffSlab | KitPart::Rock | KitPart::Ground => KitFamily::Nature,
            KitPart::Railing | KitPart::Lamp => KitFamily::Props,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{KitFamily, KitPart};

    /// Spec #1 Kit families: the lighthouse minimum, Tessera-authored, MIT.
    #[test]
    fn shipped_kit_is_the_lighthouse_catalog() {
        let catalog: Vec<(&str, KitFamily)> = KitPart::ALL
            .iter()
            .map(|p| (p.word(), p.family()))
            .collect();
        assert_eq!(
            catalog,
            vec![
                ("tower", KitFamily::Architecture),
                ("lantern room", KitFamily::Architecture),
                ("doorway", KitFamily::Architecture),
                ("window bay", KitFamily::Architecture),
                ("roof cap", KitFamily::Architecture),
                ("cliff slab", KitFamily::Nature),
                ("rock", KitFamily::Nature),
                ("ground", KitFamily::Nature),
                ("railing", KitFamily::Props),
                ("lamp", KitFamily::Props),
            ]
        );
    }
}
