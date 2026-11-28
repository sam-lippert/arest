// THE WASM BOUNDARY: the same mu over linear memory, for a loader with no other way in (wasm.js runs it
// under bun; a Worker-style runtime could run it the same way). The loader hands lambda's texts in
// (arest_load), names the base (arest_cell), and is asked for the platform: each registration it offers is
// registered here as a forwarder (arest_bridge), and an application of it crosses back to the loader as the
// value written in lambda's own vocabulary (S, A, N) and returns the same way. Nothing here decides an
// answer: the mu is lib.rs's, the registrations the loader's.
//
// A text crossing out is <u32 length, bytes> at a pointer the loader frees with arest_free; a text crossing
// in is allocated by the loader with arest_alloc and owned here from then on.
use crate::{a, carrier_cells, ev, q, read_value, register, write_value, V, R};
use std::rc::Rc;

#[link(wasm_import_module = "env")]
extern "C" {
    // apply the loader's registration `name` to a value written in the vocabulary; answers (ptr << 32) | len
    // of a text the loader allocated: "V" and the answer's value, or "E" and the reason it is bottom
    fn arest_host_call(name_ptr: *const u8, name_len: usize, arg_ptr: *const u8, arg_len: usize) -> u64;
}

#[no_mangle]
pub extern "C" fn arest_alloc(n: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(n.max(1));
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

#[no_mangle]
pub unsafe extern "C" fn arest_free(p: *mut u8, n: usize) { drop(Vec::from_raw_parts(p, 0, n.max(1))); }

unsafe fn take(p: *mut u8, n: usize) -> String {
    let v = Vec::from_raw_parts(p, n, n.max(1));
    String::from_utf8_lossy(&v).into_owned()
}

fn give(flag: u8, text: &str) -> *const u8 {
    let mut out = Vec::<u8>::with_capacity(5 + text.len());
    out.extend_from_slice(&((1 + text.len()) as u32).to_le_bytes());
    out.push(flag);
    out.extend_from_slice(text.as_bytes());
    let p = out.as_ptr();
    std::mem::forget(out);
    p
}

fn answer(r: Result<String, String>) -> *const u8 {
    match r { Ok(t) => give(b'T', &t), Err(e) => give(b'E', &e) }
}

/// Read a lambda text the loader allocated and register its DEFs.
#[no_mangle]
pub unsafe extern "C" fn arest_load(p: *mut u8, n: usize, wp: *mut u8, wn: usize) -> *const u8 {
    let src = take(p, n);
    let what = take(wp, wn);
    answer(crate::load(&src, &what).map(|_| String::new()))
}

/// Add one cell <CELL, name, value> (the base's state:base_db, as the other hosts name it).
#[no_mangle]
pub unsafe extern "C" fn arest_cell(np: *mut u8, nn: usize, vp: *mut u8, vn: usize) -> *const u8 {
    let name = take(np, nn);
    let val = take(vp, vn);
    answer(read_value(&val).map(|v| { crate::push_cell(&name, v); String::new() }))
}

fn bridged(name: String) -> crate::Prim {
    Rc::new(move |x: &V| -> R {
        let mut arg = String::new();
        write_value(x, &mut arg);
        let r = unsafe { arest_host_call(name.as_ptr(), name.len(), arg.as_ptr(), arg.len()) };
        let t = unsafe { take((r >> 32) as usize as *mut u8, (r & 0xffff_ffff) as usize) };
        match t.as_bytes().first() {
            Some(b'V') => read_value(&t[1..]),
            Some(b'E') => Err(t[1..].to_string()),
            _ => Err(format!("{}: the loader answered nothing", name)),
        }
    })
}

/// Register the loader's registration `name` as a forwarder. carrier:cells, storage:engine and hook:seal
/// are this side's: the first two need nothing outside D but the reader, and hook:seal applies lambda's
/// hook:write, which only this mu holds; it asks the loader for the key (platform:master_key).
#[no_mangle]
pub unsafe extern "C" fn arest_bridge(np: *mut u8, nn: usize) -> *const u8 {
    let name = take(np, nn);
    let r = match name.as_str() {
        "carrier:cells" => register(&name, Rc::new(|x: &V| carrier_cells(&crate::text(x)?))),
        "storage:engine" => register(&name, Rc::new(|_: &V| Ok(a("sqlite")))),
        "hook:seal" => {
            let key = bridged("platform:master_key".to_string());
            register(&name, Rc::new(move |x: &V| {
                let k = key(&q(vec![]))?;
                if matches!(&k, V::S(s) if s.is_empty()) { return Err("hook:seal: there is no AREST_MASTER_KEY to store a value through a Function with".into()); }
                ev(&a("hook:write"), &q(vec![k, crate::at(x, 0)?, crate::at(x, 1)?, crate::at(x, 2)?]))
            }))
        }
        _ => register(&name, bridged(name.clone())),
    };
    answer(r.map(|_| String::new()))
}

/// The six-line contract: lambda's main over the cells and an argv of texts separated by US (0x1F).
#[no_mangle]
pub unsafe extern "C" fn arest_ask(p: *mut u8, n: usize) -> *const u8 {
    let s = take(p, n);
    let argv: Vec<&str> = if s.is_empty() { Vec::new() } else { s.split(char::from(31u8)).collect() };
    match crate::ask(&argv) {
        Ok((text, ok)) => give(if ok { b'T' } else { b'F' }, &text),
        Err(e) => give(b'E', &e),
    }
}

thread_local! {
    static STORE: std::cell::RefCell<Option<V>> = const { std::cell::RefCell::new(None) };
}

/// Boot the store once (main:boot over the cells), for laws applied one by one.
#[no_mangle]
pub extern "C" fn arest_boot_store() -> *const u8 {
    answer(crate::boot_store().map(|s| { STORE.with(|t| *t.borrow_mut() = Some(s)); String::new() }))
}

/// Apply a named law (any lambda name) to the booted store; T or F is its answer, E its bottom, S a sequence.
#[no_mangle]
pub unsafe extern "C" fn arest_law(p: *mut u8, n: usize) -> *const u8 {
    let name = take(p, n);
    let store = match STORE.with(|t| t.borrow().clone()) { Some(s) => s, None => return give(b'E', "no store: arest_boot_store first") };
    match ev(&a(&name), &store) {
        Ok(V::Q(v)) => give(b'S', &v.len().to_string()),
        Ok(v) => give(b'V', &crate::show(&v)),
        Err(e) => give(b'E', &e),
    }
}
