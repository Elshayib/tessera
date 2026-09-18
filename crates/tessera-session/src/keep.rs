//! CPU capture of a Still and a Turntable. The View seam writes the files;
//! this module is the recorder's adapter onto tessera-view's capture.

use std::io;
use std::path::Path;

use tessera_engine::Clay;
use tessera_view::Frame;

pub fn still_png(path: &Path, frame: &Frame, clay: Option<&Clay>) -> io::Result<()> {
    tessera_view::capture::still_png(path, frame, clay)
}

pub fn turntable_gif(path: &Path, frame: &Frame, clay: Option<&Clay>) -> io::Result<usize> {
    tessera_view::capture::turntable_gif(path, frame, clay)
}
