;
// the journal carrier follows: an APPEND-ONLY argument list. The open
// paren and the doc atom live here, the close lives in mid4; every entry
// is appended bytes (",\n\nDEF(journal:n, address)"), never a rewrite.
CANON("journal"