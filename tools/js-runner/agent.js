// THE SUPPORT AGENT (Sam, 2026-10-16): "It would be great to just have the interface with a chat that can
// change things if something breaks", "AREST it self should be able to act as a permission system via
// deontics", and "support app agent shouldn't edit source files, just readings & do domain evolution. It
// could pass off to another agent for source edits".
//
// A chat page on 127.0.0.1 and the loop behind it. The model is Claude over the Messages API, called
// through the connection a Function of the support store is backed by (arest/complete: the app process
// opens the Secret Reference and only the answer comes back). Its tools are the router's served verbs and
// nothing else: no file, no shell. Each call it asks for is recorded in the claude store as a Tool Call that
// invokes a Predicate, and it runs only while that store derives `Tool Call is permitted`
// (apps/claude/readings/support-agent.md over free-will's Authorization Modes); a call the store does not
// permit is held until a User consents to it, which is one more fact.
//
//   AREST_LOGIN=samuel@driv.ly bun tools/js-runner/agent.js        then open http://127.0.0.1:8793
import { connect } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROUTER_PORT = Number(process.env.AREST_ROUTER_PORT || 41817);
const PORT = Number(process.env.AREST_AGENT_PORT || 8793);
const LOGIN = process.env.AREST_LOGIN || "";
const MODEL_APP = process.env.AREST_AGENT_APP || "support";
const MODEL_FN = process.env.AREST_AGENT_FUNCTION || "draftSupportReply";
const MODEL = process.env.AREST_AGENT_MODEL || "claude-sonnet-5-5";
const AUDIT = "claude";                    // the store whose rules permit a call, and which records it
const STEPS = 24;                          // model calls in one turn before the loop gives the turn back
const NL = String.fromCharCode(10);

const SYSTEM = [
  "You are the support agent for auto.dev, working inside AREST. You act only through the AREST tools; each takes `app`: claude, tasks, support, qa, pm or engineering.",
  "Orient first: `orient` on an app gives its context, `get` one entity, `actions` the transitions it affords, `query` a recipe. A fact changes by `fact` POST, DELETE or PUT, or `assert`; a transition fires by POSTing the fact type that triggers it.",
  "You never edit source files. A change to the schema or the rules is a Domain Change: `propose` it as readings, then `apps_evaluate` it, and a User approves it. A change that needs source code (lambda, a host, the tools) is the user's to ask for: tell them what broke, what you measured and the fix you think it needs.",
  "Every call you make is recorded and checked against the store's permissions. A call the store does not permit is held for the user's consent: say what you want to do and why, and stop.",
  "support.auto.dev sends real email: never write on support to try something out. Be brief, and report what you did and what the store answered.",
].join(" ");

// ---- the router, as one more client: JSON lines over its local port
let sock = null, buf = "", nextId = 1;
const waiting = new Map();
// with no router running, the agent starts the daemon as the session shim does (mcp-router.js), so it needs no
// Claude Code session: the daemon inherits this process's environment, AREST_MASTER_KEY with it
function open() {
  const t0 = Date.now();
  let spawned = false;
  return new Promise((res, rej) => {
    const attempt = () => {
      const s = connect(ROUTER_PORT, "127.0.0.1");
      s.once("connect", () => { sock = s; wire(); res(); });
      s.once("error", (e) => {
        if (e && e.code !== "ECONNREFUSED") return rej(e);
        if (!spawned) {
          spawned = true;
          const d = spawn(process.execPath, [fileURLToPath(new URL("./mcp-router.js", import.meta.url)), "--daemon"],
            { env: process.env, detached: true, stdio: "ignore", windowsHide: true });
          d.unref();
          console.error("agent: started the router daemon (pid " + d.pid + ")");
        }
        if (Date.now() - t0 > 30000) return rej(new Error("no router answered on 127.0.0.1:" + ROUTER_PORT + " in 30 s"));
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}
function wire() {
    sock.setEncoding("utf8");
    sock.on("close", () => { console.error("agent: the router closed the connection"); process.exit(1); });
    sock.on("data", (c) => {
      buf += c;
      for (;;) {
        const i = buf.indexOf(NL);
        if (i < 0) break;
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let m;
        try { m = JSON.parse(line); } catch { continue; }
        if (m.id === undefined || !waiting.has(m.id)) continue;
        const w = waiting.get(m.id);
        waiting.delete(m.id);
        if (m.error) w.rej(new Error(m.error.message)); else w.res(m.result);
      }
    });
}
function rpc(method, params) {
  const id = nextId++;
  return new Promise((res, rej) => { waiting.set(id, { res, rej }); sock.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + NL); });
}
const call = (name, args) => rpc("tools/call", { name, arguments: args });
const textOf = (out) => (out && Array.isArray(out.content) ? out.content.map((c) => c.text || "").join("") : JSON.stringify(out));

// ---- the record and the permission, both the claude store's
const started = new Date().toISOString();
const chat = "support-agent-" + started.replace(/[:.]/g, "-");
let seq = 0;
async function record(role, body) {
  const id = chat + "-" + (++seq);
  const now = new Date().toISOString();
  const facts = [["ChatMessageBelongsToAgentChat", id, chat], ["ChatMessageHasMessageRole", id, role],
    ["MessageHasMessageBody", id, body || "(no text)"], ["MessageHasTimestamp", id, now]];
  // THE CHAT IS CREATED IN A WRITE OF ITS OWN (measured 2026-10-16): with its first message in the same
  // write, the Agent Chat machine's first step is refused on StateMachineIsCurrentlyInStatus's subset
  if (seq === 1) {
    const made = textOf(await call("assert", { app: AUDIT, args: [[["AgentChatIsForUser", chat, LOGIN],
      ["AgentChatUsesStreamingMode", chat, "non-streaming"], ["AgentChatOccurredAtTimestamp", chat, started]]] }));
    if (!/^\["committed/.test(made)) say("error", "the chat " + chat + " was not created: " + made.slice(0, 400));
  }
  const out = textOf(await call("assert", { app: AUDIT, args: [facts] }));
  if (!/^\["committed/.test(out)) say("error", "the record of " + id + " was not committed: " + out.slice(0, 400));
  return id;
}
// a call on support is its own Predicate, because a write there may email a customer; and so is a call on
// claude, because that store holds this agent's own permissions: a write there would let the agent consent to
// its own call or reclassify a Predicate, so it has no Action Class and waits for a User like any other
function predicateOf(name, input) {
  let p = "tool:" + name;
  if (name === "fact" && String(input.method || "") === "GET") p += " GET";
  if (input.app === "support") p += "@support";
  else if (input.app === AUDIT) p += "@" + AUDIT;
  return p;
}
async function permitted(tc) {
  return textOf(await call("query", { app: AUDIT, args: [["sel", "ToolCallIsPermitted", 1, tc]] })).includes(tc);
}

// ---- the conversation
let TOOLS = [];
const history = [];                        // the Messages API's turns
const held = new Map();                    // Tool Call id -> the call waiting for consent
const transcript = [];                     // what the page shows
let busy = false;
function say(role, text) { transcript.push({ role, text, at: new Date().toISOString() }); }

async function perform(tc, u) {
  let text;
  try { text = textOf(await call(u.name, u.input || {})); } catch (e) { text = "the call failed: " + e.message; }
  await call("assert", { app: AUDIT, args: [[["ToolCallHasResult", tc, text.slice(0, 2000) || "(empty)"]]] });
  say("tool", u.name + " " + JSON.stringify(u.input || {}) + NL + text.slice(0, 1200));
  return text.slice(0, 40000);
}
async function runTool(u, mid) {
  const tc = u.id, pred = predicateOf(u.name, u.input || {});
  await call("assert", { app: AUDIT, args: [[["ToolCallIsForChatMessage", tc, mid], ["ToolCallInvokesPredicate", tc, pred]]] });
  if (!(await permitted(tc))) {
    held.set(tc, { u, pred });
    say("held", pred + " " + JSON.stringify(u.input || {}));
    return { type: "tool_result", tool_use_id: tc, is_error: true,
      content: "Held: the store does not permit " + pred + " without a User's consent (Tool Call " + tc + "). Say what you want to do and why, and stop." };
  }
  return { type: "tool_result", tool_use_id: tc, content: await perform(tc, u) };
}
async function turn() {
  for (let step = 0; step < STEPS; step++) {
    const body = { model: MODEL, max_tokens: 4096, system: SYSTEM, tools: TOOLS, messages: history, thinking: { type: "between_tools" } };
    const ans = await rpc("arest/complete", { app: MODEL_APP, function: MODEL_FN, body });
    if (Number(ans.status) !== 200) { say("error", "the model call answered " + ans.status + ": " + String(ans.text).slice(0, 800)); return; }
    const m = JSON.parse(ans.text);
    history.push({ role: "assistant", content: m.content });
    const said = m.content.filter((b) => b.type === "text").map((b) => b.text).join(NL);
    const uses = m.content.filter((b) => b.type === "tool_use");
    const mid = await record("assistant", [said, ...uses.map((u) => "[" + u.name + " " + JSON.stringify(u.input) + "]")].filter(Boolean).join(NL));
    if (said) say("assistant", said);
    if (!uses.length) return;
    const results = [];
    for (const u of uses) results.push(await runTool(u, mid));
    history.push({ role: "user", content: results });
  }
  say("error", "stopped after " + STEPS + " model calls in one turn");
}
async function send(text) {
  history.push({ role: "user", content: text });
  say("user", text);
  await record("user", text);
  await turn();
}
async function consent(tc) {
  const h = held.get(tc);
  if (!h) { say("error", "no held Tool Call " + tc); return; }
  await call("assert", { app: AUDIT, args: [[["UserConsentsToToolCall", LOGIN, tc]]] });
  if (!(await permitted(tc))) { say("error", "the store still does not permit " + tc); return; }
  held.delete(tc);
  const text = await perform(tc, h.u);
  const note = "I consented to " + h.pred + " (Tool Call " + tc + "), and it ran. It answered:" + NL + text;
  history.push({ role: "user", content: note });
  await record("user", "Consented to " + h.pred + " (Tool Call " + tc + ")");
  await turn();
}

// ---- the page. A POST needs the x-arest-agent header, which no other site's page can send here without a
// preflight this server never answers.
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Support agent</title><style>
body{font:15px/1.45 system-ui,sans-serif;margin:0;background:#fafafa;color:#111}main{max-width:820px;margin:0 auto;padding:16px}
.m{white-space:pre-wrap;padding:8px 12px;margin:8px 0;border-radius:8px;background:#fff;border:1px solid #e3e3e3}
.user{background:#eef4ff}.tool{font:12px/1.4 ui-monospace,monospace;color:#555}.held{background:#fff6e0}.error{background:#ffecec}
form{display:flex;gap:8px;position:sticky;bottom:0;background:#fafafa;padding:8px 0}textarea{flex:1;font:inherit;padding:8px}
button{font:inherit;padding:8px 14px}@media(prefers-color-scheme:dark){body{background:#151515;color:#eee}.m{background:#1e1e1e;border-color:#333}
.user{background:#1d2a40}.held{background:#3a3016}.error{background:#3a1d1d}.tool{color:#aaa}form{background:#151515}}
</style></head><body><main><h1>Support agent</h1><div id="log"></div><div id="held"></div><p id="busy"></p>
<form id="f"><textarea id="t" rows="3" placeholder="Ask, or say what broke"></textarea><button>Send</button></form></main><script>
const H={"content-type":"application/json","x-arest-agent":"1"};
async function post(p,b){await fetch(p,{method:"POST",headers:H,body:JSON.stringify(b)});tick();}
document.getElementById("f").onsubmit=(e)=>{e.preventDefault();const t=document.getElementById("t");if(t.value.trim())post("/send",{text:t.value});t.value="";};
async function tick(){const s=await (await fetch("/state")).json();
document.getElementById("log").innerHTML="";for(const m of s.transcript){const d=document.createElement("div");d.className="m "+m.role;d.textContent=m.text;document.getElementById("log").appendChild(d);}
const h=document.getElementById("held");h.innerHTML="";for(const c of s.held){const d=document.createElement("div");d.className="m held";d.textContent="Waiting for your consent: "+c.pred+" "+JSON.stringify(c.input)+" ";const b=document.createElement("button");b.textContent="Consent";b.onclick=()=>post("/consent",{tc:c.tc});d.appendChild(b);h.appendChild(d);}
document.getElementById("busy").textContent=s.busy?"working...":"";}
tick();setInterval(tick,2000);</script></body></html>`;

async function main() {
  await open();
  sock.write(JSON.stringify({ jsonrpc: "2.0", method: "arest/client", params: { login: LOGIN } }) + NL);
  const list = await rpc("tools/list", {});
  TOOLS = (list.tools || []).map((t) => ({ name: t.name, description: String(t.description || "").slice(0, 4000), input_schema: t.inputSchema || { type: "object" } }));
  Bun.serve({
    hostname: "127.0.0.1", port: PORT,
    async fetch(req) {
      const u = new URL(req.url);
      if (req.method === "GET" && u.pathname === "/") return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (req.method === "GET" && u.pathname === "/state")
        return Response.json({ busy, transcript, held: [...held.entries()].map(([tc, h]) => ({ tc, pred: h.pred, input: h.u.input })) });
      if (req.method === "POST" && (u.pathname === "/send" || u.pathname === "/consent")) {
        if (req.headers.get("x-arest-agent") !== "1") return new Response("refused", { status: 403 });
        if (busy) return Response.json({ error: "busy" }, { status: 409 });
        const b = await req.json().catch(() => ({}));
        busy = true;
        (u.pathname === "/send" ? send(String(b.text || "")) : consent(String(b.tc || "")))
          .catch((e) => say("error", String(e && e.message))).finally(() => { busy = false; });
        return Response.json({ ok: true });
      }
      return new Response("not found", { status: 404 });
    },
  });
  console.error("agent: " + TOOLS.length + " tools from the router; chat " + chat + " at http://127.0.0.1:" + PORT + " as " + (LOGIN || "no login"));
}
main().catch((e) => { console.error("agent: " + (e && e.message)); process.exit(1); });
