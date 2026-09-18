//! Tessera on Windows: no account, one Scene, a live Viewport.

use tessera::{TesseraApp, key_path, start_session};
use tessera_session::{FileKeyStore, LiveView};

fn main() -> eframe::Result<()> {
    let live = LiveView::new();
    let store = FileKeyStore::new(key_path());
    let (cmds, events) = start_session(live.clone(), store);

    let options = eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 720.0])
            .with_title("Tessera"),
        ..Default::default()
    };
    eframe::run_native(
        "Tessera",
        options,
        Box::new(move |_cc| Ok(Box::new(TesseraApp::new(live, cmds, events)))),
    )
}
