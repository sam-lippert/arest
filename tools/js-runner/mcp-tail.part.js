;
// THE MCP TAIL. Same composition, same evaluator, one different last step:
// tail.part.js prints a text atom and exits, serve-tail.part.js binds a socket,
// and this speaks JSON-RPC over stdio. It is the SAME six lines as the serving
// tail over a different transport, because a tool call and a POST are the same
// operation: <cells, method, resource, caller, fact> through main:api.
//
// THERE IS NO VERB TABLE HERE, and two earlier versions of this file had one.
// A verb is a PREDICATE VERBALIZATION -- doing one is creating a fact that uses
// that verb in its predicate -- so a tool is a FACT TYPE and its parameters are
// that predicate's roles. Both come from the store: canon's mcp:tools derives
// the list the same way links(e) is derived, so a fact type added to a model is
// served without touching canon or this file.
//
// The first version listed eighteen canon FUNCTION names and dispatched them by
// apply. They resolve, and eight of eight answered operand errors, because a
// function wants an operand of its own shape and a predicate wants role
// players. The second cut to five verbs main dispatches by argv: that works and
// says nothing about the model. Both were host verb tables; one of them was
// just living in canon.
//
// RBAC IS NOT A FEATURE HERE. The caller is transport-level identity; which
// controls that caller may use is auth:links' business, decided by the
// designated authorization fact type, and it is already decided inside main:api.
const TOOLS = Ev("mcp:tools", CELLS);
// the admitted methods are canon's too -- http:method_kinds, not a constant
const METHODS = Ev("http:method_kinds", []).map((m) => String(m[0]));

function tools() {
  return TOOLS.map((t) => {
    // state:declared carries each fact type's PLAYER TYPES in role order, so
    // the reading and its signature are the same row
    const players = Array.isArray(t[1]) ? t[1].map(String) : [];
    return {
      name: String(t[0]),
      description:
        "fact type " + t[0] +
        (players.length ? "; roles played by " + players.join(", ") : ""),
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: METHODS,
                    description: "GET reads and returns links; POST asserts a fact" },
          caller: { type: "string", description: "who is calling; gates which controls are shown" },
          fact: { type: "array", description: "the role players, in role order" },
        },
        required: ["method"],
      },
    };
  });
}

function call(name, args) {
  const a = args || {};
  // no dispatch: the resource IS the fact type and the method IS the operation
  return Ev("mcp:call", [
    String(a.method || METHODS[0]),
    String(name),
    String(a.caller || ""),
    Array.isArray(a.fact) ? a.fact : [],
    CELLS,
  ]);
}

function reply(id, result) { return { jsonrpc: "2.0", id, result }; }
function fail(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32603, message } };
}

function handle(msg) {
  if (msg.method === "initialize") {
    return reply(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "arest", version: "1.0.0" },
    });
  }
  if (msg.method === "tools/list") return reply(msg.id, { tools: tools() });
  if (msg.method === "tools/call") {
    const p = msg.params || {};
    try {
      // main:api answers <text, status>; the status is canon's decision, and a
      // 4xx is an answer about the model rather than a transport fault
      const out = call(p.name, p.arguments);
      const status = Number(out && out[1]) || 500;
      return reply(msg.id, {
        content: [{ type: "text", text: out && out[0] !== undefined ? String(out[0]) : "" }],
        isError: status >= 400,
      });
    } catch (e) {
      return reply(msg.id, { content: [{ type: "text", text: String(e.message) }], isError: true });
    }
  }
  if (msg.id === undefined) return null;          // a notification wants no reply
  return fail(msg.id, "unknown method: " + msg.method);
}

let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  for (;;) {
    const nl = buf.indexOf("\n");
    if (nl < 0) break;
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let out;
    try {
      out = handle(JSON.parse(line));
    } catch (e) {
      out = fail(null, String(e.message));
    }
    if (out) process.stdout.write(JSON.stringify(out) + "\n");
  }
});

console.error("arest mcp: " + TOOLS.length + " fact types, " + METHODS.join("/") + ", all of it derived");
