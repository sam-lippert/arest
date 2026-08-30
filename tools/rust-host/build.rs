// THE CHUNKER. Canon is intersection source: one file that is simultaneously
// valid in every host language, so that each host's OWN COMPILER reads it.
// This is what makes that true for rustc, and it is BUILD TIME ONLY -- canon on
// disk is one unsplit file and is never touched. What is emitted here is a
// build artifact in OUT_DIR, exactly as the js host's .g.js is.
//
// WHY IT HAS TO CHUNK AT ALL, measured rather than assumed. rustc's cost is
// quadratic in the SOURCE LENGTH of one function body, so canon compiled as a
// single expression does not finish: full canon unchunked ran over 50 minutes
// without producing a binary, while the same 600 elements cost 3m40s in one
// body and 53s split across six. Chunking turns n^2 into k*(n/k)^2 = n^2/k.
//
// THREE THINGS HAD TO BE TRUE, and each was found by measuring the one before:
//
//   1. split at the tuple's top-level commas          1843 canon elements
//   2. group by BYTES, not element count              18m57s -> 8m31s
//   3. split a wide sequence's MEMBERS across fns     8m31s -> 5m39s
//
// (2) because the carriers are not shaped like canon: canon has 1843 elements
// with a median of 299 bytes, but design-state has TWENTY-SEVEN with a median
// of 10 KB and a max of 153 KB, and norma-answer has FOUR. Counting elements
// groups those into one body of a quarter megabyte.
//
// (3) because lifting oversized ARGUMENTS does nothing when an element is huge
// from thousands of SMALL ones, which is exactly the arity-free S. Before it,
// 12 bodies over 16 KB held 26% of all emitted body bytes and the largest was
// 153 KB -- worth ~366 of the 8 KB ones at quadratic cost. After it: 450 fns,
// median 4.2 KB, max 12.6 KB, none over 16 KB.
//
// UN-NESTING IS THE WRONG FIX AND WAS TESTED. Flattening each element into let
// bindings turned 600 elements into 28,337 locals in one body and got SLOWER
// than the nested form -- rustc scales in the source length of a body, so
// removing depth inflates exactly the term that hurts.
//
// The transform is SYNTAX ONLY: it counts parens and quotes, never inspects a
// name and never evaluates anything. Every canon byte is emitted verbatim; only
// the tuple's top-level commas become statement boundaries. REGISTRATION ORDER
// IS THE CONTRACT -- CELLS is built in DEF order and the composed store must
// stay byte-equal to the other three hosts, so the chunk fns are called in
// source order and the files in the js concatenation order.
use std::fmt::Write as _;
use std::path::Path;

// Budgets in BYTES, not element counts, because source length is what rustc's
// per-body cost actually tracks. LIFT is the size above which an argument is
// pulled out into its own fn.
const BODY_BUDGET: usize = 8 * 1024;
const LIFT: usize = 4 * 1024;

// canon, then the case table, then the carriers -- the js concatenation order
// (head, arest, midcases, scenarios, mid1, design-state, mid2, norma-answer).
const SOURCES: [(&str, &str); 4] = [
    ("canon", "../../arest"),
    ("scenarios", "../../engine/shared/scenarios.canon"),
    ("design_state", "../norma-oracle/design-state"),
    ("norma_answer", "../norma-oracle/norma-answer"),
];

/// Split a canon body on its TOP-LEVEL commas. Depth counts parens; a comma
/// inside a string literal is text, not a boundary, and a backslash escapes the
/// next byte -- the three things a naive split gets wrong.
fn top_level(body: &str) -> Vec<&str> {
    let b = body.as_bytes();
    let (mut out, mut depth, mut in_str, mut start) = (Vec::new(), 0i32, false, 0usize);
    let mut i = 0usize;
    while i < b.len() {
        let c = b[i];
        if in_str {
            match c {
                b'\\' => i += 1,
                b'"' => in_str = false,
                _ => {}
            }
        } else {
            match c {
                b'"' => in_str = true,
                b'(' => depth += 1,
                b')' => depth -= 1,
                b',' if depth == 0 => {
                    out.push(body[start..i].trim());
                    start = i + 1;
                }
                _ => {}
            }
        }
        i += 1;
    }
    let tail = body[start..].trim();
    if !tail.is_empty() {
        out.push(tail);
    }
    out
}

/// THE ONE REWRITE, and it is not a canon concern: NORMA's serializer emits an
/// arity-free `S(a, b, c, ...)` for the carriers, because "a sequence must stay
/// FLAT regardless of length, so that length is never encoded as depth" -- depth
/// already means tenancy (backus78 14.7). Canon itself never uses it: it honors
/// the S1..S9 ceiling, and greps 0 here against 20 in design-state and 4 in
/// norma-answer. Rust has no variadics, so `S(` becomes `Sv(vec![`. Still syntax
/// only -- every byte between the parens is untouched.
fn rewrite_variadic_s(text: &str) -> (String, usize) {
    let b = text.as_bytes();
    let (mut out, mut depth_stack, mut in_str, mut n) = (String::new(), Vec::new(), false, 0usize);
    let mut i = 0usize;
    while i < b.len() {
        let c = b[i];
        if in_str {
            out.push(c as char);
            match c {
                b'\\' => {
                    i += 1;
                    if i < b.len() {
                        out.push(b[i] as char);
                    }
                }
                b'"' => in_str = false,
                _ => {}
            }
            i += 1;
            continue;
        }
        match c {
            b'"' => {
                in_str = true;
                out.push('"');
            }
            b'S' if i + 1 < b.len()
                && b[i + 1] == b'('
                && (i == 0 || !(b[i - 1] as char).is_alphanumeric() && b[i - 1] != b'_') =>
            {
                out.push_str("Sv(vec![");
                depth_stack.push(true);
                n += 1;
                i += 1; // consume the '('
            }
            b'(' => {
                depth_stack.push(false);
                out.push('(');
            }
            b')' => {
                if depth_stack.pop() == Some(true) {
                    out.push_str("])");
                } else {
                    out.push(')');
                }
            }
            _ => out.push(c as char),
        }
        i += 1;
    }
    (out, n)
}

/// CHUNKING BY ELEMENT COUNT IS NOT ENOUGH, and the carriers are why. Canon has
/// 1843 elements with a median of 299 bytes, so counting works there. But
/// design-state has TWENTY-SEVEN elements with a median of 10 KB and a maximum
/// of 153 KB, and norma-answer has FOUR -- grouping those into sixteens leaves
/// one function body of a quarter megabyte, which is the very thing chunking
/// exists to avoid. Measured: element-count chunks built the host in 18m57s.
///
/// So an oversized ARGUMENT is lifted into its own fn and called in place. This
/// runs on the RAW form, where every item is a uniform Name(args): the variadic
/// rewrite has to come last, over the finished text, because `Sv(vec![..])`
/// carries a bracket that a splitter which only understands calls cannot walk.
fn hoist(expr: &str, helpers: &mut Vec<String>, ctr: &mut usize, lift: usize) -> String {
    if expr.len() <= lift {
        return expr.to_string();
    }
    let open = match expr.find('(') {
        Some(i) => i,
        None => return expr.to_string(),
    };
    let head = &expr[..open];
    if !expr.ends_with(')')
        || head.is_empty()
        || !head.chars().all(|c| c.is_alphanumeric() || c == '_')
    {
        return expr.to_string(); // a string literal or anything not a call
    }
    let inner = &expr[open + 1..expr.len() - 1];
    let args = top_level(inner);
    if args.is_empty() {
        return expr.to_string();
    }
    let mut out = Vec::with_capacity(args.len());
    for a in args {
        let h = hoist(a, helpers, ctr, lift);
        if h.len() > lift {
            *ctr += 1;
            let name = format!("h{}", *ctr);
            helpers.push(format!(
                "#[allow(non_snake_case, unused)]\nfn {}() -> V {{\n    {}\n}}\n",
                name, h
            ));
            out.push(format!("{}()", name));
        } else {
            out.push(h);
        }
    }
    let joined = format!("{}({})", head, out.join(", "));

    // A WIDE SEQUENCE IS STILL ONE BODY. Lifting arguments does nothing when an
    // element is huge because it has THOUSANDS OF SMALL ones -- which is exactly
    // the carriers' shape: design-state's largest element is 153 KB of flat
    // members, none of them over the lift threshold. Measured: 12 bodies over
    // 16 KB held 26% of all emitted body bytes, and cost is quadratic per body,
    // so a 153 KB body is worth ~366 of the 8 KB ones.
    //
    // So the MEMBERS are split across part fns and concatenated back. The
    // sequence stays FLAT and in order -- Scat sees the same members in the same
    // order, and flatness is the whole point of the arity-free S (length must
    // never be encoded as depth, because depth already means tenancy).
    if joined.len() > lift && head == "S" && out.len() > 8 {
        let mut parts = Vec::new();
        let mut i = 0usize;
        while i < out.len() {
            let start = i;
            let mut used = 0usize;
            while i < out.len() && (used == 0 || used + out[i].len() <= lift) {
                used += out[i].len();
                i += 1;
            }
            *ctr += 1;
            let pname = format!("h{}", *ctr);
            helpers.push(format!(
                "#[allow(non_snake_case, unused)]\nfn {}() -> Vec<V> {{\n    vec![{}]\n}}\n",
                pname,
                out[start..i].join(", ")
            ));
            parts.push(format!("{}()", pname));
        }
        return format!("Scat(vec![{}])", parts.join(", "));
    }
    joined
}

fn main() {
    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR");
    let mut emitted = String::from(
        "// GENERATED by build.rs -- syntax only, every canon byte verbatim.\n\
         // Do not edit, and do not commit: this is a build artifact.\n",
    );
    let mut loaders: Vec<String> = Vec::new();
    let mut hctr = 0usize;

    for (stem, rel) in SOURCES {
        println!("cargo:rerun-if-changed={}", rel);
        let text = match std::fs::read_to_string(Path::new(rel)) {
            Ok(t) => t,
            Err(e) => panic!("chunker: cannot read {}: {}", rel, e),
        };
        let trimmed = text.trim();
        // an EMPTY carrier is legitimate -- a fresh journal has no entries
        if trimmed.is_empty() {
            continue;
        }
        assert!(
            trimmed.starts_with('(') && trimmed.ends_with(')'),
            "chunker: {} is not one tuple literal",
            rel
        );
        let body = &trimmed[1..trimmed.len() - 1];
        let els = top_level(body);
        // hoist FIRST, on the raw form, then group by source length with
        // registration order kept
        let mut helpers: Vec<String> = Vec::new();
        let hoisted: Vec<String> = els
            .iter()
            .map(|e| hoist(e, &mut helpers, &mut hctr, LIFT))
            .collect();
        for h in &helpers {
            emitted.push_str(h);
        }
        let mut calls = Vec::new();
        let (mut k, mut i) = (0usize, 0usize);
        while i < hoisted.len() {
            let fname = format!("load_{}_{}", stem, k);
            let _ = write!(
                emitted,
                "#[allow(non_snake_case, unused, path_statements)]\nfn {}() {{\n",
                fname
            );
            let mut used = 0usize;
            while i < hoisted.len() && (used == 0 || used + hoisted[i].len() <= BODY_BUDGET) {
                let _ = writeln!(emitted, "    let _ = {};", hoisted[i]);
                used += hoisted[i].len();
                i += 1;
            }
            emitted.push_str("}\n");
            calls.push(format!("    {}();", fname));
            k += 1;
        }
        let _ = write!(
            emitted,
            "#[allow(non_snake_case, unused)]\nfn load_{}_all() {{\n{}\n}}\n",
            stem,
            calls.join("\n")
        );
        loaders.push(format!("    load_{}_all();", stem));
        println!(
            "cargo:warning={}: {} elements, {} hoisted, {} chunks",
            stem,
            els.len(),
            helpers.len(),
            k
        );
    }

    let _ = write!(
        emitted,
        "#[allow(non_snake_case, unused)]\nfn load_compiled_canon() {{\n{}\n}}\n",
        loaders.join("\n")
    );
    // the varargs rewrite runs LAST, over the finished text, so helper and
    // chunk bodies are rewritten alike
    let (emitted, nv) = rewrite_variadic_s(&emitted);
    println!("cargo:warning={} variadic S( rewritten", nv);
    std::fs::write(Path::new(&out_dir).join("canon.rs"), emitted).expect("write canon.rs");
}
