// rust-host's CLI, and the whole binary. The mu, the Backus base, the
// registration vocabulary and canon itself live in lib.rs beside this file,
// because engine/os needs the same evaluator and a second copy of a mu is how
// the first two js runners died. What is left here is the six-line contract's
// outermost layer: argv in, canon's text out, canon's flag as the exit code.

fn run() {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let addr: Vec<&str> = argv.iter().map(|s| s.as_str()).collect();
    let (text, ok) = arest_host::ask(&addr);
    print!("{}
", text);
    std::process::exit(if ok { 0 } else { 1 });
}

fn main() {
    // The canon is ONE deeply nested expression, so merely BUILDING it recurses
    // past the main thread's default stack, and mu then recurses deeper still.
    // The same reduction forces the same budget on every host (the js host's
    // node stack flag, the wasm -zstack-size flag, and the lib's own tests).
    //
    // This is the line engine/os cannot copy: UEFI has no threads to spawn one
    // on, so the OS gets its stack from the image header instead. Recorded
    // there, at the call it constrains.
    std::thread::Builder::new()
        .stack_size(512 * 1024 * 1024)
        .spawn(run)
        .expect("spawn")
        .join()
        .expect("join");
}
