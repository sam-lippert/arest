// ONE READ OF A SOURCE, PERFORMED BY THE HOST THAT SERVES IT. A verb whose operand is a response (the accepts row
// `response-and-cells`: sync) is handed only a Source by its caller, and lambda then answers the REQUEST it would
// make. This host makes it: the Connector's Fetcher says who reads, the connection's Send Mode whether it may go
// out, and the connection's credential is the one access it carries, decrypted here and nowhere else. Each page the
// service answers goes back through the same verb, asserted in one step like any other write, until the answer says
// there is no more or the cursor stops moving. Lambda says what the request IS; nothing here builds one.
//
// This host registers two Fetchers. `fetch` is a direct HTTPS request whose answer is JSON. `mbox` reads a mailbox
// file on this machine, the one the connection's Secret Reference names, with the reader beside this class
// (mbox_read.py: Python's own mailbox and email), for the address the request's parameters name, or the one message
// whose Message-ID they name; it reads, and the file is not changed. Each message is answered with its whole body and,
// as own_text, what its sender wrote in it: the body up to where it quotes the mail it answers (the line that says who
// wrote what follows, a quoted line, a forwarded message's rule or header block), both without the characters no reader
// sees; a message that opens with a quote keeps its whole body there. Any other Fetcher is one this host does not register: the read is answered as the request it
// is, for the caller who holds that Fetcher to perform and pass back as the page. A connection that is not live
// answers what it would have done. A redirect is not followed, so a credential is never carried to an address the
// store did not declare.
//
// AND ONE CALL A WRITE OWES. A Predicate is performed during a Transition, and the write that takes the transition
// is where the call it declares goes out: an approval sends the reply it approves. Lambda says which calls a
// committed write owes (k:performed: the Events that occurred at the times this write read its clock, the
// transitions they caused, the Predicates performed during those, the instance each machine is for), so a call is
// made once, by the host whose write took the transition, and by no other host that reads the same store. Lambda
// says what each call IS as well: its method and address, its query, its headers, each path of its body, what its
// answer yields and about whom, what its success asserts and what its failure records, and the fact types it may
// create, past which nothing is written. This host resolves the name, refuses an address inside a blocked range,
// sends, and hands the answer back as writes like any other, so what they move is performed in turn. A connection
// that declares no Send Mode is not performed; one that is not live sends nothing, writes nothing, and says what it
// would have sent. The calls are made after the write's answer is out. A write of a federated object type is not
// written through to its system by this host (fed:ot_writes asks for the store before the write, which a store
// served from its database does not hold), and a Predicate bound to a definition of lambda's own is not this
// host's to perform. What it writes to its log names fact types and instances, and no value of a body.
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

final class Perform {
    private Perform() { }

    static String atom(Object x) { return x instanceof Object[] ? "" : String.valueOf(x); }

    /** Who reads a Function's pages, whether the read may go out, and the headers it carries. */
    static final class Rd {
        String fn, fetcher = "", mode = "", refusal, access = "";
        boolean awaits;
        final Map<String, String> headers = new LinkedHashMap<String, String>();
    }

    static Rd readerFor(String fn, Object read) {
        Rd r = new Rd();
        r.fn = fn;
        r.fetcher = atom(Arest.Ev("perform:fetcher_of", new Object[] { fn, read }));
        if (!r.fetcher.isEmpty() && !"fetch".equals(r.fetcher) && !"mbox".equals(r.fetcher)) { r.awaits = true; return r; }
        r.mode = atom(Arest.Ev("perform:send_mode_of", new Object[] { fn, read }));
        if ("mbox".equals(r.fetcher)) {
            // the file is the connection's Secret Reference: this read's one access, carried in no header
            try { r.access = secret(fn, read); } catch (RuntimeException e) { r.refusal = String.valueOf(e.getMessage()); }
            return r;
        }
        try {
            for (Object hv : (Object[]) Arest.Ev("perform:headers_of", new Object[] { fn, read })) {
                Object[] p = (Object[]) hv;
                r.headers.put(String.valueOf(p[0]), String.valueOf(p[1]));
            }
            Object auth = Arest.Ev("perform:auth_header_of", new Object[] { fn, read });
            if (!(auth instanceof Object[])) {
                String secret = written(fn, secret(fn, read), read);
                if (secret == null) {
                    r.refusal = "not performed: the credential encoding this connection declares is not one this host writes";
                    return r;
                }
                if (!secret.isEmpty()) {
                    String k = String.valueOf(auth), had = r.headers.get(k);
                    r.headers.put(k, (had == null || had.isEmpty() ? "" : had + " ") + secret);
                }
            }
        } catch (RuntimeException e) { r.refusal = String.valueOf(e.getMessage()); }
        return r;
    }

    // The Secret Reference the connection of a Function's backing system carries, opened under this host's key, or ""
    // where it carries none. One that does not open is refused by name, never read as none.
    static String secret(String fn, Object read) {
        Object cipher = Arest.Ev("perform:secret_of", new Object[] { fn, read });
        if (cipher instanceof Object[]) return "";
        String key = Registrations.masterKey();
        Object plain;
        try { plain = Arest.Ev("hook:read", new Object[] { key == null ? "" : key, "Secret Reference", String.valueOf(cipher), read }); }
        catch (RuntimeException e) {
            throw new RuntimeException("not read: the Secret Reference of this connection does not open under this host's AREST_MASTER_KEY");
        }
        return atom(plain);
    }

    static String written(String fn, String secret, Object read) {
        if (secret.isEmpty()) return secret;
        Object enc = Arest.Ev("perform:credential_encoding_of", new Object[] { fn, read });
        if (enc instanceof Object[]) return secret;
        if ("base64".equals(String.valueOf(enc))) return java.util.Base64.getEncoder().encodeToString(secret.getBytes(StandardCharsets.UTF_8));
        return null;
    }

    /** What one request answered: not performed, a failure with its text, or a page. */
    static final class Got {
        boolean notPerformed;
        int status;
        Object body;
        String text = "", method = "", url = "";
    }

    static String enc(String s) {
        try { return URLEncoder.encode(s, "UTF-8"); } catch (java.io.UnsupportedEncodingException e) { throw new RuntimeException(e); }
    }

    static byte[] all(InputStream in) throws java.io.IOException {
        if (in == null) return new byte[0];
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[65536];
        for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        return out.toByteArray();
    }

    // req is lambda's <request, method, address, parameters, body>: a declared Query Text is the body, sent as written
    static Got fetchOne(Rd rd, Object[] req, List<String> lines, String who) {
        Got g = new Got();
        g.method = String.valueOf(req[1]);
        String address = String.valueOf(req[2]);
        StringBuilder qs = new StringBuilder();
        if (req.length > 3 && req[3] instanceof Object[]) for (Object pr : (Object[]) req[3]) {
            Object[] p = (Object[]) pr;
            if (qs.length() > 0) qs.append('&');
            qs.append(enc(String.valueOf(p[0]))).append('=').append(enc(String.valueOf(p[1])));
        }
        g.url = address + (qs.length() > 0 ? (address.indexOf('?') >= 0 ? "&" : "?") + qs : "");
        String sendBody = req.length > 4 && !(req[4] instanceof Object[]) && !String.valueOf(req[4]).isEmpty() ? String.valueOf(req[4]) : null;
        if (!"live".equals(rd.mode)) {
            g.notPerformed = true;
            g.text = (rd.mode.isEmpty() ? "not performed: this connection declares no Send Mode -- would " : rd.mode + " -- would ") + g.method + " " + g.url
                + (sendBody == null ? "" : " with a body of " + sendBody.length() + " characters");
            return g;
        }
        int code;
        String text;
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(g.url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(120000);
            c.setRequestMethod(g.method);
            boolean typed = false;
            for (Map.Entry<String, String> h : rd.headers.entrySet()) {
                c.setRequestProperty(h.getKey(), h.getValue());
                if ("content-type".equalsIgnoreCase(h.getKey())) typed = true;
            }
            if (sendBody != null) {
                if (!typed) c.setRequestProperty("Content-Type", "text/plain;charset=UTF-8");
                c.setDoOutput(true);
                try (OutputStream o = c.getOutputStream()) { o.write(sendBody.getBytes(StandardCharsets.UTF_8)); }
            }
            code = c.getResponseCode();
            text = new String(all(code >= 400 ? c.getErrorStream() : c.getInputStream()), StandardCharsets.UTF_8);
            c.disconnect();
        } catch (Exception e) {
            String why = e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage());
            try { Arest.Ev("log:response", new Object[] { rd.fn, g.method, g.url, "0", why }); } catch (RuntimeException e2) { }
            record(rd.fn, g.url, "0", lines, who);
            g.status = 502;
            g.text = g.method + " " + g.url + " failed: " + why;
            return g;
        }
        // what came off the line goes to log:response: a registered log provider writes it, and with none it does not
        try { Arest.Ev("log:response", new Object[] { rd.fn, g.method, g.url, String.valueOf(code), text }); } catch (RuntimeException e) { }
        record(rd.fn, g.url, String.valueOf(code), lines, who);
        if (code >= 300) {
            g.status = 502;
            g.text = g.method + " " + g.url + " answered " + code + ": " + (text.length() > 300 ? text.substring(0, 300) : text);
            return g;
        }
        try { g.body = Gui.fromJson(Gui.Json.parse(text)); }
        catch (RuntimeException e) { g.status = 502; g.text = g.method + " " + g.url + " answered a body that is not JSON"; return g; }
        g.status = 200;
        return g;
    }

    static byte[] quietly(InputStream in) { try { return all(in); } catch (java.io.IOException e) { return new byte[0]; } }

    // The mbox Fetcher. req is lambda's <request, method, address, parameters, body>; the parameters from and to name
    // the address whose mail is read, and id the Message-ID of the one message to read. The file's path is the connection's secret: it goes to the reader in its
    // environment, and is in no line this host writes and no fact it records. What the reader prints is the page.
    static Got fetchMbox(Rd rd, Object[] req, List<String> lines, String who) {
        Got g = new Got();
        g.method = String.valueOf(req[1]);
        String from = "", to = "", id = "";
        StringBuilder qs = new StringBuilder();
        if (req.length > 3 && req[3] instanceof Object[]) for (Object pr : (Object[]) req[3]) {
            Object[] p = (Object[]) pr;
            String k = String.valueOf(p[0]), v = String.valueOf(p[1]);
            if ("from".equals(k)) from = v;
            if ("to".equals(k)) to = v;
            if ("id".equals(k)) id = v;
            if (qs.length() > 0) qs.append('&');
            qs.append(enc(k)).append('=').append(enc(v));
        }
        g.url = String.valueOf(req[2]) + (qs.length() > 0 ? "?" + qs : "");
        if (!"live".equals(rd.mode)) {
            g.notPerformed = true;
            g.text = (rd.mode.isEmpty() ? "not performed: this connection declares no Send Mode -- would " : rd.mode + " -- would ") + "read the mailbox for " + g.url;
            return g;
        }
        if (!"GET".equals(g.method)) { g.status = 405; g.text = "the mbox Fetcher reads; it does not " + g.method; return g; }
        if (rd.access.isEmpty()) { g.status = 404; g.text = "no mbox: the connection this Source reads through carries no Secret Reference naming one"; return g; }
        java.io.File file = new java.io.File(rd.access);
        if (!file.isFile()) { g.status = 404; g.text = "no mbox: the file its connection's Secret Reference names is not on this machine"; return g; }
        final byte[][] io = new byte[2][];
        int code;
        try {
            java.io.File script = new java.io.File(new java.io.File(Perform.class.getProtectionDomain().getCodeSource().getLocation().toURI()), "mbox_read.py");
            if (!script.isFile()) { g.status = 501; g.text = "the mbox Fetcher's reader, mbox_read.py, is not beside this host's classes"; return g; }
            String py = System.getenv("AREST_PYTHON");
            ProcessBuilder pb = new ProcessBuilder(py == null || py.isEmpty() ? "python" : py, "-I", script.getPath());
            pb.environment().put("ARE_MBOX", file.getPath());
            pb.environment().put("ARE_FROM", from);
            pb.environment().put("ARE_TO", to);
            pb.environment().put("ARE_ID", id);
            final Process p = pb.start();
            p.getOutputStream().close();
            Thread out = new Thread(new Runnable() { public void run() { io[0] = quietly(p.getInputStream()); } });
            Thread err = new Thread(new Runnable() { public void run() { io[1] = quietly(p.getErrorStream()); } });
            out.start(); err.start();
            if (!p.waitFor(500, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                record(rd.fn, g.url, "0", lines, who);
                g.status = 504; g.text = "the mbox read did not finish in 500 seconds; stopped"; return g;
            }
            out.join(); err.join();
            code = p.exitValue();
        } catch (Exception e) {
            record(rd.fn, g.url, "0", lines, who);
            g.status = 502; g.text = "python did not run: " + e.getClass().getSimpleName(); return g;
        }
        if (code != 0) {
            // the last line python wrote names what it raised; its message may quote the mail, so only the name is kept
            String[] el = new String(io[1] == null ? new byte[0] : io[1], StandardCharsets.UTF_8).trim().split("\n");
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("^([A-Za-z_][A-Za-z0-9_.]*)(:|$)").matcher(el[el.length - 1].trim());
            record(rd.fn, g.url, "500", lines, who);
            g.status = 502; g.text = "the mbox did not parse: python raised " + (m.find() ? m.group(1) : "an error"); return g;
        }
        try { g.body = Gui.fromJson(Gui.Json.parse(new String(io[0] == null ? new byte[0] : io[0], StandardCharsets.UTF_8))); }
        catch (RuntimeException e) { record(rd.fn, g.url, "500", lines, who); g.status = 502; g.text = "the mbox read answered a body that is not JSON"; return g; }
        record(rd.fn, g.url, "200", lines, who);
        Object scanned = find(g.body, "scanned"), matched = find(g.body, "matched"), unnamed = find(g.body, "unnamed");
        lines.add("the inbox parsed: " + scanned + " messages scanned, " + matched + " matched"
            + (unnamed != null && !"0".equals(String.valueOf(unnamed)) ? ", " + unnamed + " without a Message-ID skipped" : ""));
        g.status = 200;
        return g;
    }

    // What came off the line is recorded as an instance: a Response answering the Function, from the address, with
    // its status and time. Its body is not kept; it is what the facts the read yields were read from.
    static void record(String fn, String url, String status, List<String> lines, String who) {
        Object facts;
        try { facts = Arest.Ev("fed:response_facts", new Object[] { fn, url, status, java.time.Instant.now().toString() }); }
        catch (RuntimeException e) { return; }
        try {
            Object[] out = Serve.verb("assert", Reader.path("AREST_SYSTEM_LOGIN", who), facts);
            if (((Number) out[1]).longValue() >= 400) lines.add("response record not kept for " + fn + ": " + cut(String.valueOf(out[0]), 300));
        } catch (RuntimeException e) { lines.add("response record threw for " + fn + ": " + cut(String.valueOf(e.getMessage()), 300)); }
    }

    static String cut(String s, int n) { return s.length() > n ? s.substring(0, n) : s; }

    static Object find(Object ans, String key) {
        if (ans instanceof Object[]) for (Object pr : (Object[]) ans)
            if (pr instanceof Object[] && ((Object[]) pr).length > 1 && key.equals(String.valueOf(((Object[]) pr)[0]))) return ((Object[]) pr)[1];
        return null;
    }

    // ---- what a write performs --------------------------------------------------------------------------------

    static final java.util.Set<String> TICKS = new java.util.LinkedHashSet<String>();
    static final java.util.ArrayDeque<String[]> DUE = new java.util.ArrayDeque<String[]>();
    static String WHO = "";
    static final int CHAIN_MAX = 8;

    /** The clock lambda reads: each time it hands out is kept until the write it served is answered. */
    static synchronized String tick(String now) {
        if (TICKS.size() < 4096) TICKS.add(now);
        return now;
    }

    /** A request begins: the times read from here on are its own, and what it performs is written back as its caller's. */
    static synchronized void mark(String who) {
        TICKS.clear();
        WHO = who == null ? "" : who;
    }

    /** A write committed: the calls its own Events perform are asked of lambda now, and made once its answer is out. */
    static void took() {
        Object[] times;
        String who;
        synchronized (Perform.class) { times = TICKS.toArray(); TICKS.clear(); who = WHO; }
        if (times.length == 0 || Serve.store == null) return;
        try {
            Object kd = Arest.Ev("k:kd", Serve.store);
            if (!(kd instanceof Object[])) return;
            for (Object r : seq(Arest.Ev("k:performed", new Object[] { times, kd }))) {
                Object[] row = seq(r);
                if (row.length > 1) DUE.add(new String[] { atom(row[0]), atom(row[1]), who });
            }
        } catch (RuntimeException e) { say("performer: what the write performs could not be read: " + cut(String.valueOf(e.getMessage()), 300)); }
    }

    /** What is about to be performed, for the answer of the write that owes it. */
    static String due() {
        if (DUE.isEmpty()) return "";
        StringBuilder b = new StringBuilder("performing after this answer:");
        for (String[] d : DUE) b.append(' ').append(d[0]).append(" for ").append(d[1]).append(';');
        return b.toString();
    }

    /** The calls due are made, and those their write-backs owe in turn, until none is left or the chain is too long. */
    static void drain() {
        int made = 0;
        for (String[] d; (d = DUE.poll()) != null; ) {
            if (++made > CHAIN_MAX) {
                say("performer: stopped after " + CHAIN_MAX + " calls in one chain; " + (DUE.size() + 1) + " not made");
                DUE.clear();
                return;
            }
            List<String> lines = new ArrayList<String>();
            try { one(d[0], d[1], d[2], lines); }
            catch (Throwable e) { lines.add("failed: " + cut(String.valueOf(e), 300)); }
            for (String l : lines) say("performed " + d[0] + " for " + d[1] + ": " + l);
        }
    }

    // a line of the log; no line reads as this app's failure to a reader that looks for the word and a colon
    static void say(String line) { System.err.println(line.replaceAll("(?i)(error):", "$1 --")); }

    static Object[] seq(Object x) { return x instanceof Object[] ? (Object[]) x : new Object[0]; }

    static Object[] texts(Object row) {
        Object[] a = seq(row), out = new Object[a.length];
        for (int i = 0; i < a.length; i++) out[i] = a[i] instanceof Object[] ? a[i] : String.valueOf(a[i]);
        return out;
    }

    // a value of an answer as the text a fact holds: a number as it is written, an object or a list as its JSON
    static String text(Object v) {
        if (v instanceof Map || v instanceof Object[] || v instanceof List) return Gui.Json.write(v);
        if (v instanceof Double) { double d = ((Double) v).doubleValue(); if (d == Math.rint(d) && Math.abs(d) < 1e15) return String.valueOf((long) d); }
        return String.valueOf(v);
    }

    static boolean digits(String s) { return !s.isEmpty() && s.chars().allMatch(c -> c >= '0' && c <= '9'); }

    // A dotted JSON path set and read: 'headers.In-Reply-To' is the field In-Reply-To of the object headers, a numeric
    // step is an index of a list ('messages.0.content'), a * step read is the first element that holds the rest of
    // the path, and a key that holds the whole path as one name is read as written first.
    @SuppressWarnings("unchecked")
    static void put(Object cur, String k, Object v) {
        if (cur instanceof Map) ((Map<String, Object>) cur).put(k, v);
        else if (cur instanceof List && digits(k)) {
            List<Object> l = (List<Object>) cur;
            int n = Integer.parseInt(k);
            while (l.size() <= n) l.add(null);
            l.set(n, v);
        }
    }

    static Object child(Object cur, String k) {
        if (cur instanceof Map) return ((Map<?, ?>) cur).get(k);
        if (cur instanceof List && digits(k)) { List<?> l = (List<?>) cur; int n = Integer.parseInt(k); return n < l.size() ? l.get(n) : null; }
        if (cur instanceof Object[] && digits(k)) { Object[] a = (Object[]) cur; int n = Integer.parseInt(k); return n < a.length ? a[n] : null; }
        return null;
    }

    static void setPath(Object root, String path, Object v) {
        String[] segs = path.split("\\.");
        Object cur = root;
        for (int i = 0; i < segs.length - 1; i++) {
            Object next = child(cur, segs[i]);
            if (!(next instanceof Map) && !(next instanceof List)) {
                next = digits(segs[i + 1]) ? (Object) new ArrayList<Object>() : (Object) new LinkedHashMap<String, Object>();
                put(cur, segs[i], next);
            }
            cur = next;
        }
        put(cur, segs[segs.length - 1], v);
    }

    static Object walk(Object cur, String[] segs, int i) {
        for (; i < segs.length; i++) {
            if (!(cur instanceof Map) && !(cur instanceof Object[]) && !(cur instanceof List)) return null;
            if ("*".equals(segs[i])) {
                Iterable<?> each = cur instanceof Map ? ((Map<?, ?>) cur).values() : cur instanceof List ? (List<?>) cur : Arrays.asList((Object[]) cur);
                for (Object v : each) { Object got = walk(v, segs, i + 1); if (got != null) return got; }
                return null;
            }
            cur = child(cur, segs[i]);
        }
        return cur;
    }

    static Object getPath(Object obj, String path) {
        if (obj instanceof Map && ((Map<?, ?>) obj).containsKey(path)) return ((Map<?, ?>) obj).get(path);
        return walk(obj, (path.startsWith("$.") ? path.substring(2) : path).split("\\."), 0);
    }

    /** What a call answered: its status and text, or why it answered none. */
    static final class Sent {
        int status;
        String text = "", error;
    }

    // one request with a JSON body, its redirect not followed
    static Sent post(String method, String url, Map<String, String> headers, String json) {
        Sent s = new Sent();
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(120000);
            c.setRequestMethod(method);
            boolean typed = false;
            for (Map.Entry<String, String> h : headers.entrySet()) {
                c.setRequestProperty(h.getKey(), h.getValue());
                if ("content-type".equalsIgnoreCase(h.getKey())) typed = true;
            }
            if (!"GET".equals(method) && !"HEAD".equals(method)) {
                if (!typed) c.setRequestProperty("Content-Type", "application/json");
                c.setDoOutput(true);
                try (OutputStream o = c.getOutputStream()) { o.write(json.getBytes(StandardCharsets.UTF_8)); }
            }
            s.status = c.getResponseCode();
            s.text = new String(all(s.status >= 400 ? c.getErrorStream() : c.getInputStream()), StandardCharsets.UTF_8);
            c.disconnect();
        } catch (Exception e) {
            s.status = 0;
            s.error = e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage());
        }
        return s;
    }

    // facts asserted in one step as the system's login, or the caller's where the environment names none
    static boolean back(String label, Object facts, String who, List<String> lines) {
        try {
            Object[] out = Serve.verb("assert", Reader.path("AREST_SYSTEM_LOGIN", who), facts);
            if (((Number) out[1]).longValue() >= 400) { lines.add(label + " REFUSED: " + cut(String.valueOf(out[0]), 400)); return false; }
            lines.add(label + ": " + cut(String.valueOf(out[0]), 200));
            return true;
        } catch (RuntimeException e) { lines.add(label + " threw: " + cut(String.valueOf(e.getMessage()), 300)); return false; }
    }

    static String names(List<Object> rows) {
        List<String> out = new ArrayList<String>();
        for (Object r : rows) { String n = String.valueOf(seq(r)[0]); if (!out.contains(n)) out.add(n); }
        return String.join(", ", out);
    }

    /** A call as lambda spells it: where it goes, what it carries, whom its answer is about and what it may write. */
    static final class Call {
        String fn, entity, subj, method, address, json;
        final Map<String, String> headers = new LinkedHashMap<String, String>();
        final List<String> filled = new ArrayList<String>(), ceiling = new ArrayList<String>();
        Object[] yieldsOf, successOf, observed = new Object[0];
    }

    /** One call a write owes: the Predicate's call for the instance, made, and its answer written back. */
    static void one(String fn, String entity, String who, List<String> lines) {
        Object read = Serve.read();
        Call c = prepare(fn, entity, read, lines);
        if (c != null && guard(c, read, who, lines)) made(c, read, who, lines);
    }

    // what the call is, or nothing where it is not this host's, not performed, refused, or only said (a connection not live)
    static Call prepare(String fn, String entity, Object read, List<String> lines) {
        Call c = new Call();
        c.fn = fn;
        c.entity = entity;
        if (seq(Arest.Ev("store:pf_external", new Object[] { new Object[] { new Object[] { fn, entity } }, read })).length == 0) {
            lines.add("not this host's: the Predicate is bound to a definition of lambda's own");
            return null;
        }
        String mode = atom(Arest.Ev("perform:send_mode_of", new Object[] { fn, read }));
        if (mode.isEmpty()) { lines.add("not performed: its connection declares no Send Mode"); return null; }
        boolean live = "live".equals(mode);
        Object[] call = seq(Arest.Ev("perform:call_for", new Object[] { fn, read }));
        String method = call.length > 0 ? atom(call[0]) : "", address = call.length > 1 ? atom(call[1]) : "";
        if (method.isEmpty() || address.isEmpty()) { lines.add("refused: the model does not fully address this call"); return null; }
        StringBuilder qs = new StringBuilder();
        for (Object q : seq(Arest.Ev("perform:params_of", new Object[] { fn, entity, read }))) {
            Object[] p = seq(q);
            if (p[1] instanceof Object[]) { lines.add("refused: declared query parameter '" + p[0] + "' has no fact to fill it"); return null; }
            if (qs.length() > 0) qs.append('&');
            qs.append(enc(String.valueOf(p[0]))).append('=').append(enc(String.valueOf(p[1])));
        }
        if (qs.length() > 0) address += (address.indexOf('?') >= 0 ? "&" : "?") + qs;
        Map<String, String> headers = c.headers;
        for (Object hv : seq(Arest.Ev("perform:headers_of", new Object[] { fn, read }))) {
            Object[] p = seq(hv);
            headers.put(String.valueOf(p[0]), String.valueOf(p[1]));
        }
        // the credential is the connection's, opened here and nowhere else, and carried in the header the model names
        Object auth = Arest.Ev("perform:auth_header_of", new Object[] { fn, read });
        if (!(auth instanceof Object[])) {
            String secret;
            try { secret = written(fn, secret(fn, read), read); }
            catch (RuntimeException e) { lines.add("refused: " + e.getMessage()); return null; }
            if (secret == null) { lines.add("refused: the credential encoding this connection declares is not one this host writes"); return null; }
            if (!secret.isEmpty()) {
                String k = String.valueOf(auth), had = headers.get(k);
                headers.put(k, (had == null || had.isEmpty() ? "" : had + " ") + secret);
            }
        }
        // the body, path by path: a Body Template with no placeholder whose text is an integer is that number
        java.util.Set<String> numeric = new java.util.HashSet<String>();
        for (Object t : seq(Arest.Ev("perform:tpls_of", new Object[] { fn, read }))) {
            Object[] p = seq(t);
            if (p.length > 1 && !(p[1] instanceof Object[]) && String.valueOf(p[1]).matches("-?\\d+")) numeric.add(String.valueOf(p[0]));
        }
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        List<String> filled = c.filled;
        for (Object b : seq(Arest.Ev("perform:body_of", new Object[] { fn, entity, read }))) {
            Object[] p = seq(b);
            String path = String.valueOf(p[0]);
            if (p[1] instanceof Object[]) { lines.add("refused: declared path '" + path + "' has no fact to fill it"); return null; }
            setPath(body, path, numeric.contains(path) ? (Object) Long.valueOf(String.valueOf(p[1])) : (Object) String.valueOf(p[1]));
            filled.add(path);
        }
        String json = Gui.Json.write(body);
        Object subject = Arest.Ev("perform:subject_of", new Object[] { fn, entity, read });
        String subj = subject instanceof Object[] ? entity : String.valueOf(subject);
        for (Object ft : seq(Arest.Ev("main:pf_creates", new Object[] { fn, read }))) c.ceiling.add(atom(ft));
        Object[] yieldsOf = seq(Arest.Ev("perform:yields_of", new Object[] { fn, read }));
        Object[] successOf = seq(Arest.Ev("perform:success_of", new Object[] { fn, subj, read }));
        if (!live) {
            List<Object> would = new ArrayList<Object>();
            for (Object t : yieldsOf) would.add(new Object[] { seq(t)[1] });
            List<Object> then = new ArrayList<Object>();
            for (Object r : successOf) then.add(r);
            lines.add(mode + " -- would " + method + " " + address + " with a body of " + json.length() + " characters filling " + String.join(", ", filled)
                + " about " + subj + "; its answer would yield " + (would.isEmpty() ? "nothing" : names(would))
                + " and its success assert " + (then.isEmpty() ? "nothing" : names(then)) + "; nothing is sent and nothing written");
            return null;
        }
        c.subj = subj;
        c.method = method;
        c.address = address;
        c.json = json;
        c.yieldsOf = yieldsOf;
        c.successOf = successOf;
        return c;
    }

    // the name is resolved where the request is made, and an address inside a blocked range refuses the send
    static boolean guard(Call c, Object read, String who, List<String> lines) {
        String fn = c.fn;
        String bare = atom(Arest.Ev("net:host", c.address)).replaceAll("^\\[|\\]$", "");
        List<Object> addrs = new ArrayList<Object>();
        try { for (java.net.InetAddress a : java.net.InetAddress.getAllByName(bare)) addrs.add(a.getHostAddress()); }
        catch (java.net.UnknownHostException e) { lines.add("refused: the host " + bare + " does not resolve"); return false; }
        Object system = Arest.Ev("perform:system_of", new Object[] { fn, read });
        Object[] observed = system instanceof Object[] ? new Object[0]
            : seq(Arest.Ev("perform:resolved_facts", new Object[] { String.valueOf(system), addrs.toArray() }));
        c.observed = observed;
        Object blocked = Arest.Ev("perform:blocked_address", new Object[] { addrs.toArray(), read });
        if (!(blocked instanceof Object[]) && !String.valueOf(blocked).isEmpty()) {
            lines.add("refused: the host " + bare + " resolves to " + blocked + ", inside a blocked range");
            if (observed.length > 0) back("recorded what its host resolved to", observed, who, lines);
            return false;
        }
        return true;
    }

    // the send, and what it writes back: what the call established by succeeding, what its answer yields, or its Failure
    static void made(Call c, Object read, String who, List<String> lines) {
        String fn = c.fn, entity = c.entity, subj = c.subj, method = c.method, address = c.address, json = c.json;
        List<String> filled = c.filled, ceiling = c.ceiling;
        Object[] yieldsOf = c.yieldsOf, successOf = c.successOf, observed = c.observed;
        Sent a = post(method, address, c.headers, json);
        try { Arest.Ev("log:response", new Object[] { fn, method, address, String.valueOf(a.status), a.error != null ? a.error : a.text }); } catch (RuntimeException e) { }
        boolean ok = a.status >= 200 && a.status < 300;
        lines.add(method + " " + address + (a.error != null ? " failed: " + cut(a.error, 200) : " answered " + a.status) + ", sent a body of " + json.length()
            + " characters filling " + String.join(", ", filled));
        List<String> outside = new ArrayList<String>();
        if (ok) {
            // what the call established by succeeding first, then what its answer yields, each within what it may create
            for (Object r : successOf) {
                Object[] row = texts(r);
                if (row.length == 0) continue;
                if (ceiling.contains(String.valueOf(row[0]))) back("asserted " + row[0] + " of " + subj, new Object[] { row }, who, lines);
                else outside.add(String.valueOf(row[0]));
            }
            Object parsed;
            try { parsed = Gui.Json.parse(a.text); } catch (RuntimeException e) { parsed = null; }
            List<Object> yields = new ArrayList<Object>();
            if (parsed instanceof Map || parsed instanceof Object[]) {
                List<Object> quads = new ArrayList<Object>();
                for (Object t : yieldsOf) {
                    Object[] p = seq(t);
                    Object got = getPath(parsed, String.valueOf(p[0]));
                    quads.add(new Object[] { String.valueOf(p[0]), String.valueOf(p[1]), String.valueOf(p[2]), got == null ? (Object) new Object[0] : (Object) text(got) });
                }
                for (Object r : seq(Arest.Ev("perform:yield_rows", new Object[] { quads.toArray(), subj, read }))) {
                    Object[] row = texts(r);
                    if (row.length == 0) continue;
                    if (ceiling.contains(String.valueOf(row[0]))) yields.add(row); else outside.add(String.valueOf(row[0]));
                }
            }
            if (!yields.isEmpty()) back("wrote back what the answer yields (" + names(yields) + ") of " + subj, yields.toArray(), who, lines);
        } else {
            // a call that went out and failed is recorded as a Failure, its facts together
            String reason = a.error != null ? a.error : "HTTP " + a.status + ": " + cut(a.text, 500);
            String now = java.time.Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MILLIS).toString();
            Object[] failure = seq(Arest.Ev("perform:failure_rows", new Object[] { fn, entity, reason, now, read }));
            if (failure.length > 0) back("recorded the failure", failure, who, lines);
            else lines.add("no Failure is declared for it, so none is recorded");
        }
        for (String ft : outside) lines.add("not written, outside what " + fn + " may create: " + ft);
        record(fn, address, String.valueOf(a.status), lines, who);
        if (observed.length > 0) back("recorded what its host resolved to", observed, who, lines);
    }

    /** The verb over a Source: its pages read one request at a time and each handed back through the verb. */
    static Object[] pages(String name, String who, Object[] args) {
        Object x = args.length > 0 ? args[0] : new Object[0];
        // a page passed with the call is the answer already in hand, an empty one too (fed:arg)
        if (x instanceof Object[] && ((Object[]) x).length > 3) return Serve.verb(name, who, x);
        Object source = x instanceof Object[] ? (((Object[]) x).length > 0 ? ((Object[]) x)[0] : "") : x;
        Object bindings = x instanceof Object[] && ((Object[]) x).length > 1 ? ((Object[]) x)[1] : new Object[0];
        Object read = Serve.read();
        Object fn = Arest.Ev("fed:connector", new Object[] { source, read });
        if (fn instanceof Object[]) return Serve.verb(name, who, x);          // lambda refuses it, and says why
        Rd rd = readerFor(String.valueOf(fn), read);
        if (rd.awaits) {
            Object[] q = Serve.verb(name, who, new Object[] { source, bindings, new Object[0] });
            long st = ((Number) q[1]).longValue();
            return new Object[] { "awaits a driver: this host registers no Fetcher '" + rd.fetcher + "', so this read is the caller's -- " + q[0]
                + " -- and what it answers comes back as the page: [source, bindings, [], page]", st >= 400 ? st : 202L };
        }
        if (rd.refusal != null) return new Object[] { rd.refusal, 501L };
        List<String> lines = new ArrayList<String>();
        Object cursor = new Object[0];
        int pages = 0;
        long status = 200;
        for (;;) {
            Object[] q = Serve.verb(name, who, new Object[] { source, bindings, cursor });
            Object req;
            try { req = Gui.Json.parse(String.valueOf(q[0])); } catch (RuntimeException e) { req = null; }
            if (!(req instanceof Object[]) || ((Object[]) req).length < 3 || !"request".equals(String.valueOf(((Object[]) req)[0]))) {
                long st = ((Number) q[1]).longValue();
                return new Object[] { String.valueOf(q[0]), st >= 400 ? st : 400L };
            }
            Got got = "mbox".equals(rd.fetcher) ? fetchMbox(rd, (Object[]) req, lines, who) : fetchOne(rd, (Object[]) req, lines, who);
            if (got.notPerformed) { lines.add(got.text); break; }
            if (got.status >= 400) { lines.add(got.text); status = 502; break; }
            Object[] out = Serve.verb(name, who, new Object[] { source, bindings, cursor, got.body });
            pages++;
            lines.add("page " + pages + " (" + got.method + " " + got.url + "): " + cut(String.valueOf(out[0]), 400));
            Object ans;
            try { ans = Gui.Json.parse(String.valueOf(out[0])); } catch (RuntimeException e) { ans = null; }
            long st = ((Number) out[1]).longValue();
            if (st >= 400 || !(ans instanceof Object[])) { status = st >= 400 ? st : 500; break; }
            Object more = find(ans, "more"), next = find(ans, "next");
            Object[] nextCursor = next instanceof Object[] ? (Object[]) next : new Object[0];
            if (more == null || !"T".equals(String.valueOf(more)) || nextCursor.length < 2) break;
            if (Arrays.deepEquals(nextCursor, cursor instanceof Object[] ? (Object[]) cursor : new Object[0])) { lines.add("the cursor did not move; stopped"); status = 508; break; }
            cursor = Gui.fromJson(nextCursor);
        }
        return new Object[] { String.join("\n", lines), status };
    }
}
