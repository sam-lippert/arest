import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// ONE APP'S STORE OVER MCP. JSON-RPC on stdio, one message to a line, and every answer lambda's:
// mcp:instructions at initialize, mcp:tools_json for the tools, main:as for a verb, mcp:call for a fact
// type's own resource, mcp:prompts and mcp:prompt for the verbalization patterns. This file builds
// the protocol's envelopes and nothing else.
//
// The store is the app's database: lambda reads a population where the database places it
// (store:for_read, store:sql_rows) once the store names its database in state:store_db. The schema
// it is read through is the carriers its check wrote beside the database, or, where none are, the
// schema its compile wrote into the database (store:schema_in reads its _defs).
//
// A WRITE IS COMMITTED BY LAMBDA OR IT IS REFUSED. An answer whose third part is `stored` was
// committed by lambda's own program (sqlite:program inside it, as an entity retract is), and it is
// answered. A POST, a PUT or a DELETE of a fact goes to lambda as any request does, and main:api
// commits it (main:commit). An answer that hands back a new store is a write lambda does not commit
// itself yet (a writing verb, which main:as answers without committing), and this host has no commit
// of its own to run in its place, so it answers that the write was not committed and keeps the store
// as it was; a verb lambda says writes is not evaluated at all.
//
// HTTP IS THE SAME OPERATION OVER ANOTHER TRANSPORT. A request is <store, method, resource, caller, body>
// through lambda's main:api: the resource is the path less its leading slash, the caller the
// x-arest-caller header (no header is the anonymous caller), the body the request's JSON (none is the
// empty sequence). The answer's text and status are lambda's.
//
//   java Serve <app .check directory>                         serve MCP on stdio
//   java Serve <app .check directory> --call <tool> <json>    one call, answered on stdout
//   java Serve <app .check directory> --http <port>           serve HTTP on the port, on 127.0.0.1
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
        // a store whose check wrote carriers beside it is read through them; one with none is read through the
        // schema its compile wrote into it (store:schema_in reads its _defs)
        if (new java.io.File(dir, "design-state").isFile()) Reader.loadCarriers(dir, lambda);
        Registrations.register(lambda);
        String db = dir + "/store.db";
        if (!new java.io.File(db).isFile()) throw new RuntimeException("no store at " + db + ": the app's check writes it");
        Arest.CELLS.add(new Object[] { "CELL", "state:store_db", db });
        Arest.memoClear();
        // what a served read asks of the schema, computed once by lambda (store:boot)
        store = (Object[]) Arest.Ev("store:boot", Arest.CELLS.toArray());
        System.err.println("serve: " + dir + " booted in " + (System.nanoTime() - t0) / 1000000 + " ms, " + store.length + " cells");
        if (args.length > 1 && "--call".equals(args[1])) {
            Map<String, Object> call = new LinkedHashMap<String, Object>();
            call.put("name", args[2]);
            call.put("arguments", args.length > 3 ? Gui.Json.parse(args[3]) : new LinkedHashMap<String, Object>());
            long t1 = System.nanoTime();
            Object[] out = call(call);
            System.err.println("serve: " + args[2] + " answered in " + (System.nanoTime() - t1) / 1000000 + " ms, status " + out[1]);
            OUT.println(String.valueOf(out[0]));
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
            return reply(id, obj("content", new Object[] { obj("type", "text", "text", String.valueOf(out[0])) },
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

    // one HTTP request through main:api, answered <text, status>
    static Object[] request(String method, String resource, String caller, Object body) {
        try {
            Object[] req = new Object[] { store, method, resource, caller, body == null ? new Object[0] : Gui.fromJson(body) };
            Object[] out = (Object[]) Arest.Ev("main:api", req);
            return answered(out, status(out[1]));
        } catch (Throwable e) { return new Object[] { String.valueOf(e.getMessage()), 500L }; }
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
        });
        s.start();
    }

    // the tools lambda serves (mcp:tools_json): each verb, taking its arguments as one array, and the fact type's own resource
    static Object tools() { return Gui.Json.parse(String.valueOf(Arest.Ev("mcp:tools_json", read()))); }

    static Object[] call(Map<?, ?> p) {
        String name = String.valueOf(p.get("name"));
        Map<?, ?> a = p.get("arguments") instanceof Map ? (Map<?, ?>) p.get("arguments") : new LinkedHashMap<String, Object>();
        String caller = a.get("caller") == null ? "" : String.valueOf(a.get("caller"));
        Object[] out;
        if ("fact".equals(name)) {
            String method = a.get("method") == null ? "GET" : String.valueOf(a.get("method"));
            Object fact = a.get("fact") == null ? new Object[0] : Gui.fromJson(a.get("fact"));
            out = (Object[]) Arest.Ev("mcp:call", new Object[] { method, String.valueOf(a.get("factType")), caller, fact, store });
            return answered(out, ((Number) out[1]).longValue());
        }
        List<Object> argv = new ArrayList<Object>();
        argv.add(name);
        if (a.get("args") instanceof Object[]) for (Object x : (Object[]) a.get("args")) argv.add(Gui.fromJson(x));
        // a verb lambda says writes is not evaluated: its new store would be thrown away (answered, below)
        if ("T".equals(Arest.Ev("main:verb_writes", new Object[] { read(), argv.toArray() }))) return notCommitted();
        out = (Object[]) Arest.Ev("main:as", new Object[] { store, caller, argv.toArray() });
        return answered(out, "T".equals(out[1]) ? 200L : 500L);
    }

    // a write lambda does not commit and this host cannot: lambda says so (mcp:not_committed)
    static Object[] notCommitted() { return new Object[] { String.valueOf(Arest.Ev("mcp:not_committed", new Object[0])), 501L }; }

    // a read's answer, a write lambda stored, or a write this host cannot commit
    static Object[] answered(Object[] out, long status) {
        if (out.length > 2 && "stored".equals(out[2])) { Arest.memoClear(); return new Object[] { out[0], status }; }
        if (out.length > 2 && status < 400) return notCommitted();
        return new Object[] { out[0], status };
    }
}
