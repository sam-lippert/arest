"""THE COVERAGE GATE (Samuel, 2026-07-08: "Is there a test that makes
sure that all functionality is available in the shared canon?"): every
name a host kernel dispatches is one of exactly three things —

  (1) the FP BASE vocabulary: the substrate the canon is written in
      (Backus's algebra: selectors, sequence ops, logic, arithmetic);
  (2) a declared D5 BOUNDARY transducer: transduction only, no policy
      (the lex family, cellkey, escape_html, skolem, strip_prefix;
      stage1_fields by the 2026-07-07 ruling — "a canonical composition
      is not owed at the boundary, exactly as lex itself");
  (3) CANON-NAMED: a certified-equal override for speed whose DEF of
      record must exist in shared/*.canon, twinned by its own pin.

A host op that fits none of these fails here: functionality lands in
the shared lambda source first, or it does not land. The semantic half
of the discipline stays with the per-override twin pins (classify,
render, vb_fetch, entity_view, ...); this gate is the structural half —
nothing can even be NAMED host-side without a canon story."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# the term grammar's combinator tags (evaluator internals, not ops; a
# host may or may not dispatch them by name — DEFS, for one, is
# structural in the java/C# reducers)
TAGS = {"ALPHA", "BU", "COMP", "COND", "CONS", "CONST", "INSERT",
        "WHILE", "DEFS"}
BASE = {"id", "tl", "atom", "null", "eq", "apndl", "apndr", "distl",
        "distr", "length", "reverse", "cat", "not", "and", "1r",
        # rotl/rotr left the host base the way `or` did: Backus 11.2.3 lists
        # them as language primitives, but canon DEFs them (rotl = apndr∘[tl,1],
        # rotr = apndl∘[1r,tlr]), so no host owes an implementation.
        "tlr", "trans", "+", "-", "*", "/", "ge",
        "gt", "le", "lt", "apply"}
D5 = {"lex", "implode", "skolem",
      "stage1_fields",
      # the char-level lex boundary. All four kernels dispatch these and
      # always did, but the table never named them, so every kernel was
      # reported as dispatching ops "with no canon story". They are the
      # same string algebra as strip_prefix and implode, one character
      # wide, and they are what the naming lex is built from (lex:lw is
      # implode . ALPHA chardown . chars).
      "chars"}
      # render:json LEFT this table (2026-08-09) because it left the hosts:
      # it is canon now — DEF("render:json") with render:json_atom /
      # render:json_seq, beside system:show. The row's own comment already
      # said what it was, "pure format transduction (the implode class)",
      # and a pure transduction from a value to a string has no boundary in
      # it. It was implemented five times (python, java, C#, and rust twice,
      # Scott and native); all five are deleted. cellkey is next: it also has
      # a canon DEF now (implode . <K(':'), id>), and once the hosts drop
      # their copies it leaves this table the same way.
# certified-equal overrides: the host name -> the canon DEF of record
OVERRIDES = {
    "render:html": "system:render_html",
    "system:vb_fetch": "system:vb_fetch",
    "system:entity_view": "system:entity_view",
    "system:ev_cols": "system:ev_cols",
    "get_view": "system:entity_view",
    "_classify_heads": "system:classify_heads",
    "verify": "system:verify_store",
    # theta join/dedup primitives: canon DEFs (arest.canon) with certified-equal
    # native overrides in Rust `fn prim`, each gated by the `theta_arms_off` kill
    # switch (flip it and the differential oracle falls back to the canon DEF) —
    # the same certified-twin pattern as system:ev_cols above, the "fast override
    # per platform" for the hot join/dedup path (the store-twin / join slices).
    "theta:append_phi": "theta:append_phi",
    "theta:dedup": "theta:dedup",
    "theta:flatten": "theta:flatten",
    "theta:join_combine": "theta:join_combine",
    "theta:member": "theta:member",
    # theta:NatJoin belongs here for the same reason the five above do, and was
    # missing: engine/rust recognizes its BUILT TERM at application (fn
    # natjoin_run, 558 lines) and reduces it as a native hash join, gated by
    # the same kill switch. The registry never caught it because NatJoin is
    # recognized INSIDE the evaluator rather than dispatched as an op, so the
    # dispatch gate below never sees the name. An undeclared native twin is
    # indistinguishable from drift by inspection, which is the whole point of
    # this table.
    "theta:NatJoin": "theta:NatJoin",
    # store_into is ast:Store run natively -- Backus 13.3.4's pop-then-push, as
    # its own comment says -- and it was undeclared for the same reason
    # theta:NatJoin was: it is reached through the store-mutation path, not
    # dispatched as an op, so the gate below never sees the name. The native
    # form also keeps the cached index and the nd/ncells mirrors coherent,
    # which the canon def does not model; what is twinned is the cell-sequence
    # answer, pinned on four stations by case:ast-store-replace/absent/stack.
    "ast:Store": "ast:Store",
}


def _canon_defs():
    # THE canon is the repo-root file `arest`, not engine/shared. shared/ now
    # holds only scenarios.canon (the cross-host case table) — the four
    # shared/*.canon files this once read are gone, so this returned a set of
    # `case:` names and every "has no canon DEF" assertion below was really
    # asserting "is not a scenario". engine/rust says it plainly at its own
    # include!: "THE canon, at the repo root. Not a curated copy."
    names = set()
    root_canon = os.path.join(ROOT, "..", "arest")
    if os.path.exists(root_canon):
        src = open(root_canon, encoding="utf-8").read()
        names |= set(re.findall(r'DEF\("([^"]+)"', src))
    shared = os.path.join(ROOT, "shared")
    for f in os.listdir(shared):
        if f.endswith(".canon"):
            src = open(os.path.join(shared, f), encoding="utf-8").read()
            names |= set(re.findall(r'DEF\("([^"]+)"', src))
    return names


def _src(*parts):
    return open(os.path.join(ROOT, *parts), encoding="utf-8").read()


def _rust_ops():
    src = _src("rust", "src", "main.rs")
    ops = set(re.findall(r'register\("([^"]+)"', src))
    # DIRECT arms of fn prim's dispatch match only, by BRACE DEPTH
    # twice over (indent and next-method heuristics both break: prim
    # bodies nest matches and tuple data — "unary"/"ref" inside
    # entity_view are values — and top-level helper fns sit between
    # methods). First bound fn prim at ITS closing brace, then walk the
    # dispatch block collecting arms entered at depth 1.
    i = src.find("fn prim(&self")
    depth = 0
    end = i
    opened = False
    for off, ch in enumerate(src[i:], start=i):
        if ch == "{":
            depth += 1
            opened = True
        elif ch == "}":
            depth -= 1
            if opened and depth == 0:
                end = off
                break
    body = src[i:end]
    k = body.find("match s {")
    depth = 0
    for line in body[k:].splitlines():
        if depth == 1 and "=>" in line and re.match(r'\s*"', line):
            for lit in re.findall(r'"([^"]+)"', line.split("=>")[0]):
                ops.add(lit)
        depth += line.count("{") - line.count("}")
    return ops


def _java_ops():
    return set(re.findall(r'name\.equals\("([^"]+)"\)',
                          _src("java", "Reducer.java")))


def _csharp_ops():
    return set(re.findall(r'case "([^"]+)":', _src("csharp", "Reducer.cs")))


def _python_ops():
    # BOTH files, because the base moved. escape_html / implode / lex / slug /
    # strip_prefix are registered by kernel.register_base() now, not by the
    # spine — engine.py's own foot-note says so ("the base belongs to the
    # kernel; the spine must not shadow it"). Scanning only engine.py made
    # this test report five boundary ops as missing when they had merely
    # moved to where they belong.
    ops = set(re.findall(r'register\("([^"]+)"', _src("python", "engine.py")))
    # kernel.py does NOT call register(name, ...) — register_base() builds one
    # dict literal, so the names are keys: "implode": _implode, ...
    kern = _src("python", "kernel.py")
    ops |= set(re.findall(r'"([a-z_0-9:]+)"\s*:\s*_[a-z_]', kern))
    return ops


def test_every_kernel_dispatches_the_shared_vocabulary():
    # the intersection contract's op half: the same base + boundary
    # vocabulary in all four kernels (python's BASE is structural in
    # prims.py, so python owes only the boundary set here)
    want = BASE | D5
    for name, ops in (("rust", _rust_ops()), ("java", _java_ops()),
                      ("csharp", _csharp_ops())):
        missing = want - ops
        assert not missing, f"{name} kernel lacks shared ops: {sorted(missing)}"
    missing = D5 - _python_ops()
    assert not missing, f"python host lacks boundary ops: {sorted(missing)}"


def test_no_host_op_escapes_the_discipline():
    allowed = BASE | D5 | TAGS | set(OVERRIDES)
    for name, ops in (("rust", _rust_ops()), ("java", _java_ops()),
                      ("csharp", _csharp_ops()), ("python", _python_ops())):
        stray = ops - allowed
        assert not stray, (
            f"{name} dispatches ops with no canon story: {sorted(stray)} — "
            "define the meaning in shared/*.canon (canon-named override) "
            "or declare the D5 transducer here with its ruling")


def test_canon_named_overrides_have_their_defs():
    defs = _canon_defs()
    for host_name, canon_name in OVERRIDES.items():
        assert canon_name in defs, (
            f"override {host_name!r} names {canon_name!r} but shared/*.canon "
            "carries no such DEF — the meaning must land in canon first")


# (the canon-store-sidecar freshness test retired with the store artifacts:
# task 14 replaced the JSON boot tier with same-bytes native execution on
# every host, so there is no sidecar to hold fresh against the source.)


# ---------------------------------------------------------------------------
# THE VERB LAYER (the 2026-07-13 census, canon-first rebuild phase 1).
# Every verb mcp_call_inner dispatches is one of exactly three things:
#
#   (1) CATALOG: a resolution.md operation. Its reference is the canon
#       pipeline the verb reduces; a host binding is an override row.
#   (2) SERVE: store addressing and inventory (the tenancy surface —
#       a cell in one store may contain another entire store). These
#       verbs move between stores and report on them; they carry no
#       domain meaning to twin.
#   (4) REGISTERED (Samuel, 2026-07-13): the enumerable boundary at the
#       verb layer. An operation whose impl is supplied by the host
#       runtime — an LLM shaping synthesize wording, an LLM-judge
#       validate pass, sqlite materializing sql — registers through
#       DEFS with origin=registered (paper Def. 10, Cor. 8) and is the
#       ONE valid case to delegate without a shared canon: partial,
#       external, enumerable by the boundary Filter, never widening
#       the formal core. sql's delegated-by-design ruling is an
#       instance of this class.
#   (3) DELEGATED: meaning that still rides the Python reference host.
#       This set is the standing drain queue, ordered by the rebuild
#       plan: explain drained 2026-07-13 (catalog row + native walk
#       corroborated by canon system:explain); induce drained
#       2026-07-13 (the canon carries every judgment in the pipeline —
#       role_domain, enum_product, cand_gate, cand_covers, cand_score,
#       induce_judge — with the python inline loop the certified
#       override and AREST_NO_OVERRIDE selecting the canon-reducing
#       reference); sql stays delegated BY DESIGN (2026-07-13 ruling):
#       its meaning is canon (theta-1 over the RMAP projection) but its
#       materialization is a sqlite artifact, and the host build is
#       zero-dep by the 2026-07-09 decision recorded in Cargo.toml, so
#       the delegate is sql's reference and any native leg is an
#       opt-in cargo feature; compile drained 2026-07-13 on the
#       strength of the ch. 06 pipeline canonization (the canon defs
#       the native compile twins at byte parity, apps_compile_parity
#       the standing pin); propose drained 2026-07-13 (its judgment,
#       the sorted fact-type delta, is system:propose_report over the
#       compile machinery's throwaway world); ask drained 2026-07-13
#       (the plan query's filter algebra is canon: system:ask_pos
#       resolves role positions with the missing-noun # sentinel,
#       system:ask_row_ok judges a row against every spec, and
#       system:ask_filter keeps rows through it; the inline str()
#       comparison stays the wire-accommodation override); the tutor
#       four reclassified SERVE 2026-07-13: each is a first-class verb
#       SCOPED to the _tutor sandbox app (apply, compile, propose,
#       whose meanings are already canon) or sandbox lifecycle
#       (reset, the apps_create class), and scoping is addressing,
#       never meaning. THE QUEUE IS EMPTY (Samuel's all-verbs-canon
#       directive, discharged 2026-07-13): every dispatched verb is
#       CATALOG (meaning in the canon), SERVE (addressing), or
#       REGISTERED (the enumerable boundary, by design). A verb could
#       only re-enter this set by shipping new meaning host-side,
#       which the gate makes a loud choice.
#
# A verb that fits none of these fails here, exactly as a DEF-layer op
# with no canon story fails above.
SERVE = {"context", "orient", "engine_version", "apps_list", "apps_current",
         "apps_use", "apps_status", "apps_check", "apps_register",
         "apps_create",
         "tutor_apply", "tutor_compile", "tutor_propose", "tutor_reset"}
REGISTERED = {"sql"}
DELEGATED = set()


def _catalog():
    src = _src("..", "metamodel", "resolution.md")
    return set(re.findall(r"Operation '([^']+)' is overridable", src))


def _fn_body(src, needle):
    i = src.find(needle)
    assert i >= 0, f"cannot locate {needle!r}"
    depth = 0
    opened = False
    end = i
    for off, ch in enumerate(src[i:], start=i):
        if ch == "{":
            depth += 1
            opened = True
        elif ch == "}":
            depth -= 1
            if opened and depth == 0:
                end = off
                break
    return src[i:end]


def _rust_verbs():
    body = _fn_body(_src("rust", "src", "main.rs"), "fn mcp_call_inner(")
    verbs = set()
    for m in re.finditer(r"matches!\(tool,([^)]*)\)", body):
        verbs |= set(re.findall(r'"([^"]+)"', m.group(1)))
    k = body.find("match tool {")
    depth = 0
    for line in body[k:].splitlines():
        if depth == 1 and "=>" in line and re.match(r'\s*"', line):
            verbs |= set(re.findall(r'"([^"]+)"', line.split("=>")[0]))
        depth += line.count("{") - line.count("}")
    return verbs


def test_no_verb_escapes_the_discipline():
    stray = _rust_verbs() - (_catalog() | SERVE | DELEGATED | REGISTERED)
    assert not stray, (
        f"mcp_call_inner dispatches verbs with no canon story: {sorted(stray)}"
        " — give the verb a canon reference and a catalog row, or rule it"
        " SERVE here with its reasoning")


def _rust_def_override_rows():
    src = _src("rust", "src", "main.rs")
    m = re.search(r"const DEF_OVERRIDES[^=]*= &\[(.*?)\];", src, re.S)
    assert m, "the DEF_OVERRIDES table must exist (ch. 15 step 3)"
    return set(re.findall(r'\("([^"]+)"', m.group(1)))


def test_def_override_rows_are_registered_meaning():
    # A table row is only speed: its meaning must already exist as a canon
    # DEF of the same name, and the catalog must license the override.
    defs = _canon_defs()
    cat = _catalog()
    for name in _rust_def_override_rows():
        assert name in defs, (
            f"DEF_OVERRIDES row {name!r} has no canon DEF — the meaning"
            " must land in shared/*.canon first")
        assert name in cat, (
            f"DEF_OVERRIDES row {name!r} has no catalog row — declare it"
            " overridable in metamodel/resolution.md")


def _rust_verb_override_rows():
    src = _src("rust", "src", "main.rs")
    m = re.search(r"const VERB_OVERRIDES[^=]*= &\[(.*?)\];", src, re.S)
    assert m, "the VERB_OVERRIDES table must exist (ch. 15 step 3)"
    return set(re.findall(r'\("([^"]+)"', m.group(1)))


def test_verb_override_rows_are_catalog_members():
    cat = _catalog()
    for name in _rust_verb_override_rows():
        assert name in cat, (
            f"VERB_OVERRIDES row {name!r} has no catalog row — declare it"
            " overridable in metamodel/resolution.md")


def test_delegated_verbs_are_a_drain_queue():
    # A delegated verb that gains its canon reference moves to the catalog
    # and must leave DELEGATED, so the two sets stay disjoint and the queue
    # only shrinks.
    overlap = DELEGATED & _catalog()
    assert not overlap, (
        f"verbs are both catalog and delegated: {sorted(overlap)} — remove"
        " them from DELEGATED; the catalog row supersedes the queue entry")


# ---------------------------------------------------------------------------
# THE ORPHAN GATE (2026-08-12). The gates above prove a host stopped
# DISPATCHING an op. Nothing proved it stopped IMPLEMENTING one, and that blind
# spot cost 79 lines in one day: slug's 15-line body survived in engine/java and
# engine/csharp for three increments after "deleted", ten dead impls sat in
# kernel.py, and _d_cons/_d_const/_p_cons/_p_const outlived CONS/CONST becoming
# canon. A dead helper still compiles, still gets read, still gets maintained.
#
# Reference-count per file and you drown in false positives, so the exemptions
# below are the four real reasons a definition is live without a syntactic call:
#   - the registration VOCABULARY (A/K/PHI/S1..S9): called by the CANON text
#     concatenated in at compose time, which is not in the host file;
#   - ENTRY POINTS invoked by the runtime or the harness, not by the host;
#   - TABLE MEMBERS (engine/rust's ov_* overrides) named in a table, not called;
#   - the Scott/lambda surface, which is public API for six pyarest modules.
_ORPHAN_OK = {
    "A", "N", "K", "PHI", "S", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8",
    "S9", "CANON", "DEF", "register", "Register", "registerAlpha",
    "RegisterAlpha", "run", "main", "loadCanon", "LoadCanon", "memoClear",
    "to_lam", "from_lam",
}
_ORPHAN_PAT = {
    ".js": r"^function (\w+)\s*\(",
    ".java": r"^\s{4}(?:public |private )?static \w[\w<>\[\], ]*? (\w+)\s*\(",
    ".cs": r"^\s{4}(?:internal |public |private )?static \w[\w<>\[\]?, ]*? (\w+)\s*\(",
    ".rs": r"^fn (\w+)\s*[(<]",
}


def test_no_host_defines_what_no_dispatch_reaches():
    import os as _os
    hosts = [
        _os.path.join(ROOT, "..", "tools", "js-runner", "head.part.js"),
        _os.path.join(ROOT, "..", "tools", "java-runner", "Arest.java"),
        _os.path.join(ROOT, "..", "tools", "cs-runner", "Mu.cs"),
        _os.path.join(ROOT, "..", "tools", "rust-station", "src", "main.rs"),
        _os.path.join(ROOT, "java", "Reducer.java"),
        _os.path.join(ROOT, "csharp", "Reducer.cs"),
        _os.path.join(ROOT, "rust", "src", "main.rs"),
    ]
    orphans = {}
    for path in hosts:
        if not _os.path.exists(path):
            continue
        ext = _os.path.splitext(path)[1]
        pat = _ORPHAN_PAT.get(ext)
        if pat is None:
            continue
        src = open(path, encoding="utf-8").read()
        dead = []
        for m in re.finditer(pat, src, re.M):
            name = m.group(1)
            if name in _ORPHAN_OK or name.startswith("ov_"):
                continue
            # a live definition is named somewhere OTHER than its own header:
            # called, passed, or listed in a dispatch table.
            hits = len(re.findall(r"(?<![\w.])%s(?![\w])" % re.escape(name), src))
            if hits <= 1:
                dead.append(name)
        if dead:
            orphans[_os.path.basename(path)] = sorted(dead)
    assert not orphans, (
        "host defines what no dispatch reaches: %s — the op moved to canon but "
        "its implementation stayed. Delete the body, not just the registration."
        % orphans)


def test_no_python_module_defines_what_nothing_calls():
    # The gate above reads each host file alone, which is right for the four
    # stations and the java/cs/rust engines: each is ONE file and its canon
    # arrives by concatenation. pyarest is a PACKAGE, so a helper defined in
    # kernel.py may be called only from engine.py — per-file counting would
    # report every cross-module helper as dead. Count across the package.
    #
    # This found _ftid in compiler.py, a host reimplementation of canon's
    # system:ftid (which case:reading-ftid exercises) left behind when the
    # caller went away.
    import os as _os
    pdir = _os.path.join(ROOT, "python")
    src = {}
    for f in _os.listdir(pdir):
        if f.endswith(".py"):
            src[f] = open(_os.path.join(pdir, f), encoding="utf-8").read()
    whole = "".join(src.values())
    orphans = {}
    for fname, text in sorted(src.items()):
        dead = []
        for m in re.finditer(r"^def (_\w+)\s*\(", text, re.M):
            name = m.group(1)
            if name.startswith("__"):
                continue
            if len(re.findall(r"(?<![\w])%s(?![\w])" % re.escape(name), whole)) <= 1:
                dead.append(name)
        if dead:
            orphans[fname] = sorted(dead)
    assert not orphans, (
        "pyarest defines what nothing calls: %s — the op moved to canon but its "
        "implementation stayed." % orphans)
