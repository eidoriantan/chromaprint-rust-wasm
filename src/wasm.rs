use wasm_bindgen::prelude::*;

use fingerprinter::Fingerprinter;

/// Computes the encoded chromaprint fingerprint of 16-bit PCM samples.
#[wasm_bindgen]
pub fn fingerprint(sample_rate: u16, samples: &[i16]) -> String {
    let mut fingerprinter = Fingerprinter::new(sample_rate);
    fingerprinter.feed(samples);
    fingerprinter.finish();
    fingerprinter.fingerprint().compress().encode()
}
