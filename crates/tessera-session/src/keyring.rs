//! The Key: a paid API key the Person pastes into Tessera. It lives in app
//! settings on the Person's machine, never in the Scene file (spec story 6) —
//! sending a Scene to a friend must not leak the Key. Settings remember a Key,
//! a Brain, and the last catalog per Provider (ADR-0021).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::provider::{Brain, Credentials, ProviderName};

/// Where the machine keeps the Key and the Provider it belongs to. Tessera
/// does not open a credential vault itself: the app hands Session whichever
/// store it trusts (`FileKeyStore` when the app ships). The store never meets
/// the Scene.
pub trait KeyStore {
    /// Read what was last saved on this machine, if anything.
    fn load(&self) -> Option<Settings>;
    /// Save to app settings on this machine.
    fn save(&mut self, settings: &Settings);
}

impl<S: KeyStore + ?Sized> KeyStore for &mut S {
    fn load(&self) -> Option<Settings> {
        (**self).load()
    }
    fn save(&mut self, settings: &Settings) {
        (**self).save(settings);
    }
}

impl<S: KeyStore + ?Sized> KeyStore for Box<S> {
    fn load(&self) -> Option<Settings> {
        (**self).load()
    }
    fn save(&mut self, settings: &Settings) {
        (**self).save(settings);
    }
}

/// Active Provider plus each Provider's remembered Key, Brain, and last catalog.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Settings {
    #[serde(default)]
    pub active: Option<ProviderName>,
    #[serde(default)]
    pub providers: HashMap<ProviderName, ProviderMemory>,
}

impl Settings {
    fn from_legacy(credentials: Credentials) -> Self {
        let mut providers = HashMap::new();
        providers.insert(
            credentials.provider,
            ProviderMemory {
                key: Some(credentials.key),
                brain: credentials.brain,
                catalog: None,
            },
        );
        Self {
            active: Some(credentials.provider),
            providers,
        }
    }
}

/// One Provider's remembered Key, Brain, and last catalog.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderMemory {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brain: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog: Option<Vec<Brain>>,
}

/// The Key and Provider choice as app settings. Settings live in memory while
/// Tessera runs and are written through to the [`KeyStore`] so a restart finds
/// the active Provider, per-Provider Keys and Brains, and cached catalogs.
///
/// The store is the last field so a `Keyring<dyn KeyStore>` can sit behind the
/// Session's box without naming the store type.
pub struct Keyring<S: KeyStore + ?Sized> {
    active: Option<ProviderName>,
    /// A Key pasted before a Provider is picked; it becomes that Provider's Key.
    pending_key: Option<String>,
    providers: HashMap<ProviderName, ProviderMemory>,
    store: S,
}

impl<S: KeyStore> Keyring<S> {
    /// The settings as this machine last kept them.
    pub fn from_store(store: S) -> Self {
        match store.load() {
            Some(settings) => Self {
                active: settings.active,
                pending_key: None,
                providers: settings.providers,
                store,
            },
            None => Self {
                active: None,
                pending_key: None,
                providers: HashMap::new(),
                store,
            },
        }
    }
}

impl<S: KeyStore + ?Sized> Keyring<S> {
    /// The Person pasted a Key. Paste-margin whitespace is trimmed; an empty
    /// paste changes nothing. The Key belongs to the active Provider.
    pub fn set_key(&mut self, key: &str) {
        let key = key.trim();
        if key.is_empty() {
            return;
        }
        if let Some(provider) = self.active {
            let slot = self.providers.entry(provider).or_default();
            if slot.key.as_deref() != Some(key) {
                slot.catalog = None;
            }
            slot.key = Some(key.to_string());
        } else {
            self.pending_key = Some(key.to_string());
        }
        self.write_through();
    }

    /// The Person picked a Provider from the short list (ADR-0016). Switching
    /// activates that Provider's remembered Key and Brain.
    pub fn set_provider(&mut self, provider: ProviderName) {
        self.active = Some(provider);
        if let Some(pending) = self.pending_key.take() {
            let slot = self.providers.entry(provider).or_default();
            if slot.key.is_none() {
                slot.key = Some(pending);
            }
        }
        self.write_through();
    }

    /// The Person picked a Brain, or Tessera picked the default (ADR-0021).
    pub fn set_brain(&mut self, brain: &Brain) {
        let Some(provider) = self.active else {
            return;
        };
        self.providers.entry(provider).or_default().brain = Some(brain.id.clone());
        self.write_through();
    }

    /// The Provider the Key belongs to, once the Person has picked one.
    pub fn provider(&self) -> Option<ProviderName> {
        self.active
    }

    /// The Key last pasted for the active Provider, if any.
    pub fn key(&self) -> Option<&str> {
        self.active
            .and_then(|p| self.providers.get(&p))
            .and_then(|slot| slot.key.as_deref())
            .or(self.pending_key.as_deref())
    }

    /// The Brain id last picked (or defaulted) for the active Provider, if any.
    pub fn brain(&self) -> Option<&str> {
        self.active
            .and_then(|p| self.providers.get(&p))
            .and_then(|slot| slot.brain.as_deref())
    }

    /// Whether the active Provider has a Key (or a Key is waiting for a Provider).
    pub fn has_key(&self) -> bool {
        if let Some(provider) = self.active {
            return self
                .providers
                .get(&provider)
                .and_then(|slot| slot.key.as_ref())
                .is_some();
        }
        self.pending_key.is_some()
    }

    /// What the Agent thinks with, when both halves are set. Brain may still
    /// be missing: listing does not require it.
    pub fn credentials(&self) -> Option<Credentials> {
        let provider = self.active?;
        let slot = self.providers.get(&provider)?;
        Some(Credentials {
            provider,
            key: slot.key.clone()?,
            brain: slot.brain.clone(),
        })
    }

    /// Remember the last live list for the active Provider, next to its Key.
    pub fn set_catalog(&mut self, catalog: &[Brain]) {
        let Some(provider) = self.active else {
            return;
        };
        self.providers.entry(provider).or_default().catalog = Some(catalog.to_vec());
        self.write_through();
    }

    /// The last cached list for the active Provider, if any.
    pub fn catalog(&self) -> Option<&[Brain]> {
        self.active
            .and_then(|p| self.providers.get(&p))
            .and_then(|slot| slot.catalog.as_deref())
    }

    fn snapshot(&self) -> Settings {
        Settings {
            active: self.active,
            providers: self.providers.clone(),
        }
    }

    /// Active Provider, per-Provider memory, and cached catalogs go to the
    /// machine together.
    fn write_through(&mut self) {
        self.store.save(&self.snapshot());
    }
}

/// A [`KeyStore`] for machines without one: settings stay in memory for this
/// run and are never persisted. This is also what tests use.
#[derive(Debug, Default)]
pub struct MemoryKeyStore {
    saved: Option<Settings>,
}

impl KeyStore for MemoryKeyStore {
    fn load(&self) -> Option<Settings> {
        self.saved.clone()
    }

    fn save(&mut self, settings: &Settings) {
        self.saved = Some(settings.clone());
    }
}

/// Settings as a JSON file on the machine. The Scene is a different file.
#[derive(Debug, Clone)]
pub struct FileKeyStore {
    path: PathBuf,
}

impl FileKeyStore {
    pub fn new(path: impl AsRef<Path>) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
        }
    }
}

impl KeyStore for FileKeyStore {
    fn load(&self) -> Option<Settings> {
        let text = std::fs::read_to_string(&self.path).ok()?;
        if let Ok(credentials) = serde_json::from_str::<Credentials>(&text) {
            return Some(Settings::from_legacy(credentials));
        }
        serde_json::from_str(&text).ok()
    }

    fn save(&mut self, settings: &Settings) {
        if let Some(parent) = self.path.parent()
            && !parent.as_os_str().is_empty()
            && std::fs::create_dir_all(parent).is_err()
        {
            return;
        }
        if let Ok(text) = serde_json::to_string_pretty(settings) {
            let _ = std::fs::write(&self.path, text);
        }
    }
}
