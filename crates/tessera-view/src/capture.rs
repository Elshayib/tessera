//! Still and Turntable files a friend can open without Tessera.

use std::io::{self, Write};
use std::path::Path;

use tessera_engine::Clay;

use crate::{Frame, ShownObject, ShownScene};

const SIZE: u32 = 32;
const ORBIT_VIEWS: usize = 12;
const CLAY_RGB: [u8; 3] = [0xC4, 0x6B, 0x3A];
const SKY_RGB: [u8; 3] = [0x2A, 0x30, 0x48];

pub fn still_png(path: &Path, frame: &Frame, clay: Option<&Clay>) -> io::Result<()> {
    let rgb = render(clay, 0.0);
    write_png(path, frame, SIZE, SIZE, &rgb)
}

pub fn turntable_gif(path: &Path, frame: &Frame, clay: Option<&Clay>) -> io::Result<usize> {
    write_gif(path, frame, clay, ORBIT_VIEWS)?;
    Ok(ORBIT_VIEWS)
}

fn render(clay: Option<&Clay>, azimuth: f32) -> Vec<u8> {
    let scene = ShownScene {
        objects: clay
            .map(|clay| ShownObject {
                name: String::new(),
                clay: clay.clone(),
                at: [0.0, 0.0, 0.0],
                family: None,
            })
            .into_iter()
            .collect(),
        sky: None,
        light: None,
    };
    crate::raymarch::rgb(&scene, crate::raymarch::still_camera(azimuth), SIZE, SIZE)
}

fn write_png(path: &Path, frame: &Frame, width: u32, height: u32, rgb: &[u8]) -> io::Result<()> {
    let label = frame.object.as_deref().unwrap_or("the Scene");
    let mut file = std::fs::File::create(path)?;
    file.write_all(b"\x89PNG\r\n\x1a\n")?;
    write_png_chunk(&mut file, b"IHDR", &png_ihdr(width, height))?;
    write_png_chunk(&mut file, b"tEXt", &png_text("Frame", label))?;
    write_png_chunk(&mut file, b"IDAT", &png_idat(width, height, rgb))?;
    write_png_chunk(&mut file, b"IEND", &[])?;
    Ok(())
}

fn png_ihdr(width: u32, height: u32) -> Vec<u8> {
    let mut d = Vec::with_capacity(13);
    d.extend_from_slice(&width.to_be_bytes());
    d.extend_from_slice(&height.to_be_bytes());
    d.extend_from_slice(&[8, 2, 0, 0, 0]);
    d
}

fn png_text(key: &str, value: &str) -> Vec<u8> {
    let mut d = Vec::from(key.as_bytes());
    d.push(0);
    d.extend_from_slice(value.as_bytes());
    d
}

fn png_idat(width: u32, height: u32, rgb: &[u8]) -> Vec<u8> {
    let mut raw = Vec::with_capacity(((width * 3 + 1) * height) as usize);
    for y in 0..height {
        raw.push(0);
        let start = (y * width * 3) as usize;
        let end = start + (width * 3) as usize;
        raw.extend_from_slice(&rgb[start..end]);
    }
    zlib_store(&raw)
}

fn write_png_chunk(w: &mut impl Write, ty: &[u8; 4], data: &[u8]) -> io::Result<()> {
    w.write_all(&(data.len() as u32).to_be_bytes())?;
    w.write_all(ty)?;
    w.write_all(data)?;
    let mut crc_src = Vec::with_capacity(4 + data.len());
    crc_src.extend_from_slice(ty);
    crc_src.extend_from_slice(data);
    w.write_all(&crc32(&crc_src).to_be_bytes())?;
    Ok(())
}

fn zlib_store(data: &[u8]) -> Vec<u8> {
    let mut out = vec![0x78, 0x01];
    let mut i = 0;
    while i < data.len() {
        let end = (i + 65535).min(data.len());
        let chunk = &data[i..end];
        let last = end == data.len();
        out.push(if last { 0x01 } else { 0x00 });
        let len = chunk.len() as u16;
        out.extend_from_slice(&len.to_le_bytes());
        out.extend_from_slice(&(!len).to_le_bytes());
        out.extend_from_slice(chunk);
        i = end;
    }
    out.extend_from_slice(&adler32(data).to_be_bytes());
    out
}

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    for &b in data {
        crc ^= u32::from(b);
        for _ in 0..8 {
            crc = if crc & 1 != 0 {
                (crc >> 1) ^ 0xEDB8_8320
            } else {
                crc >> 1
            };
        }
    }
    !crc
}

fn adler32(data: &[u8]) -> u32 {
    let mut a = 1u32;
    let mut b = 0u32;
    for &byte in data {
        a = (a + u32::from(byte)) % 65521;
        b = (b + a) % 65521;
    }
    (b << 16) | a
}

fn write_gif(path: &Path, frame: &Frame, clay: Option<&Clay>, n_frames: usize) -> io::Result<()> {
    let mut file = std::fs::File::create(path)?;
    file.write_all(b"GIF89a")?;
    file.write_all(&(SIZE as u16).to_le_bytes())?;
    file.write_all(&(SIZE as u16).to_le_bytes())?;
    file.write_all(&[0xF7, 0x00, 0x00])?;
    file.write_all(&gif_palette())?;
    let label = frame.object.as_deref().unwrap_or("the Scene");
    write_gif_comment(&mut file, &format!("Frame: {label}"))?;
    file.write_all(&[0x21, 0xFF, 0x0B])?;
    file.write_all(b"NETSCAPE2.0")?;
    file.write_all(&[0x03, 0x01, 0x00, 0x00, 0x00])?;
    for i in 0..n_frames {
        let azimuth = i as f32 / n_frames as f32 * std::f32::consts::TAU;
        let rgb = render(clay, azimuth);
        let indexed = rgb_to_index(&rgb);
        file.write_all(&[0x21, 0xF9, 0x04, 0x00, 10, 0x00, 0x00, 0x00])?;
        file.write_all(&[0x2C, 0, 0, 0, 0])?;
        file.write_all(&(SIZE as u16).to_le_bytes())?;
        file.write_all(&(SIZE as u16).to_le_bytes())?;
        file.write_all(&[0x00])?;
        write_gif_image_data(&mut file, &indexed)?;
    }
    file.write_all(&[0x3B])?;
    Ok(())
}

fn gif_palette() -> Vec<u8> {
    let mut palette = vec![0u8; 256 * 3];
    palette[0..3].copy_from_slice(&SKY_RGB);
    for i in 1..256 {
        let k = i as f32 / 255.0;
        palette[i * 3] = (CLAY_RGB[0] as f32 * k) as u8;
        palette[i * 3 + 1] = (CLAY_RGB[1] as f32 * k) as u8;
        palette[i * 3 + 2] = (CLAY_RGB[2] as f32 * k) as u8;
    }
    palette
}

fn rgb_to_index(rgb: &[u8]) -> Vec<u8> {
    rgb.chunks(3)
        .map(|c| {
            if c == SKY_RGB.as_slice() {
                0
            } else {
                let k = c[0] as f32 / CLAY_RGB[0] as f32;
                ((k * 255.0).round() as u8).max(1)
            }
        })
        .collect()
}

fn write_gif_comment(w: &mut impl Write, text: &str) -> io::Result<()> {
    w.write_all(&[0x21, 0xFE])?;
    for chunk in text.as_bytes().chunks(255) {
        w.write_all(&[chunk.len() as u8])?;
        w.write_all(chunk)?;
    }
    w.write_all(&[0x00])?;
    Ok(())
}

fn write_gif_image_data(w: &mut impl Write, pixels: &[u8]) -> io::Result<()> {
    w.write_all(&[8])?;
    let mut bits = BitPack::default();
    const CLEAR: u32 = 256;
    const EOI: u32 = 257;
    bits.push(CLEAR, 9);
    for (i, &p) in pixels.iter().enumerate() {
        if i > 0 && i % 100 == 0 {
            bits.push(CLEAR, 9);
        }
        bits.push(u32::from(p), 9);
    }
    bits.push(EOI, 9);
    bits.flush();
    for chunk in bits.bytes.chunks(255) {
        w.write_all(&[chunk.len() as u8])?;
        w.write_all(chunk)?;
    }
    w.write_all(&[0x00])?;
    Ok(())
}

#[derive(Default)]
struct BitPack {
    bytes: Vec<u8>,
    cur: u32,
    nbits: u8,
}

impl BitPack {
    fn push(&mut self, val: u32, width: u8) {
        self.cur |= val << self.nbits;
        self.nbits += width;
        while self.nbits >= 8 {
            self.bytes.push(self.cur as u8);
            self.cur >>= 8;
            self.nbits -= 8;
        }
    }

    fn flush(&mut self) {
        if self.nbits > 0 {
            self.bytes.push(self.cur as u8);
        }
    }
}
