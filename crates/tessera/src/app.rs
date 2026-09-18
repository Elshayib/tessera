//! The window: Viewport is the product; chat and Narration sit beside it.

use std::sync::mpsc::{Receiver, Sender};

use eframe::egui::{self, Color32, ColorImage, Key, RichText, TextureOptions};
use tessera_session::{Brain, ProviderName};
use tessera_view::LiveView;

use crate::{CHAT_WIDTH, Command, Event};

const VIEW: u32 = 256;

pub struct TesseraApp {
    live: LiveView,
    cmds: Sender<Command>,
    events: Receiver<Event>,
    intent: String,
    error: Option<String>,
    key: String,
    provider: ProviderName,
    brains: Vec<Brain>,
    brain_id: Option<String>,
    brain_query: String,
    busy: bool,
}

impl TesseraApp {
    pub fn new(live: LiveView, cmds: Sender<Command>, events: Receiver<Event>) -> Self {
        let _ = cmds.send(Command::SetProvider(ProviderName::Anthropic));
        Self {
            live,
            cmds,
            events,
            intent: String::new(),
            error: None,
            key: String::new(),
            provider: ProviderName::Anthropic,
            brains: Vec::new(),
            brain_id: None,
            brain_query: String::new(),
            busy: false,
        }
    }

    fn drain_events(&mut self) {
        while let Ok(event) = self.events.try_recv() {
            match event {
                Event::Talk(_) => self.error = None,
                Event::Error(err) => self.error = Some(err),
                Event::Catalog { brains, chosen } => {
                    self.brains = brains;
                    self.brain_id = chosen;
                    self.error = None;
                }
                Event::Idle => self.busy = false,
            }
        }
    }

    fn send_intent(&mut self) {
        let words = self.intent.trim().to_string();
        if words.is_empty() {
            return;
        }
        self.intent.clear();
        self.error = None;
        if self.busy {
            // Talk over: the current Verb finishes, then these words are Intent.
            self.live.request_steer(words);
            return;
        }
        self.busy = true;
        if !self.key.is_empty() {
            let _ = self.cmds.send(Command::SetKey(self.key.clone()));
            let _ = self.cmds.send(Command::SetProvider(self.provider));
        }
        let _ = self.cmds.send(Command::Intent(words));
    }
}

impl eframe::App for TesseraApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.drain_events();
        if self.busy {
            ctx.request_repaint();
        }

        egui::TopBottomPanel::top("settings").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.label("Tessera");
                ui.separator();
                ui.label("No account. One Scene.");
                ui.separator();
                ui.label("Provider");
                egui::ComboBox::from_id_salt("provider")
                    .selected_text(self.provider.word())
                    .show_ui(ui, |ui| {
                        for p in ProviderName::ALL {
                            if ui.selectable_label(self.provider == p, p.word()).clicked() {
                                self.provider = p;
                                let _ = self.cmds.send(Command::SetProvider(p));
                            }
                        }
                    });
                ui.label("Key");
                let key = ui.add(
                    egui::TextEdit::singleline(&mut self.key)
                        .password(true)
                        .desired_width(220.0)
                        .hint_text("paste a Key"),
                );
                if key.lost_focus() && !self.key.is_empty() {
                    let _ = self.cmds.send(Command::SetKey(self.key.clone()));
                    let _ = self.cmds.send(Command::RefreshBrains);
                }
                if self.provider == ProviderName::Anthropic && !self.brains.is_empty() {
                    ui.label("Brain");
                    let selected = self
                        .brains
                        .iter()
                        .find(|b| Some(b.id.as_str()) == self.brain_id.as_deref())
                        .map(|b| b.name.as_str())
                        .unwrap_or("pick a Brain");
                    egui::ComboBox::from_id_salt("brain")
                        .selected_text(selected)
                        .show_ui(ui, |ui| {
                            ui.add(
                                egui::TextEdit::singleline(&mut self.brain_query)
                                    .hint_text("search")
                                    .desired_width(220.0),
                            );
                            egui::ScrollArea::vertical()
                                .max_height(200.0)
                                .show(ui, |ui| {
                                    for brain in
                                        self.brains.iter().filter(|b| b.matches(&self.brain_query))
                                    {
                                        let picked =
                                            Some(brain.id.as_str()) == self.brain_id.as_deref();
                                        if ui.selectable_label(picked, &brain.name).clicked() {
                                            self.brain_id = Some(brain.id.clone());
                                            let _ =
                                                self.cmds.send(Command::SetBrain(brain.id.clone()));
                                        }
                                    }
                                });
                        });
                }
            });
        });

        let snap = self.live.snapshot();

        egui::SidePanel::right("chat")
            .exact_width(CHAT_WIDTH)
            .show(ctx, |ui| {
                ui.heading("Talk");
                ui.label(
                    RichText::new("Narration of the take. The Viewport is the product.")
                        .small()
                        .color(Color32::GRAY),
                );
                ui.separator();
                egui::ScrollArea::vertical()
                    .stick_to_bottom(true)
                    .max_height(ui.available_height() - 80.0)
                    .show(ui, |ui| {
                        if snap.talk.is_empty() {
                            ui.label("Type Intent. Watch Clay land.");
                        }
                        for line in &snap.talk {
                            ui.label(line);
                        }
                    });
                ui.separator();
                if let Some(err) = &self.error {
                    ui.colored_label(Color32::from_rgb(0xC0, 0x40, 0x40), err);
                }
                ui.horizontal(|ui| {
                    let edit = ui.add(
                        egui::TextEdit::singleline(&mut self.intent)
                            .desired_width(ui.available_width() - 56.0)
                            .hint_text(if self.busy { "Steer" } else { "Intent" }),
                    );
                    if edit.lost_focus() && ui.input(|i| i.key_pressed(Key::Enter)) {
                        self.send_intent();
                    }
                    if ui.button("Go").clicked() {
                        self.send_intent();
                    }
                });
                if ui.button("Stop").clicked() {
                    self.live.request_stop();
                }
            });

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.heading("Viewport");
            ui.label(
                RichText::new(
                    "Drag to Orbit. Optional. The Agent will Frame again on the next Verb.",
                )
                .small()
                .color(Color32::GRAY),
            );
            let rgb = tessera_view::raymarch::rgb(&snap.scene, snap.camera, VIEW, VIEW);
            let image = ColorImage::from_rgb([VIEW as usize, VIEW as usize], &rgb);
            let tex = ctx.load_texture("viewport", image, TextureOptions::NEAREST);
            let size = ui.available_size();
            let side = size.x.min(size.y).max(128.0);
            let response = ui.add(
                egui::Image::from_texture(&tex)
                    .fit_to_exact_size(egui::vec2(side, side))
                    .sense(egui::Sense::drag()),
            );
            if response.dragged() {
                let d = response.drag_delta();
                self.live.turn(d.x * 0.01, -d.y * 0.01);
                ctx.request_repaint();
            }
            if response.drag_stopped() {
                self.live.stop_turning();
            }
        });
    }
}
