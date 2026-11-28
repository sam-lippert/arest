// The platform's registrations on a native host, a peer of tools/java-runner/Registrations.java,
// tools/js-runner/registrations.js and tools/cs-runner/Registrations.cs, written from the JS host's line for
// line: one body for each Function metamodel/resolution.md declares with Definition Origin 'registered' and
// lambda applies. Each is outside D (a clock, a file, entropy, a database engine), which is why it is
// registered and not defined (AREST.tex Def. 9); a body that decides more than its row says is meaning in
// the host.
//
// A write call is one transaction: it commits whole or leaves the database as it was (Backus 14.3.1). SQLite
// is the bundled one rusqlite builds, pinned near the Java host's sqlite-jdbc, so the hosts answer from the
// same engine; every value is answered as the text SQLite gives it and NULL as #.
use crate::{a, at, clock, ev, q, register, round, seq, show, text, V, R};
use rusqlite::{types::ValueRef, Connection, OpenFlags};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

const KEY: &str = "AREST_MASTER_KEY";

fn present(s: &Option<String>) -> bool { matches!(s, Some(v) if !v.is_empty()) }

fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{:02x}", x)).collect() }

fn sha256(b: &[u8]) -> Vec<u8> { use sha2::Digest; sha2::Sha256::digest(b).to_vec() }

fn err<E: std::fmt::Display>(e: E) -> String { e.to_string() }

// The master key: the environment's, else the AREST_MASTER_KEY line of the .env beside the lambda. Never printed.
fn master_key(root: &str) -> Option<String> {
    if let Ok(v) = std::env::var(KEY) { if !v.is_empty() { return Some(v); } }
    let p = std::path::Path::new(root).join(".env");
    let t = std::fs::read_to_string(p).ok()?;
    for line in t.lines() {
        let l = line.trim_start();
        if let Some(rest) = l.strip_prefix(KEY) {
            let rest = rest.trim_start();
            if let Some(v) = rest.strip_prefix('=') {
                let mut v = v.trim().to_string();
                if v.len() > 1 && ((v.starts_with('"') && v.ends_with('"')) || (v.starts_with('\'') && v.ends_with('\''))) { v = v[1..v.len() - 1].to_string(); }
                return if v.is_empty() { None } else { Some(v) };
            }
        }
    }
    None
}

fn random(n: usize) -> Result<Vec<u8>, String> { let mut b = vec![0u8; n]; getrandom::getrandom(&mut b).map_err(err)?; Ok(b) }

fn b64e(b: &[u8]) -> String { use base64::Engine; base64::engine::general_purpose::STANDARD.encode(b) }
fn b64d(s: &str) -> Result<Vec<u8>, String> { use base64::Engine; base64::engine::general_purpose::STANDARD.decode(s).map_err(err) }

// AES-256-GCM under the SHA-256 of the key's text, one text atom: base64 of iv (12) || tag (16) || ciphertext
fn encrypt(x: &V) -> R {
    use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
    let c = Aes256Gcm::new_from_slice(&sha256(text(&at(x, 0)?)?.as_bytes())).map_err(err)?;
    let iv = random(12)?;
    let out = c.encrypt(Nonce::from_slice(&iv), text(&at(x, 1)?)?.as_bytes()).map_err(err)?;
    let (ct, tag) = out.split_at(out.len() - 16);
    let mut all = iv.clone();
    all.extend_from_slice(tag);
    all.extend_from_slice(ct);
    Ok(a(&b64e(&all)))
}

fn decrypt(x: &V) -> R {
    use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
    let all = b64d(&text(&at(x, 1)?)?)?;
    if all.len() < 28 { return Err("crypt:decrypt on a ciphertext shorter than its iv and tag".into()); }
    let c = Aes256Gcm::new_from_slice(&sha256(text(&at(x, 0)?)?.as_bytes())).map_err(err)?;
    let mut body = all[28..].to_vec();
    body.extend_from_slice(&all[12..28]);
    let p = c.decrypt(Nonce::from_slice(&all[..12]), body.as_ref()).map_err(|e| format!("crypt:decrypt: {}", e))?;
    Ok(a(&String::from_utf8_lossy(&p)))
}

fn genkey(x: &V) -> R {
    let p = text(x)?;
    if present(&std::env::var(KEY).ok()) { return Err(format!("crypt:genkey refuses: {} is already set in the environment", KEY)); }
    let had = std::fs::read_to_string(&p).unwrap_or_default();
    if had.lines().any(|l| { let t = l.trim_start(); t.strip_prefix(KEY).map(|r| r.trim_start().starts_with('=')).unwrap_or(false) }) {
        return Err(format!("crypt:genkey refuses: {} is already in {}", KEY, p));
    }
    let key = b64e(&random(32)?);
    let mut add = String::new();
    if !(had.is_empty() || had.ends_with('\n')) { add.push('\n'); }
    add.push_str(&format!("{}={}\n", KEY, key));
    use std::io::Write;
    std::fs::OpenOptions::new().create(true).append(true).open(&p).and_then(|mut f| f.write_all(add.as_bytes())).map_err(err)?;
    Ok(a(&hex(&sha256(key.as_bytes()))[..12]))
}

// ---- sqlite ------------------------------------------------------------------------------------------

fn open(p: &str, read_only: bool) -> Result<Connection, String> {
    let flags = if read_only { OpenFlags::SQLITE_OPEN_READ_ONLY } else { OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE };
    Connection::open_with_flags(p, flags | OpenFlags::SQLITE_OPEN_NO_MUTEX | OpenFlags::SQLITE_OPEN_URI).map_err(|e| format!("sqlite: cannot open {}: {}", p, e))
}

// JavaScript's Number.prototype.toPrecision(15), then SQLite's %!.15g spelling, as the JS host writes a real
fn real_text(v: f64) -> String {
    if v.is_nan() { return "NaN".into(); }
    if v.is_infinite() { return if v > 0.0 { "Inf".into() } else { "-Inf".into() }; }
    let s = if v == 0.0 { "0.00000000000000".to_string() } else {
        let e = format!("{:.14e}", v);                       // d.ddddddddddddddeX
        let (m, x) = e.split_at(e.find('e').unwrap());
        let exp: i32 = x[1..].parse().unwrap_or(0);
        let neg = m.starts_with('-');
        let digits: String = m.chars().filter(|c| c.is_ascii_digit()).collect();
        let body = if !(-6..15).contains(&exp) {
            format!("{}.{}e{}{}", &digits[..1], &digits[1..], if exp < 0 { "-" } else { "+" }, exp.abs())
        } else if exp >= 0 {
            let k = (exp + 1) as usize;
            if k < 15 { format!("{}.{}", &digits[..k], &digits[k..]) } else { digits[..k].to_string() }
        } else {
            format!("0.{}{}", "0".repeat((-exp - 1) as usize), digits)
        };
        format!("{}{}", if neg { "-" } else { "" }, body)
    };
    let fix = |m: &str| -> String { if m.contains('.') { let t = m.trim_end_matches('0'); if t.ends_with('.') { format!("{}0", t) } else { t.to_string() } } else { format!("{}.0", m) } };
    if let Some(i) = s.find('e') {
        let (m, x) = s.split_at(i);
        let sign = if x.as_bytes()[1] == b'-' { "-" } else { "+" };
        let digits = x[1..].trim_start_matches(['+', '-']);
        return format!("{}e{}{:0>2}", fix(m), sign, digits);
    }
    fix(&s)
}

fn cell(v: ValueRef) -> V {
    match v {
        ValueRef::Null => a("#"),
        ValueRef::Integer(n) => a(&n.to_string()),
        ValueRef::Real(f) => a(&real_text(f)),
        ValueRef::Text(t) => a(&String::from_utf8_lossy(t)),
        ValueRef::Blob(b) => a(&String::from_utf8_lossy(b)),
    }
}

fn bind(st: &mut rusqlite::Statement, ps: &[V], hash_is_null: bool) -> Result<(), String> {
    for (i, v) in ps.iter().enumerate() {
        match v {
            V::Q(_) => return Err("a sequence where a value belongs".into()),
            V::S(s) if hash_is_null && &**s == "#" => st.raw_bind_parameter(i + 1, rusqlite::types::Null),
            V::N(n) => st.raw_bind_parameter(i + 1, *n),
            V::S(s) => st.raw_bind_parameter(i + 1, &**s),
        }.map_err(err)?;
    }
    Ok(())
}

// a statement's rows, each value the text SQLite gives it and NULL as #
fn query(db: &Connection, sql: &str, ps: &[V], hash_is_null: bool) -> R {
    // a statement prepared once per connection and kept, as bun:sqlite's db.query keeps it: preparing lambda's
    // deep view chains again for every read is most of a read's cost
    let mut st = db.prepare_cached(sql).map_err(err)?;
    bind(&mut st, ps, hash_is_null)?;
    let n = st.column_count();
    let mut rows = st.raw_query();
    let mut out = Vec::new();
    while let Some(r) = rows.next().map_err(err)? {
        let mut row = Vec::with_capacity(n);
        for i in 0..n { row.push(cell(r.get_ref(i).map_err(err)?)); }
        out.push(q(row));
    }
    Ok(q(out))
}

// one statement run to its end, its rows discarded
fn step(db: &Connection, sql: &str, ps: &[V], hash_is_null: bool) -> Result<(), String> {
    let mut st = db.prepare(sql).map_err(err)?;
    bind(&mut st, ps, hash_is_null)?;
    let mut rows = st.raw_query();
    while rows.next().map_err(err)?.is_some() {}
    Ok(())
}

fn changes(db: &Connection) -> Result<i64, String> { db.query_row("select total_changes()", [], |r| r.get(0)).map_err(err) }

// one write call, one transaction
fn write<T>(p: &str, work: impl FnOnce(&Connection) -> Result<T, String>) -> Result<T, String> {
    let db = open(p, false)?;
    db.execute_batch("begin").map_err(err)?;
    match work(&db) {
        Ok(o) => { db.execute_batch("commit").map_err(err)?; Ok(o) }
        Err(e) => { let _ = db.execute_batch("rollback"); Err(e) }
    }
}

thread_local! {
    // PRAGMA data_version moves when ANOTHER connection commits, so it is asked on a connection kept
    // read-only, one per path, closed before its file is removed or renamed; sqlite:query reads on it too
    static WATCHED: RefCell<HashMap<String, Rc<Connection>>> = RefCell::new(HashMap::new());
}

fn watched(p: &str) -> Result<Rc<Connection>, String> {
    if let Some(c) = WATCHED.with(|w| w.borrow().get(p).cloned()) { return Ok(c); }
    let c = Rc::new(open(p, true)?);
    c.set_prepared_statement_cache_capacity(1024);
    WATCHED.with(|w| w.borrow_mut().insert(p.to_string(), c.clone()));
    Ok(c)
}

fn unwatch(p: &str) { WATCHED.with(|w| { w.borrow_mut().remove(p); }); }

fn rm(p: &str) { let _ = std::fs::remove_file(p); }

fn run(x: &V) -> R {
    let p = text(&at(x, 0)?)?;
    let sql = text(&at(x, 1)?)?;
    let rows = seq(&at(x, 2)?)?;
    write(&p, |db| {
        let mut st = db.prepare(&sql).map_err(err)?;
        let mut n = 0i64;
        for r in rows.iter() {
            let res = (|| -> Result<(), String> {
                st.clear_bindings();
                bind(&mut st, &seq(r)?, true)?;
                let mut rs = st.raw_query();
                while rs.next().map_err(err)?.is_some() {}
                Ok(())
            })();
            if let Err(e) = res { return Err(format!("{} -- row {} of {}", e, n + 1, rows.len())); }
            n += 1;
        }
        Ok(V::N(n))
    })
}

fn program(x: &V) -> R {
    let p = text(&at(x, 0)?)?;
    let steps = seq(&at(x, 1)?)?;
    let db = open(&p, false)?;
    db.execute_batch("begin").map_err(err)?;
    match run_steps(&db, &steps) {
        Ok(o) => {
            let committed = matches!(seq(&o)?.first(), Some(V::S(s)) if &**s == "committed");
            db.execute_batch(if committed { "commit" } else { "rollback" }).map_err(err)?;
            Ok(o)
        }
        Err(e) => { let _ = db.execute_batch("rollback"); Err(e) }
    }
}

fn run_steps(db: &Connection, steps: &[V]) -> R {
    let mut answers = Vec::new();
    let mut denied = Vec::new();
    let mut n = 0i64;
    for stp in steps {
        n += 1;
        let s = seq(stp)?;
        let kind = text(&s[0])?;
        let sql = text(&s[1])?;
        let ps: Vec<V> = if s.len() > 2 { seq(&s[2])?.to_vec() } else { vec![] };
        let guard = if s.len() > 3 && kind != "fix" { text(&s[3])? } else { String::new() };
        let res = (|| -> Result<Option<V>, String> {
            if !guard.is_empty() && seq(&query(db, &guard, &[], true)?)?.is_empty() { answers.push(q(vec![])); return Ok(None); }
            match kind.as_str() {
                "exec" => {
                    let was = changes(db)?;
                    if !ps.is_empty() { step(db, &sql, &ps, true)?; } else { db.execute_batch(&sql).map_err(err)?; }
                    answers.push(V::N(changes(db)? - was));
                }
                "rows" => answers.push(query(db, &sql, &ps, true)?),
                "fix" => {
                    let was = changes(db)?;
                    let mut before = -1;
                    while before != changes(db)? { before = changes(db)?; step(db, &sql, &ps, true)?; }
                    answers.push(V::N(changes(db)? - was));
                }
                "refuse" => {
                    let rows = query(db, &sql, &ps, true)?;
                    if !seq(&rows)?.is_empty() { return Ok(Some(q(vec![a("refused"), V::N(n), rows]))); }
                    answers.push(rows);
                }
                "deny" => {
                    let rows = query(db, &sql, &ps, true)?;
                    if !seq(&rows)?.is_empty() { denied.push(q(vec![V::N(n), rows.clone()])); }
                    answers.push(rows);
                }
                k => return Err(format!("no step of kind {}", k)),
            }
            Ok(None)
        })();
        match res {
            Ok(Some(refused)) => return Ok(refused),
            Ok(None) => {}
            Err(e) => {
                let head: String = sql.chars().take(300).collect();
                return Err(format!("sqlite:program, step {} ({}): {} -- {}", n, kind, e, head));
            }
        }
    }
    if !denied.is_empty() { return Ok(q(vec![a("denied"), q(denied)])); }
    Ok(q(vec![a("committed"), q(answers)]))
}

fn reg(name: &str, f: impl Fn(&V) -> R + 'static) -> Result<(), String> { register(name, Rc::new(f)) }

/// Register the platform for the lambda read from lambda_path (module:root is its directory).
pub fn register_all(lambda_path: &str) -> Result<(), String> {
    let root = std::fs::canonicalize(lambda_path).ok()
        .and_then(|p| p.parent().map(|d| d.to_string_lossy().to_string()))
        .unwrap_or_else(|| ".".to_string())
        .trim_start_matches(r"\\?\").replace('\\', "/");

    reg("clock", |_| Ok(a(&clock())))?;
    reg("round", round)?;
    reg("fs:dir", |x| {
        let p = text(x)?;
        let rd = std::fs::read_dir(&p).map_err(|_| format!("fs:dir: not a directory: {}", p))?;
        Ok(q(rd.filter_map(|e| e.ok()).map(|e| a(&e.file_name().to_string_lossy())).collect()))
    })?;
    reg("fs:read", |x| std::fs::read_to_string(text(x)?).map(|s| a(&s)).map_err(err))?;
    reg("fs:write", |x| {
        let p = text(&at(x, 0)?)?;
        std::fs::write(format!("{}.build", p), text(&at(x, 1)?)?).map_err(err)?;
        std::fs::rename(format!("{}.build", p), &p).map_err(err)?;
        Ok(a(&p))
    })?;
    reg("carrier:cells", |x| crate::carrier_cells(&text(x)?))?;
    let r2 = root.clone();
    reg("module:root", move |_| Ok(a(&r2)))?;
    reg("storage:engine", |_| Ok(a("sqlite")))?;

    reg("crypt:digest", |x| Ok(a(&hex(&sha256(text(x)?.as_bytes())))))?;
    reg("crypt:encrypt", encrypt)?;
    reg("crypt:decrypt", decrypt)?;
    reg("crypt:genkey", genkey)?;
    let r3 = root.clone();
    reg("crypt:keyed", move |_| Ok(a(if master_key(&r3).is_some() { "T" } else { "F" })))?;
    let r4 = root.clone();
    reg("hook:seal", move |x| {
        let key = master_key(&r4).ok_or_else(|| format!("hook:seal: there is no {} to store a value through a Function with", KEY))?;
        ev(&a("hook:write"), &q(vec![a(&key), at(x, 0)?, at(x, 1)?, at(x, 2)?]))
    })?;

    reg("sqlite:exec", |x| {
        let p = text(&at(x, 0)?)?;
        let sql = text(&at(x, 1)?)?;
        write(&p, |db| db.execute_batch(&sql).map_err(err))?;
        Ok(a(&p))
    })?;
    reg("sqlite:run", run)?;
    reg("sqlite:query", |x| query(&*watched(&text(&at(x, 0)?)?)?, &text(&at(x, 1)?)?, &seq(&at(x, 2)?)?, false))?;
    reg("sqlite:scratch", |x| {
        let db = open(":memory:", false)?;
        db.execute_batch(&text(&at(x, 0)?)?).map_err(err)?;
        query(&db, &text(&at(x, 1)?)?, &seq(&at(x, 2)?)?, false)
    })?;
    reg("sqlite:program", program)?;
    reg("sqlite:data_version", |x| {
        let c = watched(&text(x)?)?;
        c.query_row("pragma data_version", [], |r| r.get::<_, i64>(0)).map(V::N).map_err(err)
    })?;
    reg("sqlite:fresh", |x| {
        let p = text(x)?;
        unwatch(&p);
        for f in [p.clone(), format!("{}-wal", p), format!("{}-shm", p), format!("{}-journal", p)] { rm(&f); }
        Ok(a(&p))
    })?;
    reg("sqlite:install", |x| {
        let (build, p) = (text(&at(x, 0)?)?, text(&at(x, 1)?)?);
        if std::path::Path::new(&p).exists() { return Err(format!("sqlite:install refuses: {} exists; a store that exists is changed in place, never overwritten by a fresh build", p)); }
        unwatch(&build); unwatch(&p);
        std::fs::rename(&build, &p).map_err(err)?;
        Ok(a(&p))
    })?;
    reg("sqlite:copy", |x| {
        let (from, to) = (text(&at(x, 0)?)?, text(&at(x, 1)?)?);
        if from == to || !std::path::Path::new(&from).exists() { return Err(format!("sqlite:copy refuses: nothing to copy from {} to {}", from, to)); }
        unwatch(&to);
        for f in [to.clone(), format!("{}-wal", to), format!("{}-shm", to), format!("{}-journal", to)] { rm(&f); }
        let db = open(&from, true)?;
        step(&db, "vacuum into ?", &[a(&to)], false)?;
        Ok(a(&to))
    })?;
    reg("sqlite:replace", |x| {
        let (build, p) = (text(&at(x, 0)?)?, text(&at(x, 1)?)?);
        unwatch(&build); unwatch(&p); unwatch(&format!("{}.prior", p));
        if std::path::Path::new(&p).exists() {
            rm(&format!("{}.prior", p));
            std::fs::rename(&p, format!("{}.prior", p)).map_err(err)?;
        }
        std::fs::rename(&build, &p).map_err(err)?;
        Ok(a(&p))
    })?;
    let _ = show;
    Ok(())
}
