// ONE READ OF A SOURCE, PERFORMED BY THE HOST THAT SERVES IT. A verb whose operand is a response (the accepts row
// `response-and-cells`: sync) is handed only a Source by its caller, and lambda then answers the REQUEST it would
// make. This host makes it: the Connector's Fetcher says who reads, the connection's Send Mode whether it may go
// out, and the connection's credential is the one access it carries, decrypted here and nowhere else. Each page the
// service answers goes back through the same verb, asserted in one step like any other write, until the answer says
// there is no more or the cursor stops moving. Lambda says what the request IS; nothing here builds one.
//
// This host registers two Fetchers. `fetch` is a direct HTTPS request whose answer is JSON. `mbox` reads a mailbox
// file on this machine, the one the connection's Secret Reference names, with the reader beside this class
// (mbox_read.py: Python's own mailbox and email), for the address the request's parameters name; it reads, and the
// file is not changed. Any other Fetcher is one this host does not register: the read is answered as the request it
// is, for the caller who holds that Fetcher to perform and pass back as the page. A connection that is not live
// answers what it would have done. A redirect is not followed, so a credential is never carried to an address the
// store did not declare.
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
    // the address whose mail is read. The file's path is the connection's secret: it goes to the reader in its
    // environment, and is in no line this host writes and no fact it records. What the reader prints is the page.
    static Got fetchMbox(Rd rd, Object[] req, List<String> lines, String who) {
        Got g = new Got();
        g.method = String.valueOf(req[1]);
        String from = "", to = "";
        StringBuilder qs = new StringBuilder();
        if (req.length > 3 && req[3] instanceof Object[]) for (Object pr : (Object[]) req[3]) {
            Object[] p = (Object[]) pr;
            String k = String.valueOf(p[0]), v = String.valueOf(p[1]);
            if ("from".equals(k)) from = v;
            if ("to".equals(k)) to = v;
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
