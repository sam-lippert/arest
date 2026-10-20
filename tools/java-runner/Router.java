import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintStream;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

// EVERY APP OVER ONE MCP CONNECTION. The app is a per-call argument; each app is its own process
// over its own store (Serve), started at its first call and stopped after ten minutes without one,
// so two apps answer at once and one app answers in its order.
//
// The router's own store is the registry (tools/js-runner/registry): its App table says which apps
// there are and where each package is, and lambda reads it, as it reads any served store. The verbs
// are lambda's, read off the registry's store, and every one takes `app`; `apps` lists the apps.
//
//   java -cp <classes;sqlite-jdbc;slf4j-api> Router
//
// AREST_LAMBDA names the lambda file, AREST_REGISTRY the registry package, AREST_LOGIN the caller a
// call names when it names none.
public class Router {
    static final PrintStream OUT = Serve.OUT;
    static final long IDLE_MS = 600000L;
    static final int MAX_ANSWER = 2000000;
    static Object[] store;
    static final LinkedHashMap<String, App> APPS = new LinkedHashMap<String, App>();
    static final ExecutorService POOL = Executors.newCachedThreadPool();
    static String lambda, login;

    public static void main(String[] args) throws Exception {
        System.setOut(System.err);
        String here = "";
        lambda = new File(Reader.path("AREST_LAMBDA", "../../arest")).getCanonicalPath().replace('\\', '/');
        String registry = Reader.path("AREST_REGISTRY", new File(lambda).getParent() + "/tools/js-runner/registry").replace('\\', '/');
        login = Reader.path("AREST_LOGIN", "");
        String dir = registry + "/.check";
        Reader.load(lambda);
        Reader.loadCarriers(dir);
        Registrations.register(lambda);
        Arest.CELLS.add(new Object[] { "CELL", "state:store_db", dir + "/store.db" });
        Arest.memoClear();
        store = (Object[]) Arest.Ev("store:boot", Arest.CELLS.toArray());
        Serve.store = store;
        Object read = Arest.Ev("store:for_read", store);
        Map<String, String> status = new LinkedHashMap<String, String>();
        for (Object r : rows("AppHasServingStatus", read)) status.put(String.valueOf(((Object[]) r)[0]), String.valueOf(((Object[]) r)[1]));
        for (Object r : rows("AppHasPackageDirectory", read)) {
            Object[] row = (Object[]) r;
            String name = String.valueOf(row[0]);
            if ("suspended".equals(status.get(name))) continue;
            APPS.put(name, new App(name, String.valueOf(row[1]).replace('\\', '/') + "/.check", here));
        }
        System.err.println("router: " + APPS.size() + " apps from " + dir + ": " + String.join(", ", APPS.keySet()));
        Thread idle = new Thread(() -> {
            while (true) {
                try { Thread.sleep(60000); } catch (InterruptedException e) { return; }
                for (App a : APPS.values()) a.restIfIdle();
            }
        });
        idle.setDaemon(true);
        idle.start();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        for (String line; (line = in.readLine()) != null; ) {
            if (line.trim().isEmpty()) continue;
            final String l = line;
            POOL.submit(() -> {
                Object reply;
                try { reply = handle((Map<?, ?>) Gui.Json.parse(l)); }
                catch (Throwable e) { reply = Serve.fail(null, String.valueOf(e.getMessage())); }
                if (reply != null) synchronized (OUT) { OUT.println(Gui.Json.write(reply)); }
            });
        }
        // the client has gone: the calls it already made are answered, then every app stops
        POOL.shutdown();
        POOL.awaitTermination(10, TimeUnit.MINUTES);
        for (App a : APPS.values()) a.stop();
        System.exit(0);
    }

    static Object[] rows(String factType, Object read) {
        Object r = Arest.Ev("system:pop_rows", new Object[] { factType, read });
        return r instanceof Object[] ? (Object[]) r : new Object[0];
    }

    static Object handle(Map<?, ?> msg) throws Exception {
        Object id = msg.get("id");
        String method = String.valueOf(msg.get("method"));
        Map<?, ?> p = msg.get("params") instanceof Map ? (Map<?, ?>) msg.get("params") : new LinkedHashMap<String, Object>();
        if ("initialize".equals(method)) {
            List<String> lines = new ArrayList<String>();
            for (App a : APPS.values()) if (a.instructions != null) lines.add(a.name + ": " + a.instructions);
            return Serve.reply(id, Serve.obj("protocolVersion", "2024-11-05",
                "capabilities", Serve.obj("tools", Serve.obj(), "prompts", Serve.obj()),
                "serverInfo", Serve.obj("name", "arest", "version", "1.0.0"),
                "instructions", "AREST serves " + APPS.size() + " apps, each its own store; every verb takes `app`: "
                    + String.join(", ", APPS.keySet()) + ". The app list is the App table of the registry store. `apps` reports each."
                    + " This host serves reads; a write is answered not_committed and changes nothing until lambda commits writes itself (#197)."
                    + (lines.isEmpty() ? "" : " ||| " + String.join(" ||| ", lines))));
        }
        if ("tools/list".equals(method)) return Serve.reply(id, Serve.obj("tools", tools()));
        if ("prompts/list".equals(method) || "prompts/get".equals(method)) {
            Object r = Serve.handle(msg);
            return r;
        }
        if ("tools/call".equals(method)) {
            String name = String.valueOf(p.get("name"));
            Map<String, Object> a = new LinkedHashMap<String, Object>();
            if (p.get("arguments") instanceof Map) for (Map.Entry<?, ?> e : ((Map<?, ?>) p.get("arguments")).entrySet()) a.put(String.valueOf(e.getKey()), e.getValue());
            if ("apps".equals(name)) {
                List<Object> out = new ArrayList<Object>();
                for (App x : APPS.values()) out.add(new Object[] { x.name, x.status(), x.dir });
                return text(id, Gui.Json.write(out.toArray()), false);
            }
            String app = a.get("app") == null ? "" : String.valueOf(a.remove("app"));
            App x = APPS.get(app);
            if (x == null) return text(id, "no app named " + Gui.Json.write(app) + "; the apps are " + String.join(", ", APPS.keySet()), true);
            if (!a.containsKey("caller") || a.get("caller") == null) a.put("caller", login);
            Map<?, ?> r = x.request("tools/call", Serve.obj("name", name, "arguments", a));
            if (r.get("error") != null) return text(id, String.valueOf(((Map<?, ?>) r.get("error")).get("message")), true);
            Map<?, ?> result = (Map<?, ?>) r.get("result");
            int size = 0;
            if (result.get("content") instanceof Object[]) for (Object c : (Object[]) result.get("content")) size += String.valueOf(((Map<?, ?>) c).get("text")).length();
            if (size > MAX_ANSWER)
                return text(id, name + " on " + app + " answered " + size + " characters, more than one message to a session carries (" + MAX_ANSWER
                    + "): ask for a part -- `get` one entity, `actions` on it, one fact type through `fact` with GET", true);
            return Serve.reply(id, result);
        }
        if (id == null) return null;
        return Serve.fail(id, "unknown method: " + method);
    }

    static Map<String, Object> text(Object id, String s, boolean err) {
        return Serve.reply(id, Serve.obj("content", new Object[] { Serve.obj("type", "text", "text", s) }, "isError", err));
    }

    // lambda's verbs over the registry's store, each with the app it is for
    static List<Object> tools() {
        List<Object> out = new ArrayList<Object>();
        out.add(Serve.obj("name", "apps", "description", "the resident apps: whether each is serving, and its store's directory",
            "inputSchema", Serve.obj("type", "object", "properties", Serve.obj())));
        Map<String, Object> app = Serve.obj("type", "string", "enum", APPS.keySet().toArray(), "description", "the resident app this call is for");
        for (Object t : Serve.tools()) {
            @SuppressWarnings("unchecked") Map<String, Object> tool = (Map<String, Object>) t;
            @SuppressWarnings("unchecked") Map<String, Object> schema = (Map<String, Object>) tool.get("inputSchema");
            @SuppressWarnings("unchecked") Map<String, Object> props = (Map<String, Object>) schema.get("properties");
            Map<String, Object> withApp = new LinkedHashMap<String, Object>();
            withApp.put("app", app);
            withApp.putAll(props);
            List<Object> req = new ArrayList<Object>();
            req.add("app");
            if (schema.get("required") instanceof Object[]) for (Object r : (Object[]) schema.get("required")) req.add(r);
            out.add(Serve.obj("name", tool.get("name"), "description", tool.get("description") + " -- in the app named by `app`",
                "inputSchema", Serve.obj("type", "object", "properties", withApp, "required", req.toArray())));
        }
        return out;
    }

    // ONE APP'S SERVER: a Serve process over the app's .check directory, spoken to in JSON-RPC lines
    static final class App {
        final String name, dir, classes;
        Process proc;
        Writer to;
        String instructions, error;
        volatile long last = System.currentTimeMillis();
        final AtomicLong seq = new AtomicLong();
        final ConcurrentHashMap<Long, CompletableFuture<Map<?, ?>>> pending = new ConcurrentHashMap<Long, CompletableFuture<Map<?, ?>>>();

        App(String name, String dir, String classes) { this.name = name; this.dir = dir; this.classes = classes; }

        synchronized String status() {
            if (error != null) return "failed: " + error;
            if (proc != null && proc.isAlive()) return "serving";
            return new File(dir, "store.db").isFile() ? "idle" : "no store at " + dir + "/store.db";
        }

        synchronized void start() throws Exception {
            if (proc != null && proc.isAlive()) return;
            error = null;
            if (!new File(dir, "store.db").isFile()) throw new RuntimeException(name + " has no store at " + dir + "/store.db: its check writes it");
            String java = System.getProperty("java.home") + File.separator + "bin" + File.separator + "java";
            ProcessBuilder pb = new ProcessBuilder(java, "-Xmx" + Reader.path("AREST_APP_HEAP", "2g"), "-Xss512m",
                "-cp", System.getProperty("java.class.path"), "Serve", dir);
            pb.environment().put("AREST_LAMBDA", lambda);
            pb.redirectError(new File(dir, "serve.log"));
            proc = pb.start();
            to = new OutputStreamWriter(proc.getOutputStream(), StandardCharsets.UTF_8);
            final Process me = proc;
            Thread rd = new Thread(() -> {
                try (BufferedReader from = new BufferedReader(new InputStreamReader(me.getInputStream(), StandardCharsets.UTF_8))) {
                    for (String line; (line = from.readLine()) != null; ) {
                        Map<?, ?> m;
                        try { m = (Map<?, ?>) Gui.Json.parse(line); } catch (Throwable e) { continue; }
                        Object rid = m.get("id");
                        CompletableFuture<Map<?, ?>> f = rid instanceof Number ? pending.remove(((Number) rid).longValue()) : null;
                        if (f != null) f.complete(m);
                    }
                } catch (Exception e) { }
                synchronized (App.this) { if (proc == me) error = "the server exited (" + exitOf(me) + "); see " + dir + "/serve.log"; }
                for (CompletableFuture<Map<?, ?>> f : pending.values()) f.complete(Serve.fail(null, name + "'s server exited; see " + dir + "/serve.log"));
                pending.clear();
            });
            rd.setDaemon(true);
            rd.start();
            Map<?, ?> init = send("initialize", Serve.obj());
            Object r = init.get("result");
            if (r instanceof Map && ((Map<?, ?>) r).get("instructions") != null) instructions = String.valueOf(((Map<?, ?>) r).get("instructions"));
        }

        static String exitOf(Process p) { try { return "exit " + p.exitValue(); } catch (Exception e) { return "running"; } }

        Map<?, ?> request(String method, Object params) throws Exception {
            last = System.currentTimeMillis();
            start();
            Map<?, ?> r = send(method, params);
            last = System.currentTimeMillis();
            return r;
        }

        Map<?, ?> send(String method, Object params) throws Exception {
            long id = seq.incrementAndGet();
            CompletableFuture<Map<?, ?>> f = new CompletableFuture<Map<?, ?>>();
            pending.put(id, f);
            synchronized (this) {
                to.write(Gui.Json.write(Serve.obj("jsonrpc", "2.0", "id", id, "method", method, "params", params)) + "\n");
                to.flush();
            }
            return f.get();
        }

        synchronized void restIfIdle() {
            if (proc != null && proc.isAlive() && pending.isEmpty() && System.currentTimeMillis() - last > IDLE_MS) stop();
        }

        synchronized void stop() {
            if (proc == null) return;
            Process p = proc;
            proc = null;
            try { to.close(); } catch (Exception e) { }
            try { if (!p.waitFor(5, TimeUnit.SECONDS)) p.destroyForcibly(); } catch (InterruptedException e) { p.destroyForcibly(); }
        }
    }
}
