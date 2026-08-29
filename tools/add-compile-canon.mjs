// Splice the first slice of `compile:` into canon.
//
// Sam: "Start writing compile to spec." The spec is AREST.tex, and for
// constraints it is one sentence (:148):
//
//   "every constraint of Definition 4 compiles to a restriction whose predicate
//    falls in one of two families, a cardinality count against declared bounds
//    or a membership test against a target population (the comparison
//    constraints taking the inequality theta), with polarity the only parameter
//    separating symmetric from asymmetric and subset from exclusion."
//
// Two families over the ten kinds Definition 4 lists, and one polarity
// parameter. That is the algorithm, and it is small -- which is the point: it
// was 7,196 lines of host code in two languages.
//
// The split is written as DATA, not as a computed convention, for the reason
// canon states everywhere else: a convention that is only ever computed cannot
// be checked, cannot take an exception, and cannot be read by anything that
// does not already know it.
//
//     bun tools/add-compile-canon.mjs           report what would be added
//     bun tools/add-compile-canon.mjs --apply   splice before the closing paren

import { readFileSync, writeFileSync } from "node:fs";

const CANON = new URL("../arest", import.meta.url);

// THE LEADING COMMA IS LOAD-BEARING. The file is one tuple literal and its last
// element carries no trailing comma, so an insert that opens with the note
// string puts two expressions side by side and rustc/bun both refuse the whole
// canon. Caught by the composed build, which is what it is for.
const ADD = `,
"THE TWO CONSTRAINT FAMILIES. AREST.tex:148 gives compile's algorithm for a constraint in one sentence: every constraint of Definition 4 compiles to a restriction whose predicate falls in one of two families -- a CARDINALITY COUNT against declared bounds, or a MEMBERSHIP TEST against a target population -- with POLARITY the only parameter separating symmetric from asymmetric and subset from exclusion. Definition 4 lists ten kinds; these are the two sets they fall into. Written as data because a convention that is only ever computed cannot be checked, cannot take an exception, and cannot be read by anything that does not already know it -- and because this exact split was 7,196 lines of host code in two languages, which is what a computed convention costs.",
DEF("compile:count_kinds",
    K(S3(A("uniqueness"), A("frequency"), A("cardinality")))),

DEF("compile:member_kinds",
    K(S7(A("mandatory"), A("ring"), A("value_comparison"), A("subset"), A("equality"), A("exclusion"), A("value")))),

"WHICH FAMILY A CONSTRAINT KIND COMPILES INTO. A kind in neither set is not a constraint this fragment admits, and the empty answer is the refusal -- Definition 5 rejects what the grammar does not generate, so a kind with no family must not silently acquire one.",
DEF("compile:family",
    S4(A("COND"),
       S3(A("COMP"), A("theta:member"), S3(A("CONS"), A("id"), A("compile:count_kinds"))),
       K(A("count")),
       S4(A("COND"),
          S3(A("COMP"), A("theta:member"), S3(A("CONS"), A("id"), A("compile:member_kinds"))),
          K(A("member")),
          K(PHI())))),

"POLARITY, the one parameter the two families take. AREST.tex:148 names the two axes it separates: symmetric from asymmetric, and subset from exclusion. A subset constraint requires its rows to be IN the target population and an exclusion requires them to be OUT, and that is the whole difference between the two objects -- so the polarity is a value here rather than a second builder.",
DEF("compile:positive_kinds",
    K(S4(A("mandatory"), A("subset"), A("equality"), A("value")))),

DEF("compile:polarity",
    S4(A("COND"),
       S3(A("COMP"), A("theta:member"), S3(A("CONS"), A("id"), A("compile:positive_kinds"))),
       K(A("in")),
       K(A("out")))),
`;

const src = readFileSync(CANON, "utf8");
const end = src.lastIndexOf(")");
if (end < 0) throw new Error("no closing paren in canon");

// the file is ONE tuple literal, so an element is spliced before the close and
// the element before it must already end in a comma -- it does, every DEF does
const out = src.slice(0, end) + ADD + src.slice(end);

const names = [...ADD.matchAll(/DEF\("([^"]+)"/g)].map((m) => m[1]);
console.log("adding %d DEFs: %s", names.length, names.join(" "));
for (const n of names) {
  if (src.includes('DEF("' + n + '"')) {
    console.error("REFUSED: %s already defined -- a duplicate DEF throws by law:one_name", n);
    process.exit(1);
  }
}
console.log("canon %d -> %d bytes", src.length, out.length);

if (process.argv.includes("--apply")) {
  writeFileSync(CANON, out);
  console.log("spliced");
} else {
  console.log("(dry run)");
}
