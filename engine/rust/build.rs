// Cargo does not track files pulled in via `include!()` for change detection,
// so editing the shared canon would otherwise leave a STALE binary: the DEFs
// embedded by `include!("../../shared/*.canon")` in main.rs are frozen at the
// last time main.rs itself was recompiled. (This bit us 2026-07-12: a canon
// edit had no effect until `touch main.rs` forced a rebuild.) Declaring the
// included sources as build dependencies makes a canon edit force a rebuild.
//
// Paths are relative to the package root (engine/rust/), one level up from the
// `../../shared` main.rs uses relative to engine/rust/src/.
//
// The env vars below are the SECOND staleness axis. The above keeps the canon
// fresh inside the binary; these let a running binary report how old it is and
// which canon it carries, because an MCP server is a long-lived process started
// from a rarely-rebuilt release exe (2026-08-26: six weeks stale, undetectable).
fn main() {
    println!("cargo:rerun-if-changed=../../arest");
    println!("cargo:rerun-if-changed=../shared/scenarios.canon");

    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    println!("cargo:rustc-env=AREST_BUILD_EPOCH={}", secs);

    // FNV-1a over the canon actually embedded: two binaries agree iff they
    // carry the same program. A hash, not an mtime -- a touched file is not a
    // changed one.
    let canon = std::fs::read("../../arest").unwrap_or_default();
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in &canon {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    println!("cargo:rustc-env=AREST_CANON_FNV={:016x}", h);
    println!("cargo:rustc-env=AREST_CANON_BYTES={}", canon.len());
}
