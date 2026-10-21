//! Fingerprints raw mono 16-bit little-endian PCM read from stdin.
//!
//!     ffmpeg -i song.mp3 -f s16le -ac 1 -ar 44100 - | cargo run --example fingerprint -- 44100

extern crate chromaprint_web;

use std::env;
use std::io::{self, Read};

use chromaprint_web::Fingerprinter;

fn main() -> io::Result<()> {
    let sample_rate: u16 = env::args()
        .nth(1)
        .map(|arg| arg.parse().expect("sample rate must be between 1 and 65535"))
        .unwrap_or(44100);

    let mut bytes = Vec::new();
    io::stdin().read_to_end(&mut bytes)?;
    let samples: Vec<i16> = bytes
        .chunks_exact(2)
        .map(|chunk| i16::from_le_bytes([chunk[0], chunk[1]]))
        .collect();

    let mut fingerprinter = Fingerprinter::new(sample_rate);
    fingerprinter.feed(&samples);
    fingerprinter.finish();

    println!("DURATION={}", samples.len() / sample_rate as usize);
    println!("FINGERPRINT={}", fingerprinter.fingerprint().compress().encode());
    Ok(())
}
