/* ==========================================================================
 * c-runner — the composed checker, C PARITY station.
 *
 * A STRICT mu mirroring tools/cs-runner/{Vocabulary,Mu}.cs point for point
 * (and the js and java stations, which mirror the same source): a selector
 * on an atom dies, a duplicate DEF dies, a comparison across atom kinds
 * dies, an out-of-range selection dies. Booleans are the atoms "T" and "F".
 * No law semantics live here — if a guard or a name list ever appears in
 * this file, delete it; accretion is how the first two js runners died.
 *
 * The canon and the carriers appear AS SOURCE and are COMPILED: the compose
 * step is byte concatenation (cat/copy /b) of the part files around the
 * three tuples, and CANON is the C99 idiom for the "one extra name" join —
 * a variadic macro whose compound literal carries the tuple and whose
 * sizeof (an UNEVALUATED operand, so DEF side effects are not duplicated)
 * counts it. The executable is then just exec'd — nothing is read, eval'd,
 * or interpreted at runtime.
 *
 * Memory: C is the one station without a garbage collector, and the naive
 * arena proved the demand is tens of GB (the fixpoint rounds recompute
 * structurally equal values endlessly). The station therefore HASH-CONSES:
 * every string, int, and sequence interns bottom-up, so structural identity
 * IS pointer identity, the arena holds only novel structures (one arena,
 * reclaimed by exit), and deep_eq gains an exact pointer fast path. Purely
 * representational — values are immutable, so sharing is invisible to the
 * canon.
 *
 * Two documented ASCII simplifications (C has no Unicode tables in scope):
 * slug keeps ASCII alphanumerics and cmp_atoms orders by byte value where
 * C#/Java/JS order by UTF-16 code unit. Every name and value the laws slug
 * or sort is ASCII, and the byte-identical cross-station verdicts are the
 * standing check that this stays true.
 * ========================================================================== */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

typedef struct Value Value;
typedef Value* Obj;
struct Value {
    int kind;        /* 0 = string atom, 1 = int atom, 2 = sequence */
    const char* s;
    long i;
    Obj* it;
    long n;
};

static void die(const char* what, const char* detail) {
    fprintf(stderr, "STRICT: %s%s%s\n", what, detail ? ": " : "", detail ? detail : "");
    exit(3);
}
static void die_int(const char* what, long v) {
    fprintf(stderr, "STRICT: %s: %ld\n", what, v);
    exit(3);
}

static unsigned long fnv(const char* s) {
    unsigned long h = 2166136261ul;
    for (; *s; s++) { h ^= (unsigned char)*s; h *= 16777619ul; }
    return h;
}

/* ---- arena: bump allocation, chunked, never freed ------------------------ */
#define ARENA_CHUNK (16l * 1024 * 1024)
static char* arena_chunks[1024];
static long arena_nchunks = 0;
static long arena_used = 0;
static void* arena_bytes(long nbytes) {
    nbytes = (nbytes + 15) & ~15l;
    if (arena_nchunks == 0 || arena_used + nbytes > ARENA_CHUNK) {
        if (nbytes > ARENA_CHUNK) die("allocation larger than a chunk", 0);
        if (arena_nchunks >= 1024) die("arena exhausted", 0);
        arena_chunks[arena_nchunks] = (char*)malloc(ARENA_CHUNK);
        if (!arena_chunks[arena_nchunks]) die("out of memory", 0);
        arena_nchunks++;
        arena_used = 0;
    }
    void* p = arena_chunks[arena_nchunks - 1] + arena_used;
    arena_used += nbytes;
    return p;
}
static Obj mk(void) { return (Obj)arena_bytes((long)sizeof(Value)); }
static int in_arena(const void* p) {
    for (long c = 0; c < arena_nchunks; c++) {
        const char* base = arena_chunks[c];
        long extent = (c == arena_nchunks - 1) ? arena_used : ARENA_CHUNK;
        if ((const char*)p >= base && (const char*)p < base + extent) return 1;
    }
    return 0;
}

/* ---- hash-consed constructors ------------------------------------------- */
#define STRCAP (1l << 20)
#define INTCAP (1l << 16)
#define SEQCAP (1l << 24)
static Obj str_tab[STRCAP];
static Obj int_tab[INTCAP];
static Obj* seq_tab;

static Obj mk_str(const char* s) {
    unsigned long h = fnv(s) & (STRCAP - 1);
    while (str_tab[h]) {
        if (strcmp(str_tab[h]->s, s) == 0) return str_tab[h];
        h = (h + 1) & (STRCAP - 1);
    }
    Obj v = mk(); v->kind = 0; v->s = s;
    str_tab[h] = v;
    return v;
}
static Obj mk_int(long i) {
    unsigned long h = ((unsigned long)i * 2654435761ul) & (INTCAP - 1);
    while (int_tab[h]) {
        if (int_tab[h]->i == i) return int_tab[h];
        h = (h + 1) & (INTCAP - 1);
    }
    Obj v = mk(); v->kind = 1; v->i = i;
    int_tab[h] = v;
    return v;
}
static Obj mk_seq(long n, Obj* items) {
    if (!seq_tab) {
        seq_tab = (Obj*)calloc(SEQCAP, sizeof(Obj));
        if (!seq_tab) die("out of memory", 0);
    }
    unsigned long long h = 14695981039346656037ull; /* FNV-64: unsigned long is 32-bit on LLP64 Windows */
    h ^= (unsigned long long)n; h *= 1099511628211ull;
    for (long i = 0; i < n; i++) { h ^= (unsigned long long)(size_t)items[i]; h *= 1099511628211ull; }
    h &= (unsigned long long)(SEQCAP - 1);
    while (seq_tab[h]) {
        Obj c = seq_tab[h];
        if (c->n == n && memcmp(c->it, items, n * sizeof(Obj)) == 0) return c;
        h = (h + 1) & (unsigned long long)(SEQCAP - 1);
    }
    Obj v = mk(); v->kind = 2; v->n = n;
    v->it = (Obj*)arena_bytes((n > 0 ? n : 1) * (long)sizeof(Obj));
    memcpy(v->it, items, n * sizeof(Obj));
    seq_tab[h] = v;
    return v;
}
/* per-call fill buffer: small on the stack, large on the heap (freed) */
#define BUF(n) Obj _local[32]; Obj* buf = ((n) <= 32) ? _local : (Obj*)malloc((n) * sizeof(Obj))
#define BUF_DONE() do { if (buf != _local) free(buf); } while (0)

/* ---- the registration vocabulary ---------------------------------------- */
static Obj canon_build(long n, const void** raw) {
    /* the CANON boundary is the one place C's type system meets the tuple's
     * bare docstring literals: arena membership (exact pointer-range test)
     * says which arguments are built Objs; the rest are char* and wrap. */
    BUF(n);
    for (long i = 0; i < n; i++)
        buf[i] = in_arena(raw[i]) ? (Obj)raw[i] : mk_str((const char*)raw[i]);
    Obj v = mk_seq(n, buf);
    BUF_DONE();
    return v;
}
#define CANON(...) canon_build(sizeof((const void*[]){__VA_ARGS__})/sizeof(void*), (const void*[]){__VA_ARGS__})

static Obj A(const char* s) { return mk_str(s); }
static Obj N(long n) { return mk_int(n); }
static Obj PHI(void) { return mk_seq(0, 0); }
static Obj K(Obj x) { Obj a[2]; a[0] = mk_str("CONST"); a[1] = x; return mk_seq(2, a); }
static Obj S1(Obj a){ Obj v[1]={a}; return mk_seq(1,v); }
static Obj S2(Obj a,Obj b){ Obj v[2]={a,b}; return mk_seq(2,v); }
static Obj S3(Obj a,Obj b,Obj c){ Obj v[3]={a,b,c}; return mk_seq(3,v); }
static Obj S4(Obj a,Obj b,Obj c,Obj d){ Obj v[4]={a,b,c,d}; return mk_seq(4,v); }
static Obj S5(Obj a,Obj b,Obj c,Obj d,Obj e){ Obj v[5]={a,b,c,d,e}; return mk_seq(5,v); }
static Obj S6(Obj a,Obj b,Obj c,Obj d,Obj e,Obj f){ Obj v[6]={a,b,c,d,e,f}; return mk_seq(6,v); }
static Obj S7(Obj a,Obj b,Obj c,Obj d,Obj e,Obj f,Obj g){ Obj v[7]={a,b,c,d,e,f,g}; return mk_seq(7,v); }
static Obj S8(Obj a,Obj b,Obj c,Obj d,Obj e,Obj f,Obj g,Obj h){ Obj v[8]={a,b,c,d,e,f,g,h}; return mk_seq(8,v); }
static Obj S9(Obj a,Obj b,Obj c,Obj d,Obj e,Obj f,Obj g,Obj h,Obj i){ Obj v[9]={a,b,c,d,e,f,g,h,i}; return mk_seq(9,v); }

/* DEFS: FNV-1a open-addressing map; a duplicate dies by map semantics —
 * law:one_name is the law. CELLS accumulates the composed store. */
#define DEFCAP 32768
static const char* def_names[DEFCAP];
static Obj def_bodies[DEFCAP];
static Obj cells[8192];
static long ncells = 0;

static long def_slot(const char* name) {
    unsigned long h = fnv(name) & (DEFCAP - 1);
    while (def_names[h] && strcmp(def_names[h], name) != 0) h = (h + 1) & (DEFCAP - 1);
    return (long)h;
}
static Obj DEF(const char* name, Obj body) {
    long slot = def_slot(name);
    if (def_names[slot]) die("duplicate DEF", name);
    def_names[slot] = name;
    def_bodies[slot] = body;
    Obj cell[3]; cell[0] = mk_str("CELL"); cell[1] = mk_str(name); cell[2] = body;
    cells[ncells++] = mk_seq(3, cell);
    return mk_str(name);
}

/* ---- the mu -------------------------------------------------------------- */
static int deep_eq(Obj a, Obj b) {
    if (a == b) return 1; /* hash-consing: structural identity IS pointer identity */
    if (a->kind != b->kind) return 0;
    if (a->kind == 0) return strcmp(a->s, b->s) == 0;
    if (a->kind == 1) return a->i == b->i;
    if (a->n != b->n) return 0;
    for (long i = 0; i < a->n; i++) if (!deep_eq(a->it[i], b->it[i])) return 0;
    return 1;
}
static Obj bool_(int b) { return mk_str(b ? "T" : "F"); }
static int is_T(Obj x) { return x->kind == 0 && strcmp(x->s, "T") == 0; }

static long cmp_atoms(Obj a, Obj b) {
    if (a->kind == 1 && b->kind == 1) return a->i < b->i ? -1 : a->i > b->i ? 1 : 0;
    if (a->kind == 0 && b->kind == 0) { int c = strcmp(a->s, b->s); return c < 0 ? -1 : c > 0 ? 1 : 0; }
    die("compare across atom kinds", 0);
    return 0;
}
static Obj need_seq(Obj x) { if (x->kind != 2) die("expected sequence, got atom", x->kind == 0 ? x->s : "int"); return x; }
static const char* need_str(Obj x) { if (x->kind != 0) die("expected string atom", 0); return x->s; }
static Obj el(Obj x, long i) { need_seq(x); if (i < 0 || i >= x->n) die_int("index out of range", i); return x->it[i]; }

static Obj Ev(Obj f, Obj x);

static Obj prim(const char* name, Obj x) {
    if (!strcmp(name, "id")) return x;
    if (!strcmp(name, "tl")) { need_seq(x); if (x->n < 1) die("tl on empty", 0);
        long n = x->n - 1; BUF(n);
        for (long i = 0; i < n; i++) buf[i] = x->it[i + 1];
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(name, "atom")) return bool_(x->kind != 2);
    if (!strcmp(name, "apndl")) { Obj h = el(x,0); Obj t = need_seq(el(x,1));
        long n = t->n + 1; BUF(n);
        buf[0] = h; for (long i = 0; i < t->n; i++) buf[i + 1] = t->it[i];
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(name, "apndr")) { Obj h = need_seq(el(x,0)); Obj t = el(x,1);
        long n = h->n + 1; BUF(n);
        for (long i = 0; i < h->n; i++) buf[i] = h->it[i]; buf[h->n] = t;
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(name, "distl")) { Obj h = el(x,0); Obj t = need_seq(el(x,1));
        long n = t->n; BUF(n);
        for (long i = 0; i < n; i++) { Obj p[2] = { h, t->it[i] }; buf[i] = mk_seq(2, p); }
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(name, "distr")) { Obj h = need_seq(el(x,0)); Obj t = el(x,1);
        long n = h->n; BUF(n);
        for (long i = 0; i < n; i++) { Obj p[2] = { h->it[i], t }; buf[i] = mk_seq(2, p); }
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(name, "cat")) { Obj a = need_seq(el(x,0)); Obj b = need_seq(el(x,1));
        long n = a->n + b->n; BUF(n);
        for (long i = 0; i < a->n; i++) buf[i] = a->it[i];
        for (long i = 0; i < b->n; i++) buf[a->n + i] = b->it[i];
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(name, "null")) return bool_(x->kind == 2 && x->n == 0);
    if (!strcmp(name, "eq")) return bool_(deep_eq(el(x,0), el(x,1)));
    if (!strcmp(name, "not")) return bool_(!is_T(x));
    if (!strcmp(name, "and")) return bool_(is_T(el(x,0)) && is_T(el(x,1)));
    if (!strcmp(name, "length")) { need_seq(x); return mk_int(x->n); }
    if (!strcmp(name, "le")) return bool_(cmp_atoms(el(x,0), el(x,1)) <= 0);
    if (!strcmp(name, "ge")) return bool_(cmp_atoms(el(x,0), el(x,1)) >= 0);
    if (!strcmp(name, "gt")) return bool_(cmp_atoms(el(x,0), el(x,1)) > 0);
    if (!strcmp(name, "+")) { Obj a = el(x,0), b = el(x,1);
        if (a->kind != 1 || b->kind != 1) die("+ on non-number", 0);
        return mk_int(a->i + b->i); }
    if (!strcmp(name, "apply")) return Ev(el(x,0), el(x,1));
    if (!strcmp(name, "lex")) { const char* s = need_str(x);
        Obj tmp[256]; long n = 0;
        while (*s) { while (*s && isspace((unsigned char)*s)) s++;
            if (!*s) break;
            const char* start = s;
            while (*s && !isspace((unsigned char)*s)) s++;
            long len = s - start;
            char* w = (char*)arena_bytes(len + 1); memcpy(w, start, len); w[len] = 0;
            if (n >= 256) die("lex overflow", 0);
            tmp[n++] = mk_str(w); }
        return mk_seq(n, tmp); }
    if (!strcmp(name, "implode")) { const char* sep = need_str(el(x,0)); Obj parts = need_seq(el(x,1));
        long total = 1, seplen = (long)strlen(sep);
        for (long i = 0; i < parts->n; i++) total += (long)strlen(need_str(parts->it[i])) + seplen;
        char* out = (char*)arena_bytes(total); out[0] = 0;
        for (long i = 0; i < parts->n; i++) { if (i) strcat(out, sep); strcat(out, parts->it[i]->s); }
        return mk_str(out); }
    if (!strcmp(name, "slug")) { const char* s = need_str(x);
        char* out = (char*)arena_bytes((long)strlen(s) + 1); long n = 0;
        for (; *s; s++) if (isalnum((unsigned char)*s)) out[n++] = (char)tolower((unsigned char)*s);
        out[n] = 0; return mk_str(out); }
    if (!strcmp(name, "escape_html")) { const char* s = need_str(x);
        char* out = (char*)arena_bytes((long)strlen(s) * 6 + 1); long n = 0;
        for (; *s; s++) {
            if (*s == '&') { memcpy(out+n, "&amp;", 5); n += 5; }
            else if (*s == '<') { memcpy(out+n, "&lt;", 4); n += 4; }
            else if (*s == '>') { memcpy(out+n, "&gt;", 4); n += 4; }
            else if (*s == '"') { memcpy(out+n, "&quot;", 6); n += 6; }
            else out[n++] = *s; }
        out[n] = 0; return mk_str(out); }
    if (!strcmp(name, "strip_prefix")) { const char* pre = need_str(el(x,0)); const char* t = need_str(el(x,1));
        size_t pl = strlen(pre);
        if (strlen(t) > pl && strncmp(t, pre, pl) == 0) return mk_str(t + pl);
        return mk_str(t); }
    if (!strcmp(name, "1r")) { need_seq(x); if (x->n < 1) die("1r on empty", 0); return x->it[x->n - 1]; }
    if (!strcmp(name, "tlr")) { need_seq(x); if (x->n < 1) die("tlr on empty", 0);
        long n = x->n - 1; BUF(n);
        for (long i = 0; i < n; i++) buf[i] = x->it[i];
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    die("unresolved atom", name);
    return 0;
}

static Obj Ev(Obj f, Obj x) {
    if (f->kind == 1) {
        long n = f->i;
        if (x->kind != 2) die_int("selector on atom, selector", n);
        if (n < 1 || n > x->n) die_int("selector out of range", n);
        return x->it[n - 1];
    }
    if (f->kind == 0) {
        long slot = def_slot(f->s);
        if (def_names[slot]) return Ev(def_bodies[slot], x);
        return prim(f->s, x);
    }
    if (f->n < 1) die("unknown form", "<empty>");
    Obj head = f->it[0];
    const char* h = head->kind == 0 ? head->s : "";
    if (!strcmp(h, "COMP")) { Obj v = x; for (long i = f->n - 1; i >= 1; i--) v = Ev(f->it[i], v); return v; }
    if (!strcmp(h, "CONS")) { long n = f->n - 1; BUF(n);
        for (long i = 1; i < f->n; i++) buf[i-1] = Ev(f->it[i], x);
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(h, "CONST")) return f->it[1];
    if (!strcmp(h, "COND")) return is_T(Ev(f->it[1], x)) ? Ev(f->it[2], x) : Ev(f->it[3], x);
    if (!strcmp(h, "ALPHA")) { need_seq(x); long n = x->n; BUF(n);
        for (long i = 0; i < n; i++) buf[i] = Ev(f->it[1], x->it[i]);
        Obj r = mk_seq(n, buf); BUF_DONE(); return r; }
    if (!strcmp(h, "INSERT")) { need_seq(x); if (x->n < 1) die("INSERT on empty", 0);
        Obj acc = x->it[x->n - 1];
        for (long i = x->n - 2; i >= 0; i--) { Obj p[2] = { x->it[i], acc }; acc = Ev(f->it[1], mk_seq(2, p)); }
        return acc; }
    if (!strcmp(h, "WHILE")) { Obj v = x; while (is_T(Ev(f->it[1], v))) v = Ev(f->it[2], v); return v; }
    die("unknown form", h);
    return 0;
}

/* ---- the composed tuples follow, each as one CANON(...) call ------------- */
static Obj ROOT, DS, NA;
static void load_root(void) { ROOT = CANON
