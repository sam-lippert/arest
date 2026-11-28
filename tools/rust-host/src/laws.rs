// The lambda laws over the booted base on the Rust host, one by one, a peer of tools/js-runner/laws.js and
// tools/cs-runner/laws: boot the store once (main:boot over the cells), apply each named law to it, and
// print its name, its answer and its time.
//
//   arest-laws <list-file | law...>

fn run() -> i32 {
    let mut names: Vec<String> = std::env::args().skip(1).collect();
    if names.len() == 1 && std::path::Path::new(&names[0]).is_file() {
        names = std::fs::read_to_string(&names[0]).unwrap_or_default().lines()
            .map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    }
    if let Err(e) = arest_host::load_from_env().and_then(|l| arest_host::platform::register_all(&l)) {
        eprintln!("{}", e);
        return 2;
    }
    let t = std::time::Instant::now();
    let store = match arest_host::boot_store() {
        Ok(s) => s,
        Err(e) => { println!("boot ERROR {}", e); return 2; }
    };
    println!("boot {} ms{}", t.elapsed().as_millis(), if std::env::var("AREST_PROFILE").is_ok() { format!(", {} named applications", arest_host::applications()) } else { String::new() });
    for (n, c) in arest_host::profile(if std::env::var("AREST_PROFILE_ALL").is_ok() { usize::MAX } else { 60 }) { println!("  profile boot {} {}", c, n); }
    for l in arest_host::profile_callers(12) { println!("  callers {}", l); }
    for l in arest_host::profile_recomputed(25) { println!("  recomputed boot {}", l); }
    let profiling = std::env::var("AREST_PROFILE").is_ok();
    if profiling { arest_host::profile_reset(); }
    let mut bad = 0;
    for l in &names {
        let t = std::time::Instant::now();
        let r = match arest_host::ev(&arest_host::a(l), &store) {
            Ok(arest_host::V::Q(v)) => {
                let shown = if std::env::var("LAWSHOW").is_ok() { format!(" {}", arest_host::show(&arest_host::V::Q(v.clone())).chars().take(6000).collect::<String>()) } else { String::new() };
                format!("SEQ {}{}", v.len(), shown)
            }
            Ok(v) => arest_host::show(&v),
            Err(e) => { let s = format!("ERROR {}", e.replace('\n', " ")); s.chars().take(260).collect() }
        };
        if r != "T" { bad += 1; }
        println!("{} {} {} ms", l, r, t.elapsed().as_millis());
        if profiling {
            println!("  applications {} {}", l, arest_host::applications());
            for (n, c) in arest_host::profile(40) { println!("  profile {} {} {}", l, c, n); }
            for x in arest_host::profile_callers(10) { println!("  callers {} {}", l, x); }
            for x in arest_host::profile_recomputed(25) { println!("  recomputed {} {}", l, x); }
            arest_host::profile_reset();
        }
    }
    println!("{} laws, {} not T", names.len(), bad);
    if bad == 0 { 0 } else { 1 }
}

fn main() {
    std::process::exit(arest_host::deep(run));
}
