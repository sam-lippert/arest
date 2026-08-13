# Intersection source: the discipline of record

The canonical stratum is written once, in `shared/*.canon` — files that are
simultaneously a valid Python expression and normal Rust (and, wrapped in a
method, normal C# or Java). The extension is neutral because the files belong
to no host (Samuel, 2026-07-07). Every host executes the SAME RAW BYTES natively (task 14, 2026-07-14) — no
JSON store, no bespoke reader, no generation artifact. Each language's own
source-execution mechanism tokenizes the .canon files with a tiny vocabulary
bound:

- Python `exec`s them (canon.py's read/load with the vocabulary bound).
- Rust `include!`s them (rustc tokenizes them at compile time).
- Java compiles them IN MEMORY via javax.tools (CanonLoader wraps the raw
  bytes in a Vocab-referencing body; DEF's side effect registers each def).
- C# compiles them IN MEMORY via Roslyn (RoslynLoader, the same shape).

If the four hosts do not take the same bytes, that is a divergence and a
failure to implement the spec: these are all languages with value types and
parenthesized functions, so the intersection grammar is native to each. A
host is a reducer (mu) over the canon it executes; performance comes from
registered DEFS overrides, never a JSON intermediate.

Each authoring platform defines a tiny vocabulary; the lambda bound
determines the implementation.

## The file shape

One tuple literal per file. Elements evaluate left to right in both languages. Every
element is either a DEF(name, tree) call or a double-quoted description string.
Nothing else: no imports, no assignments, no host functions, no comments (the comment
syntaxes do not intersect), and double-quoted strings only, since a multi-character
single-quoted string is a broken char literal to the C-family tokenizers.

Because the comment syntaxes do not intersect, a **description string IS the comment
mechanism** — it is the only way to carry commentary inside a canon file. A string
element is legal in every host: a tuple element in Python and Rust (the latter under
`#[allow(path_statements)]`), a varargs argument in C# and Java, an operand of JS's
comma operator. (This paragraph previously said only the FIRST element may be a
string. That predated the merge of the several `shared/*.canon` files into one canon
at the repo root, which necessarily carried each merged file's own docstring inline:
canon is 1206 top-level elements = 1152 DEF + 54 string + 0 other, and the strings are
those docstrings plus dated design notes. `engine/tests/test_intersection_shape.py`
holds every canon file to the invariant as stated here.) No trailing comma before the file's closing
paren: the C# and Java hosts consume the same bytes as a varargs method call (a
generated `T` + file + `;` wrap, their include!), and neither language accepts a
trailing comma in an argument list. Python and Rust accept both forms, so the
strictest reader sets the rule.

## The vocabulary, per platform

* DEF(name, tree) — register the canonical definition.
* A(s) — a string atom. N(i) — a numeric atom (selectors).
* K(x) — the CONST wrapper: a constant in a built tree.
* PHI() — the empty sequence, nullary so a file may use it any number of times
  (a Rust local would be moved by its first use).
* S1(x) .. S9(a..i) — sequence constructors of EXACT arity. Python enforces the
  arity as strictly as Rust's function signatures: a miscounted file is rejected
  identically by both hosts. (The arity families exist because Rust functions are
  not variadic; the exactness turned out to be a feature, catching a mislabeled
  sequence that a variadic binding silently accepted.)

Python binds the vocabulary in python/canon.py and execs the file; Rust defines the
same names as closures in canon_defs() and include!s the identical bytes; the
definitions land in each host's store and resolve BY NAME through rho at reduction
(Backus 13.3.5: definitions are cells). Cross-references between definitions are
name atoms, so the files need no ordering beyond load order across files (theta,
then constraints, then ast).

## The builder idiom

A parameterized constructor is a canonical definition that, applied to its
parameter, yields the object. The CONS form does the splicing: the parameter lands
wherever `id` sits, constants come from K, sub-builders compose by name, ALPHA maps
per-element builders over sequence parameters, distl distributes a shared parameter
across a list, apndl prepends a form head (the selrow pattern), COND over null
handles optional parameters (absence encoded as the empty sequence), and the apply
primitive gives higher-order use (a built object applied within a definition).
Metacomposition is the only mechanism, per the paper.

## The gates

Every migration is behavioral: strict authorship tests apply the canonical NAME
with the encoded parameter and demand the absolute result (a reference-bearing or
equality-only check can pass vacuously). The cross-kernel differential ships
name-atom cases so each kernel resolves the same bytes through its own loading. A
red cargo build voids the differential's green: include! bakes the shared files at
compile time, so a stale binary tests yesterday's canon.

## The rule for hosts

A host is an implementation of the reduction plus what it registers into DEFS.
Per-host optimizations (delta, FAST, the native carrier) are DEFS registrations
over the same names, never forks of the source. A new platform joins by defining
the vocabulary, consuming the same files, and passing the differential.

## The twin gate

A per-host optimization is legitimate only while it stays byte-equal to the canon
name it overrides, and that equality is now a RUNTIME fact on real app compiles,
not a synthetic-input claim. Each fast twin (the theta join/dedup arms, vb_fetch,
entity_view, ...) is a `prim` arm that returns `Some` to win and defers to the
canon DEF by returning `None`. One kill-switch convention bypasses any registered
override by its canon name — `AREST_NO_OVERRIDE=<name>[,...]`, or `*` for the pure
reference oracle — so the very same compile runs through the shared lambda instead:
slower, identical. (Per-name aliases such as `AREST_NO_THETA_ARMS` remain honored
during the migration.) The canon side carries the catalog of override-eligible
names (`shared/base/resolution.md`, `Operation is overridable`); a host's
registered names must be a subset of it, and the Rust host asserts exactly that in
its test suite. Two standing harnesses hold the line from opposite directions:

* `tools/apps_compile_parity.py` — native `apps_compile` vs Python `Registry.compile`
  over real readings through the real flow: the CROSS-HOST axis, both hosts must
  agree. Needs Python present; Python IS the reference of record.
* `tools/twin_equality.py` — native with the twins ON vs the twins flipped to their
  canon DEFs: the INTRA-HOST override axis, the fast path must equal the slow canon
  reference. Needs only the Rust binary and shared/*.canon — no Python in the loop.
  It also times both runs; twins-off must be measurably slower, else the arm never
  fired and EQUAL is vacuous.

Run the twin gate after any change to a `prim` twin arm or a theta canon DEF: a
cross-host parity run alone cannot catch a twin that has drifted from its canon
meaning, because both hosts could carry the same fast twin and the same drift.

## The fourth host, recorded ahead of need

C# consumes the files as written: the tuple literal is a valid C# expression of
nested static calls, and a source generator wraps the bytes in a method at build
time. Java has no tuple expressions, so when a JVM host approaches, the files wrap
their elements in a single CANON(...) call instead of the bare tuple — one more
vocabulary name, valid in Python, Rust, C#, and Java alike, and a mechanical
one-line change per file. The intersection was defined carefully once and gets
defined slightly more carefully when the fourth host shows up; nothing else moves.
