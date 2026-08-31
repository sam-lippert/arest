// NO STORE IMAGE IS STAGED. This staged a JSON dump of an app store
// into OUT_DIR for main.rs to include_str!, which made the image
// file-based at its root: a blob found by path and read back whole,
// which is the shape a fact-based OS exists to remove. It is also
// Codd's opening argument — a materialization is storage, and reading
// one is reasoning about storage instead of about relations.
//
// What replaces it is what every other host already does: canon and
// its carriers, spliced as source, evaluated. Until this crate sits on
// canon the way the four thin evaluators do, it stages nothing.
use std::env;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");

    // the full target's UI compiles with glyphs EMBEDDED for the
    // software renderer — text on firmware without runtime fonts
    if env::var("CARGO_FEATURE_FULL").is_ok() {
        let cfg = slint_build::CompilerConfiguration::new()
            .embed_resources(
                slint_build::EmbedResourcesKind::EmbedForSoftwareRenderer);
        slint_build::compile_with_config("ui/splash.slint", cfg).unwrap();
        println!("cargo:rerun-if-changed=ui/splash.slint");
    }
}
