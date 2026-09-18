//! The Key: a paid API key the Person pastes into Tessera. It lives in app
//! settings on the Person's machine, never in the Scene file (spec story 6) —
//! sending a Scene to a friend must not leak the Key.

use std::path::{Path, PathBuf};

use crate::provider::{Brain, Credentials, ProviderName};

/// Where the machine keeps the Key and the Provider it belongs to. Tessera
/// does not open a credential vault itself: the app hands Session whichever
/// store it trusts (`FileKeyStore` when the app ships). The store never meets
/// the Scene.
pub trait KeyStore {
    /// Read what was last saved on this machine, if anything.
    fn load(&self) -> Option<Credentials>;
    /// Save to app settings on this machine.
    fn save(&mut self, credentials: &Credentials);
}

impl<S: KeyStore + ?Sized> KeyStore for &mut S {
    fn load(&self) -> Option<Credentials> {
        (**self).load()
    }
    fn save(&mut self, credentials: &Credentials) {
        (**self).save(credentials);
    }
}

impl<S: KeyStore + ?Sized> KeyStore for Box<S> {
    fn load(&self) -> Option<Credentials> {
        (**self).load()
    }
    fn save(&mut self, credentials: &Credentials) {
        (**self).save(credentials);
    }
}

/// The Key and Provider choice as app settings. Settings live in memory while
/// Tessera runs; a complete pair (Key + Provider) is written through to the
/// [`KeyStore`] as soon as it exists, so a restart finds it.
///
/// The store is the last field so a `Keyring<dyn KeyStore>` can sit behind the
/// Session's box without naming the store type.
pub struct Keyring<S: KeyStore + ?Sized> {
    key: Option<String>,
    provider: Option<ProviderName>,
    brain: Option<String>,
    store: S,
}

impl<S: KeyStore> Keyring<S> {
    /// The settings as this machine last kept them.
    pub fn from_store(store: S) -> Self {
        let (key, provider, brain) = match store.load() {
            Some(credentials) => (
                Some(credentials.key),
                Some(credentials.provider),
                credentials.brain,
            ),
            None => (None, None, None),
        };
        Self {
            key,
            provider,
            brain,
            store,
        }
    }
}

impl<S: KeyStore + ?Sized> Keyring<S> {
    /// The Person pasted a Key. Paste-margin whitespace is trimmed; an empty
    /// paste changes nothing.
    pub fn set_key(&mut self, key: &str) {
        let key = key.trim();
        if key.is_empty() {
            return;
        }
        self.key = Some(key.to_string());
        self.write_through();
    }

    /// The Person picked a Provider from the short list (ADR-0016).
    pub fn set_provider(&mut self, provider: ProviderName) {
        self.provider = Some(provider);
        self.write_through();
    }

    /// The Person picked a Brain, or Tessera picked the default (ADR-0021).
    pub fn set_brain(&mut self, brain: &Brain) {
        self.brain = Some(brain.id.clone());
        self.write_through();
    }

    /// Drop the Brain pick. Switching Provider still holds one Brain at a
    /// time; the new Provider gets its own default from its list.
    pub fn clear_brain(&mut self) {
        self.brain = None;
        self.write_through();
    }

    /// The Provider the Key belongs to, once the Person has picked one.
    pub fn provider(&self) -> Option<ProviderName> {
        self.provider
    }

    /// The Brain id last picked (or defaulted) for this Provider, if any.
    pub fn brain(&self) -> Option<&str> {
        self.brain.as_deref()
    }

    /// Whether the Person has pasted a Key.
    pub fn has_key(&self) -> bool {
        self.key.is_some()
    }

    /// What the Agent thinks with, when both halves are set. Brain may still
    /// be missing: listing does not require it.
    pub fn credentials(&self) -> Option<Credentials> {
        Some(Credentials {
            provider: self.provider?,
            key: self.key.clone()?,
            brain: self.brain.clone(),
        })
    }

    /// A complete pair goes to the machine at once; a half-set ring waits.
    fn write_through(&mut self) {
        if let Some(credentials) = self.credentials() {
            self.store.save(&credentials);
        }
    }
}

/// A [`KeyStore`] for machines without one: settings stay in memory for this
/// run and are never persisted. This is also what tests use.
#[derive(Debug, Default)]
pub struct MemoryKeyStore {
    saved: Option<Credentials>,
}

impl KeyStore for MemoryKeyStore {
    fn load(&self) -> Option<Credentials> {
        self.saved.clone()
    }

    fn save(&mut self, credentials: &Credentials) {
        self.saved = Some(credentials.clone());
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
    fn load(&self) -> Option<Credentials> {
        let text = std::fs::read_to_string(&self.path).ok()?;
        serde_json::from_str(&text).ok()
    }

    fn save(&mut self, credentials: &Credentials) {
        if let Some(parent) = self.path.parent()
            && !parent.as_os_str().is_empty()
            && std::fs::create_dir_all(parent).is_err()
        {
            return;
        }
        if let Ok(text) = serde_json::to_string_pretty(credentials) {
            let _ = std::fs::write(&self.path, text);
        }
    }
}
