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
// are lambda's, read off the registry's store, and every one takes `app`; `apps` lists the apps. Every
// sentence it answers is lambda's too (router:*); this file starts, stops and speaks to the app servers.
//
//   java -cp <classes;sqlite-jdbc;slf4j-api> Router
//
// AREST_LAMBDA names the lambda file, AREST_REGISTRY the registry package, AREST_LOGIN the caller a
// call names when it names none. AREST_HTTP_PORT, when set, serves HTTP on 127.0.0.1 too: /<app>/<resource>
// is passed to that app's server as it came (Serve's HTTP), and the caller is the request's own.
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
        // as Serve reads a store: through the carriers its check wrote beside it, where it wrote any
        if (new File(dir, "design-state").isFile()) Reader.loadCarriers(dir, lambda);
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
        String port = Reader.path("AREST_HTTP_PORT", "");
        if (!port.isEmpty()) http(Integer.parseInt(port));
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
            List<Object> lines = new ArrayList<Object>();
            for (App a : APPS.values()) if (a.instructions != null) lines.add(new Object[] { a.name, a.instructions });
            return Serve.reply(id, Serve.obj("protocolVersion", "2024-11-05",
                "capabilities", Serve.obj("tools", Serve.obj(), "prompts", Serve.obj()),
                "serverInfo", Serve.obj("name", "arest", "version", "1.0.0"),
                "instructions", say("router:instructions", names(), lines.toArray())));
        }
        if ("tools/list".equals(method))
            return Serve.reply(id, Serve.obj("tools", Gui.Json.parse(say("router:tools_json", names(), Serve.read()))));
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
            if (x == null) return text(id, say("router:no_app", app, names()), true);
            if ("apps_check".equals(name)) return text(id, x.check(), false);
            if ("apps_compile".equals(name)) return text(id, x.compile(), false);
            if (!a.containsKey("caller") || a.get("caller") == null) a.put("caller", login);
            Map<?, ?> r = x.request("tools/call", Serve.obj("name", name, "arguments", a));
            if (r.get("error") != null) return text(id, String.valueOf(((Map<?, ?>) r.get("error")).get("message")), true);
            Map<?, ?> result = (Map<?, ?>) r.get("result");
            int size = 0;
            if (result.get("content") instanceof Object[]) for (Object c : (Object[]) result.get("content")) size += String.valueOf(((Map<?, ?>) c).get("text")).length();
            if (size > MAX_ANSWER)
                return text(id, say("router:too_large", name, app, (long) size, (long) MAX_ANSWER), true);
            return Serve.reply(id, result);
        }
        if (id == null) return null;
        return Serve.fail(id, "unknown method: " + method);
    }

    // /<app>/<resource> to that app's server; an app the registry does not name is lambda's unknown resource
    static void http(int port) throws Exception {
        com.sun.net.httpserver.HttpServer s = com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", port), 0);
        s.setExecutor(POOL);
        s.createContext("/", ex -> {
            String path = ex.getRequestURI().getPath();
            String rest = path.startsWith("/") ? path.substring(1) : path;
            int i = rest.indexOf('/');
            String name = i < 0 ? rest : rest.substring(0, i);
            App x = APPS.get(name);
            if (x == null) {
                Serve.respond(ex, Serve.status(Arest.Ev("http:status_of", "unknown_resource")), say("router:no_app", name, names()));
                return;
            }
            Object[] out;
            try {
                Map<?, ?> r = x.request("http/request", Serve.obj("method", ex.getRequestMethod(), "resource", i < 0 ? "" : rest.substring(i + 1),
                    "caller", Serve.caller(ex), "body", Serve.body(ex)));
                if (r.get("error") != null) out = new Object[] { String.valueOf(((Map<?, ?>) r.get("error")).get("message")), 500L };
                else {
                    Map<?, ?> result = (Map<?, ?>) r.get("result");
                    out = new Object[] { String.valueOf(result.get("body")), Serve.status(result.get("status")) };
                }
            } catch (Throwable e) { out = new Object[] { String.valueOf(e.getMessage()), 500L }; }
            Serve.respond(ex, (Long) out[1], String.valueOf(out[0]));
        });
        s.start();
        System.err.println("router: HTTP on 127.0.0.1:" + port);
    }

    static Map<String, Object> text(Object id, String s, boolean err) {
        return Serve.reply(id, Serve.obj("content", new Object[] { Serve.obj("type", "text", "text", s) }, "isError", err));
    }

    // a sentence lambda says over the parts this host knows; one part is passed as itself
    static String say(String def, Object... parts) { return String.valueOf(Arest.Ev(def, parts.length == 1 ? parts[0] : parts)); }
    static Object[] names() { return APPS.keySet().toArray(); }

    // ONE APP'S SERVER: a Serve process over the app's .check directory, spoken to in JSON-RPC lines
    static final class App {
        final String name, dir, classes;
        Process proc;
        Writer to;
        String instructions, error, busy, note = "";
        volatile long last = System.currentTimeMillis();
        final AtomicLong seq = new AtomicLong();
        final ConcurrentHashMap<Long, CompletableFuture<Map<?, ?>>> pending = new ConcurrentHashMap<Long, CompletableFuture<Map<?, ?>>>();

        App(String name, String dir, String classes) { this.name = name; this.dir = dir; this.classes = classes; }

        // apps_check: the app's server is stopped, because the check writes the store it holds, and the command
        // line runs lambda's `apps_check <package directory>` in the package. Which readings, in what order and
        // where they land are lambda's; this starts the process and reports how it ended.
        synchronized String check() throws Exception {
            if (busy != null) return say("router:busy", name, busy);
            stop();
            busy = "checking";
            note = "";
            String pkg = new File(dir).getParent().replace('\\', '/');
            String root = new File(lambda).getParent().replace('\\', '/');
            String jvm = System.getProperty("java.home") + File.separator + "bin" + File.separator + "java";
            ProcessBuilder pb = new ProcessBuilder(jvm, "-Xmx" + Reader.path("AREST_APP_HEAP", "2g"), "-Xss512m",
                "-cp", System.getProperty("java.class.path"), "Program", "apps_check", pkg);
            pb.directory(new File(pkg));
            pb.environment().put("AREST_LAMBDA", lambda);
            pb.environment().put("AREST_TESTS", root + "/arest.tests");
            pb.environment().put("AREST_SCENARIOS", root + "/engine/shared/scenarios.canon");
            pb.environment().put("AREST_CARRIERS", root + "/tools/carriers/base");
            final File log = new File(pkg, "check.log");
            pb.redirectErrorStream(true);
            pb.redirectOutput(log);
            final Process p = pb.start();
            Thread w = new Thread(() -> {
                int code;
                try { code = p.waitFor(); } catch (InterruptedException e) { code = -1; }
                String tail = "";
                try {
                    List<String> lines = java.nio.file.Files.readAllLines(log.toPath(), StandardCharsets.UTF_8);
                    tail = String.join(" | ", lines.subList(Math.max(0, lines.size() - (code == 0 ? 1 : 6)), lines.size()));
                } catch (Exception e) { }
                synchronized (App.this) {
                    busy = null;
                    note = say("router:check_note", (long) code, tail);
                }
            });
            w.setDaemon(true);
            w.start();
            return say("router:checking", name, pkg, dir);
        }

        // apps_compile: this host reads lambda and the store's carriers when a server starts, so compiling the
        // app is starting its server again over the store apps_check wrote.
        synchronized String compile() throws Exception {
            if (busy != null) return say("router:busy", name, busy);
            stop();
            note = "";
            start();
            return say("router:compiled", name, dir);
        }

        synchronized String status() {
            if (busy != null) return busy;
            String s = statusOf();
            return say("router:with_note", s, note);
        }

        synchronized String statusOf() {
            if (error != null) return say("router:failed", error);
            if (proc != null && proc.isAlive()) return "serving";
            return new File(dir, "store.db").isFile() ? "idle" : say("router:no_store_at", dir);
        }

        synchronized void start() throws Exception {
            if (proc != null && proc.isAlive()) return;
            if (busy != null) throw new RuntimeException(say("router:start_busy", name, busy));
            error = null;
            if (!new File(dir, "store.db").isFile()) throw new RuntimeException(say("router:no_store", name, dir));
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
                synchronized (App.this) { if (proc == me) error = say("router:exited", exitOf(me), dir); }
                for (CompletableFuture<Map<?, ?>> f : pending.values()) f.complete(Serve.fail(null, say("router:exited_call", name, dir)));
                pending.clear();
            });
            rd.setDaemon(true);
            rd.start();
            Map<?, ?> init = send("initialize", Serve.obj());
            Object r = init.get("result");
            if (r instanceof Map && ((Map<?, ?>) r).get("instructions") != null) instructions = String.valueOf(((Map<?, ?>) r).get("instructions"));
        }

        static Object exitOf(Process p) { try { return Long.valueOf(p.exitValue()); } catch (Exception e) { return "running"; } }

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
