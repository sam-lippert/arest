import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// ONE APP'S STORE OVER MCP. JSON-RPC on stdio, one message to a line, and every answer lambda's:
// mcp:instructions at initialize, mcp:tools_json for the tools, k:as for a verb, k:mcp_call for a fact
// type's own resource, mcp:prompts and mcp:prompt for the verbalization patterns. This file builds
// the protocol's envelopes and nothing else.
//
// The store is the app's database: lambda reads a population where the database places it
// (store:for_read, store:sql_rows) once the store names its database in state:store_db. The schema
// it is read through is the one its compile wrote into the database (store:schema_in reads its _defs).
//
// A WRITE IS COMMITTED BY LAMBDA OR IT IS REFUSED. An answer whose third part is `stored` was
// committed by lambda's own program (sqlite:program inside it, as an entity retract is), and it is
// answered. A POST, a PUT or a DELETE of a fact goes to lambda as any request does, and one application
// of SYSTEM commits it in one program (k:system, k:do_change), as it does a writing verb; a request SYSTEM
// does not answer stays with main:api and main:as, which commit their own (main:commit, main:as_commit). An
// answer that still hands back a new store is a write lambda did not commit, over a store held in
// memory alone, and this host has no commit of its own to run in its place, so it answers that the
// write was not committed and keeps the store as it was.
//
// A COMMITTED WRITE PERFORMS WHAT ITS TRANSITIONS DECLARE. Each committed write is asked what it performs
// (Perform.took), and the calls are made once its answer is out (Perform.drain), so no caller waits on another
// service; an MCP answer names the calls about to be made beside lambda's text.
//
// HTTP IS THE SAME OPERATION OVER ANOTHER TRANSPORT. A request is <store, method, resource, caller, body>
// through k:api: the resource is the path less its leading slash, the caller the
// x-arest-caller header (no header is the anonymous caller), the body the request's JSON (none is the
// empty sequence). The answer's text and status are lambda's. A navigation lambda answers with 202 and a
// request (ui:read_fetch) is read here as a sync's page is read (Perform), and asked again with the page
// (readPage), the I/O lambda cannot do.
//
//   java Serve <app store directory>                         serve MCP on stdio
//   java Serve <app store directory> --call <tool> <json>    one call, answered on stdout
//   java Serve <app store directory> --http <port>           serve HTTP on the port, on 127.0.0.1
public class Serve {
    static Object[] store;
    static final PrintStream OUT = utf8Out();
    static PrintStream utf8Out() {
        try { return new PrintStream(new java.io.FileOutputStream(java.io.FileDescriptor.out), true, "UTF-8"); }
        catch (java.io.UnsupportedEncodingException e) { throw new RuntimeException(e); }
    }

    public static void main(String[] args) throws Exception {
        // stdout is the protocol's; anything a registration prints goes to stderr
        System.setOut(System.err);
        long t0 = System.nanoTime();
        String dir = args[0].replace('\\', '/');
        String lambda = Reader.path("AREST_LAMBDA", "../../arest");
        Reader.load(lambda);
        // SYSTEM's own cells, beside lambda: a request goes through them (k:serve_boot, k:api, k:mcp_call, k:as)
        Reader.load(Reader.path("AREST_KERNEL", "../../kernel"));
        // a store is read through the schema its compile wrote into it (store:schema_in reads its _defs)
        Registrations.register(lambda);
        String db = dir + "/store.db";
        if (!new java.io.File(db).isFile()) throw new RuntimeException("no store at " + db + ": the app's check writes it");
        Arest.CELLS.add(new Object[] { "CELL", "state:store_db", db });
        Arest.memoClear();
        // what a served read asks of the schema, computed once by lambda, with SYSTEM's D (k:serve_boot)
        store = (Object[]) Arest.Ev("k:serve_boot", Arest.CELLS.toArray());
        System.err.println("serve: " + dir + " booted in " + (System.nanoTime() - t0) / 1000000 + " ms, " + store.length + " cells");
        if (args.length > 1 && "--call".equals(args[1])) {
            Map<String, Object> call = new LinkedHashMap<String, Object>();
            call.put("name", args[2]);
            call.put("arguments", args.length > 3 ? Gui.Json.parse(args[3]) : new LinkedHashMap<String, Object>());
            long t1 = System.nanoTime();
            Object[] out = call(call);
            System.err.println("serve: " + args[2] + " answered in " + (System.nanoTime() - t1) / 1000000 + " ms, status " + out[1]);
            OUT.println(String.valueOf(out[0]));
            Perform.drain();
            return;
        }
        if (args.length > 2 && "--http".equals(args[1])) {
            http(Integer.parseInt(args[2]));
            System.err.println("serve: HTTP on 127.0.0.1:" + args[2]);
            return;
        }
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        for (String line; (line = in.readLine()) != null; ) {
            if (line.trim().isEmpty()) continue;
            Object reply;
            try { reply = handle((Map<?, ?>) Gui.Json.parse(line)); }
            catch (Throwable e) { reply = fail(null, String.valueOf(e.getMessage())); }
            if (reply != null) OUT.println(Gui.Json.write(reply));
            Perform.drain();
        }
    }

    static Map<String, Object> obj(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<String, Object>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }
    static Map<String, Object> reply(Object id, Object result) { return obj("jsonrpc", "2.0", "id", id, "result", result); }
    static Map<String, Object> fail(Object id, String message) {
        return obj("jsonrpc", "2.0", "id", id, "error", obj("code", -32603L, "message", message));
    }
    static String text(Object x) { return x instanceof Object[] ? "" : String.valueOf(x); }
    // the store as a read is answered over: its populations read in the database (store:for_read)
    static Object read() { return Arest.Ev("store:for_read", store); }

    static Object handle(Map<?, ?> msg) {
        Object id = msg.get("id");
        String method = String.valueOf(msg.get("method"));
        Map<?, ?> p = msg.get("params") instanceof Map ? (Map<?, ?>) msg.get("params") : new LinkedHashMap<String, Object>();
        if ("initialize".equals(method)) {
            Map<String, Object> r = obj("protocolVersion", "2024-11-05",
                "capabilities", obj("tools", obj(), "prompts", obj()),
                "serverInfo", obj("name", "arest", "version", "1.0.0"));
            try { r.put("instructions", String.valueOf(Arest.Ev("mcp:instructions", read()))); }
            catch (Throwable e) { System.err.println("serve: mcp:instructions: " + e.getMessage()); }
            return reply(id, r);
        }
        if ("tools/list".equals(method)) return reply(id, obj("tools", tools()));
        if ("prompts/list".equals(method)) {
            List<Object> out = new ArrayList<Object>();
            for (Object row : (Object[]) Arest.Ev("mcp:prompts", read()))
                out.add(obj("name", text(((Object[]) row)[0]), "description", text(((Object[]) row)[1])));
            return reply(id, obj("prompts", out));
        }
        if ("prompts/get".equals(method)) {
            String name = p.get("name") == null ? "" : String.valueOf(p.get("name"));
            String t = String.valueOf(Arest.Ev("mcp:prompt", new Object[] { name, read() }));
            return reply(id, obj("description", String.valueOf(Arest.Ev("mcp:prompt_description", name)),
                "messages", new Object[] { obj("role", "user", "content", obj("type", "text", "text", t)) }));
        }
        if ("tools/call".equals(method)) {
            Object[] out;
            try { out = call(p); }
            catch (Throwable e) { out = new Object[] { String.valueOf(e.getMessage()), 500L }; }
            String due = Perform.due();
            Object text = obj("type", "text", "text", String.valueOf(out[0]));
            return reply(id, obj("content", due.isEmpty() ? new Object[] { text } : new Object[] { text, obj("type", "text", "text", due) },
                "isError", ((Number) out[1]).longValue() >= 400));
        }
        // the router's HTTP request for this app, passed on as it came
        if ("http/request".equals(method)) {
            Object[] out = request(String.valueOf(p.get("method")), p.get("resource") == null ? "" : String.valueOf(p.get("resource")),
                p.get("caller") == null ? "" : String.valueOf(p.get("caller")), p.get("body"));
            return reply(id, obj("status", out[1], "body", String.valueOf(out[0])));
        }
        if (id == null) return null;
        return fail(id, "unknown method: " + method);
    }

    // one HTTP request through k:api, answered <text, status>, asked once more with the page where it reads first (readPage)
    static Object[] request(String method, String resource, String caller, Object body) {
        Perform.mark(caller);
        try {
            Object[] out = api(method, resource, caller, body);
            Object page = readPage(out, caller);
            if (page == null) return out;
            Object[] b = body instanceof Object[] ? (Object[]) body : new Object[0], again = new Object[8];
            for (int i = 0; i < 7; i++) again[i] = i < b.length ? b[i] : new Object[0];
            again[7] = page;
            return api(method, resource, caller, again);
        } catch (Throwable e) { return new Object[] { String.valueOf(e.getMessage()), 500L }; }
    }
    static Object[] api(String method, String resource, String caller, Object body) {
        Object[] out = (Object[]) Arest.Ev("k:api", new Object[] { store, method, resource, caller, body == null ? new Object[0] : Gui.fromJson(body) });
        return answered(out, status(out[1]));
    }
    // A NAVIGATION THAT HAS TO READ FIRST answers 202 with the request lambda built for its Source, the Source after it
    // (ui:read_fetch). This host makes that read as it makes a sync's (Perform.readerFor, fetchOne, fetchMbox) and answers
    // the page, or <failed, text> where it could not read; null where the answer asks for no read.
    static Object readPage(Object[] out, String caller) {
        Object q;
        try { q = ((Number) out[1]).longValue() == 202 ? Gui.fromJson(Gui.Json.parse(String.valueOf(out[0]))) : null; } catch (RuntimeException e) { q = null; }
        if (!(q instanceof Object[]) || ((Object[]) q).length < 6 || !"request".equals(String.valueOf(((Object[]) q)[0]))) return null;
        Object[] ask = (Object[]) q;
        Object read = read(), fn = Arest.Ev("fed:connector", new Object[] { ask[5], read });
        if (fn instanceof Object[]) return new Object[] { "failed", "the Source '" + ask[5] + "' uses no Connector" };
        Perform.Rd rd = Perform.readerFor(String.valueOf(fn), read);
        if (rd.awaits) return new Object[] { "failed", "no host here registers Fetcher '" + rd.fetcher + "', so this read is the caller's" };
        if (rd.refusal != null) return new Object[] { "failed", rd.refusal };
        List<String> lines = new ArrayList<String>();
        Perform.Got got = "mbox".equals(rd.fetcher) ? Perform.fetchMbox(rd, ask, lines, caller) : Perform.fetchOne(rd, ask, lines, caller);
        return got.notPerformed || got.status >= 400 ? new Object[] { "failed", got.text } : got.body;
    }
    static long status(Object s) {
        if (s instanceof Number) return ((Number) s).longValue();
        try { return Long.parseLong(String.valueOf(s)); } catch (NumberFormatException e) { return 500L; }
    }

    // the request's JSON, or nothing when it has none or it does not parse
    static Object body(com.sun.net.httpserver.HttpExchange ex) {
        try (java.io.InputStream in = ex.getRequestBody()) {
            java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
            String s = new String(b.toByteArray(), StandardCharsets.UTF_8);
            return s.trim().isEmpty() ? null : Gui.Json.parse(s);
        } catch (Throwable e) { return null; }
    }
    static void respond(com.sun.net.httpserver.HttpExchange ex, long status, String text) throws java.io.IOException {
        byte[] b = text.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("content-type", "application/json; charset=utf-8");
        ex.sendResponseHeaders((int) status, b.length == 0 ? -1 : b.length);
        if (b.length > 0) try (java.io.OutputStream o = ex.getResponseBody()) { o.write(b); }
        ex.close();
    }
    static String caller(com.sun.net.httpserver.HttpExchange ex) {
        String c = ex.getRequestHeaders().getFirst("x-arest-caller");
        return c == null ? "" : c;
    }

    // one request at a time, in the order they came, as the MCP lines are answered
    static void http(int port) throws Exception {
        com.sun.net.httpserver.HttpServer s = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", port), 0);
        s.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            Object[] out = request(ex.getRequestMethod(), path.startsWith("/") ? path.substring(1) : path, caller(ex), body(ex));
            respond(ex, ((Number) out[1]).longValue(), String.valueOf(out[0]));
            Perform.drain();
        });
        s.start();
    }

    // the tools lambda serves (mcp:tools_json): each verb, taking its arguments as one array, and the fact type's own resource
    static Object tools() { return Gui.Json.parse(String.valueOf(Arest.Ev("mcp:tools_json", read()))); }

    static Object[] call(Map<?, ?> p) {
        String name = String.valueOf(p.get("name"));
        Map<?, ?> a = p.get("arguments") instanceof Map ? (Map<?, ?>) p.get("arguments") : new LinkedHashMap<String, Object>();
        String caller = a.get("caller") == null ? "" : String.valueOf(a.get("caller"));
        Perform.mark(caller);
        Object[] out;
        if ("fact".equals(name)) {
            String method = a.get("method") == null ? "GET" : String.valueOf(a.get("method"));
            Object fact = a.get("fact") == null ? new Object[0] : Gui.fromJson(a.get("fact"));
            out = (Object[]) Arest.Ev("k:mcp_call", new Object[] { method, String.valueOf(a.get("factType")), caller, fact, store });
            return answered(out, ((Number) out[1]).longValue());
        }
        List<Object> argv = new ArrayList<Object>();
        argv.add(name);
        if (a.get("args") instanceof Object[]) for (Object x : (Object[]) a.get("args")) argv.add(Gui.fromJson(x));
        // a verb whose operand is a response is handed a Source, and this host reads its pages (Perform)
        if (fetched().contains(name)) return Perform.pages(name, caller, argv.subList(1, argv.size()).toArray());
        // a writing verb is one application of SYSTEM (k:as), or commits its store through main:as; one not committed is answered below
        out = (Object[]) Arest.Ev("k:as", new Object[] { store, caller, argv.toArray() });
        return answered(out, "T".equals(out[1]) ? 200L : 500L);
    }

    // one verb over one operand, as a call makes it: <text, status>
    static Object[] verb(String name, String caller, Object arg) {
        Perform.mark(caller);
        Object[] out = (Object[]) Arest.Ev("k:as", new Object[] { store, caller == null ? "" : caller, new Object[] { name, arg } });
        return answered(out, "T".equals(out[1]) ? 200L : 500L);
    }

    // the verbs the store says accept a response: those a caller hands a Source and this host reads for
    static java.util.Set<String> FETCHED;
    static java.util.Set<String> fetched() {
        if (FETCHED == null) {
            java.util.Set<String> f = new java.util.HashSet<String>();
            for (Object row : (Object[]) Arest.Ev("system:pop_rows", new Object[] { "FunctionAcceptsTypeExpression", read() })) {
                Object[] r = (Object[]) row;
                if (r.length > 1 && "response-and-cells".equals(String.valueOf(r[1]))) f.add(String.valueOf(r[0]));
            }
            FETCHED = f;
        }
        return FETCHED;
    }

    // a write lambda does not commit and this host cannot: lambda says so (mcp:not_committed)
    static Object[] notCommitted() { return new Object[] { String.valueOf(Arest.Ev("mcp:not_committed", new Object[0])), 501L }; }

    // a read's answer, a write lambda stored, or a write this host cannot commit
    static Object[] answered(Object[] out, long status) {
        if (out.length > 2 && "stored".equals(out[2])) { Arest.memoClear(); if (status < 400) Perform.took(); return new Object[] { out[0], status }; }
        if (out.length > 2 && status < 400) return notCommitted();
        return new Object[] { out[0], status };
    }
}
