;
// THE SERVING TAIL. Same composition, same evaluator, one different last step:
// tail.part.js prints a text atom and exits, and this binds a socket instead.
//
// Sam: nothing custom should wrangle it into a HATEOAS server besides the
// native registrations required for serving. That holds here because
// AREST.tex:260 leaves nothing to compose -- every component of repr(e), the
// selectors on its facts, the derived facts, the violations and links(e), is
// (rho f):P for some object f. So this reads a request, applies main:api, and
// writes the two answers it gets back. There is no dispatch here, no rendering,
// no status decision, no authorization check: ui:route routes, render:json
// renders, http:status_of decides the code, and auth:links decides which
// controls this caller is even shown.
//
// If you are about to add a branch to this file, stop -- that is how the last
// seven stations died, and it is how the compiler came to be 7,196 lines.
//
// THE ONE APPARENT BRANCH IS NOT ONE. The body is read unconditionally and a
// failure answers the empty sequence, so a GET (no body) and a POST (a fact)
// take the same path. Testing the method here would be the host deciding what a
// method MEANS, which is http:method_kinds' job.
const PORT = Number(process.env.AREST_PORT || 8787);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    // the caller is transport-level identity; who that caller MAY be is the
    // designated authorization fact type's business, not this file's
    const caller = req.headers.get("x-arest-caller") || "";
    const resource = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const fact = await req.json().catch(() => []);
    const out = Ev("main:api", [CELLS, req.method, resource, caller, fact]);
    return new Response(String(out[0]), {
      status: Number(out[1]) || 500,
      headers: { "content-type": "application/json" },
    });
  },
});

console.error("arest serving on :" + PORT);
