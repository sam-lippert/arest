# A QUALIFIER BESIDE ANOTHER CLAUSE. The single-clause prohibited arm reads
# `<reading> that is <unary>` as a joinon; the chain resolver, which asks each clause
# for ONE declared reading, refused the same words as a conjunct -- so auto.dev's
# source-routing rule (source-routing.md:180, the shape below verbatim) declined as
# `clause names no fact type` though both its legs are declared in that same file.
# The qualifier is the conjunct it always was, joined on the player it qualifies, and
# the rows are the svc.do requests routed through a proxy-based Fetcher.

Source Request(.id) is an entity type.
Source Service(.Name) is an entity type.
Fetcher(.Name) is an entity type.

Source Request is to Source Service.
Source Request is routed via Fetcher.
Fetcher is proxy-based.

It is forbidden that Source Request is to Source Service 'svc.do' and Source Request is routed via Fetcher that is proxy-based.
