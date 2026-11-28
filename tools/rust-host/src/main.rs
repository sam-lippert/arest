// THE HOST CONTRACT, a peer of tools/java-runner/Program.java, tools/js-runner/program.js and
// tools/cs-runner/Program.cs: read lambda, the case table and the base, register the platform, and print
// what lambda's `main` answers over the cells and the command line, then LF, exiting by the flag. All
// dispatch, the boot included, and all text live in lambda.
//
//   arest-host <address...>

fn run() -> i32 {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let addr: Vec<&str> = argv.iter().map(|s| s.as_str()).collect();
    let answer = arest_host::load_from_env()
        .and_then(|lambda| arest_host::platform::register_all(&lambda))
        .and_then(|_| arest_host::ask(&addr));
    match answer {
        Ok((text, ok)) => { print!("{}\n", text); if ok { 0 } else { 1 } }
        Err(e) => { eprintln!("{}", e); 2 }
    }
}

fn main() {
    std::process::exit(arest_host::deep(run));
}
