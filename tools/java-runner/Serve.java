import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// ONE APP'S STORE OVER MCP. JSON-RPC on stdio, one message to a line, and every answer lambda's:
// mcp:instructions at initialize, mcp:verbs for the tools, main:as for a verb, mcp:call for a fact
// type's own resource, mcp:prompts and mcp:prompt for the verbalization patterns. This file builds
// the protocol's envelopes and nothing else.
//
// The store is the app's database: lambda reads a population where the database places it
// (store:for_read, store:sql_rows) once the store names its database in state:store_db, and the
// carriers its check wrote beside the database give the schema it is read through.
//
// A WRITE IS COMMITTED BY LAMBDA OR IT IS REFUSED. An answer whose third part is `stored` was
// committed by lambda's own program (sqlite:program inside it, as an entity retract is), and it is
// answered. An answer that hands back a new store is a write lambda does not commit itself yet
// (#197, the write path), and this host has no commit of its own to run in its place, so it
// answers that the write was not committed and keeps the store as it was.
//
//   java Serve <app .check directory>                         serve MCP on stdio
//   java Serve <app .check directory> --call <tool> <json>    one call, answered on stdout
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
        Reader.loadCarriers(dir);
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
            return reply(id, obj("description", "FORML 2 verbalization pattern " + name,
                "messages", new Object[] { obj("role", "user", "content", obj("type", "text", "text", t)) }));
        }
        if ("tools/call".equals(method)) {
            Object[] out;
            try { out = call(p); }
            catch (Throwable e) { out = new Object[] { String.valueOf(e.getMessage()), 500L }; }
            return reply(id, obj("content", new Object[] { obj("type", "text", "text", String.valueOf(out[0])) },
                "isError", ((Number) out[1]).longValue() >= 400));
        }
        if (id == null) return null;
        return fail(id, "unknown method: " + method);
    }

    // the verbs lambda serves, each taking its arguments as one array, and the fact type's own resource
    static List<Object> tools() {
        List<Object> out = new ArrayList<Object>();
        for (Object v : (Object[]) Arest.Ev("mcp:verbs", read())) {
            Object[] r = (Object[]) v;
            String said = r.length > 3 ? text(r[3]) : "";
            out.add(obj("name", text(r[0]),
                "description", (said.isEmpty() ? "" : said + " -- ") + "takes the " + text(r[1]) + ", answers the " + text(r[2]),
                "inputSchema", obj("type", "object", "properties", obj(
                    "args", obj("type", "array", "description", "the verb's arguments, in order; a verb that takes the store takes none")))));
        }
        out.add(obj("name", "fact",
            "description", "one fact type's own resource: GET reads its population and its links; POST asserts one fact, DELETE retracts one and PUT replaces one. `factType` is the resource name `actions`, `schema` and the fact types' GETs give; `fact` is the role players in role order.",
            "inputSchema", obj("type", "object", "properties", obj(
                "factType", obj("type", "string", "description", "the fact type's resource name"),
                "method", obj("type", "string", "enum", new Object[] { "GET", "POST", "DELETE", "PUT" }),
                "fact", obj("type", "array", "description", "the role players, in role order"),
                "caller", obj("type", "string", "description", "who is calling")),
                "required", new Object[] { "factType", "method" })));
        return out;
    }

    static Object[] call(Map<?, ?> p) {
        String name = String.valueOf(p.get("name"));
        Map<?, ?> a = p.get("arguments") instanceof Map ? (Map<?, ?>) p.get("arguments") : new LinkedHashMap<String, Object>();
        String caller = a.get("caller") == null ? "" : String.valueOf(a.get("caller"));
        Object[] out;
        if ("fact".equals(name)) {
            String method = a.get("method") == null ? "GET" : String.valueOf(a.get("method"));
            if (!"GET".equals(method)) return NOT_COMMITTED;
            Object fact = a.get("fact") == null ? new Object[0] : Gui.fromJson(a.get("fact"));
            out = (Object[]) Arest.Ev("mcp:call", new Object[] { method, String.valueOf(a.get("factType")), caller, fact, store });
            return answered(out, ((Number) out[1]).longValue());
        }
        List<Object> argv = new ArrayList<Object>();
        argv.add(name);
        if (a.get("args") instanceof Object[]) for (Object x : (Object[]) a.get("args")) argv.add(Gui.fromJson(x));
        // a verb lambda says writes is not evaluated: its new store would be thrown away (answered, below)
        if ("T".equals(Arest.Ev("main:verb_writes", new Object[] { read(), argv.toArray() }))) return NOT_COMMITTED;
        out = (Object[]) Arest.Ev("main:as", new Object[] { store, caller, argv.toArray() });
        return answered(out, "T".equals(out[1]) ? 200L : 500L);
    }

    static final Object[] NOT_COMMITTED = new Object[] {
        "[\"not_committed\",\"this host takes no writes yet: lambda does not commit a write's new store itself (#197), and a host has no commit of its own, so nothing was evaluated and the store is as it was\"]", 501L };

    // a read's answer, a write lambda stored, or a write this host cannot commit
    static Object[] answered(Object[] out, long status) {
        if (out.length > 2 && "stored".equals(out[2])) { Arest.memoClear(); return new Object[] { out[0], status }; }
        if (out.length > 2 && status < 400) return NOT_COMMITTED;
        return new Object[] { out[0], status };
    }
}
