//! The installed Tessera app: one Scene, a live Viewport, chat beside it.
//! Product tests do not open this window; they use the recording View.

mod app;

pub use app::TesseraApp;

use std::path::PathBuf;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread;

use tessera_provider::LivePlanner;
use tessera_session::{FileKeyStore, LiveView, ProviderName, Session, TalkLine};

/// Chat is a strip beside the Viewport; the Viewport is the product (ADR-0004).
pub const CHAT_WIDTH: f32 = 320.0;

pub enum Command {
    Intent(String),
    SetKey(String),
    SetProvider(ProviderName),
    Shutdown,
}

pub enum Event {
    Talk(Vec<TalkLine>),
    Error(String),
    Idle,
}

/// Run Session off the UI thread so Verbs can land on the Viewport while the
/// Person Orbits. One Scene; no account.
pub fn start_session(view: LiveView, store: FileKeyStore) -> (Sender<Command>, Receiver<Event>) {
    let (cmd_tx, cmd_rx) = mpsc::channel();
    let (ev_tx, ev_rx) = mpsc::channel();
    thread::spawn(move || worker(view, store, cmd_rx, ev_tx));
    (cmd_tx, ev_rx)
}

/// Where this machine keeps the Key. Not the Scene; no account.
pub fn key_path() -> PathBuf {
    let mut dir = std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    dir.push("Tessera");
    dir.push("key.json");
    dir
}

fn worker(view: LiveView, store: FileKeyStore, cmds: Receiver<Command>, events: Sender<Event>) {
    let mut session = Session::start(LivePlanner::new(), view).with_key_store(store);
    while let Ok(cmd) = cmds.recv() {
        match cmd {
            Command::Shutdown => break,
            Command::SetKey(key) => session.set_key(&key),
            Command::SetProvider(provider) => session.set_provider(provider),
            Command::Intent(words) => {
                match session.submit_intent(words) {
                    Ok(_) => {
                        let _ = events.send(Event::Talk(session.talk()));
                    }
                    Err(err) => {
                        let _ = events.send(Event::Error(err.to_string()));
                    }
                }
                let _ = events.send(Event::Idle);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tessera_session::{ScriptedProvider, Session};

    #[test]
    fn opens_a_scene_with_no_account() {
        let view = LiveView::new();
        let session = Session::start(ScriptedProvider::default(), view);
        assert!(
            session.objects().is_empty(),
            "a Scene starts empty; no signup"
        );
        assert!(!session.has_key(), "a Key is settings, not an account");
        assert!(session.chosen_provider().is_none());
    }
}
