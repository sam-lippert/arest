import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

// The platform's registrations: one body for each Function that
// metamodel/resolution.md declares with Definition Origin 'registered' and
// lambda applies, written from its row there -- what it accepts, what it
// yields, and the note beside the row. That declaration is the specification:
// each of these is outside D (a clock, a file, entropy, a database engine),
// which is why it is registered and not defined (AREST.tex Def. 9), and a body
// that decides more than its row says is meaning in the host. The render:
// controls are the Swing container's (Gui.java).
//
// A write call is one transaction: it commits whole or leaves the database as
// it was, as a transition does (Backus 14.3.1).
public final class Registrations {
    private Registrations() { }

    static final String KEY = "AREST_MASTER_KEY";
    static final DateTimeFormatter ISO =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);
    static final SecureRandom ENTROPY = new SecureRandom();
    // the directory the composition's lambda was read from, where the dev key's .env is
    static String root;

    // The master key: the environment's, else the AREST_MASTER_KEY line of the .env beside the
    // lambda, a dev key kept on disk in plaintext. Never printed. An agent that
    // holds the key (as git asks a credential helper, or a key in pageant) goes before the file.
    static String masterKey() {
        String k = System.getenv(KEY);
        if (present(k)) return k;
        if (root == null) return null;
        Path p = Paths.get(root, ".env");
        if (!Files.exists(p)) return null;
        for (String line : new String(io(() -> Files.readAllBytes(p)), StandardCharsets.UTF_8).split("\r?\n")) {
            String t = line.trim();
            if (!t.startsWith(KEY)) continue;
            String r = t.substring(KEY.length()).trim();
            if (!r.startsWith("=")) continue;
            String v = r.substring(1).trim();
            if (v.length() > 1 && ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))))
                v = v.substring(1, v.length() - 1);
            return present(v) ? v : null;
        }
        return null;
    }

    public static void register(String lambdaPath) {
        root = Paths.get(lambdaPath).toAbsolutePath().normalize().getParent().toString().replace('\\', '/');

        // sequence -> text: now, ISO 8601 in UTC
        Arest.register("clock", x -> ISO.format(Instant.now()));
        // number-pair -> number: <x, s> to x at scale s, half away from zero.
        // This host's numbers are integers, so a scale of 0 or more is x itself.
        Arest.register("round", Registrations::round);

        // path -> name-list; path -> text; path-and-text -> path, written
        // beside itself and moved in, so a reader never meets half of it
        Arest.register("fs:dir", x -> {
            String[] names = Paths.get(text(x)).toFile().list();
            if (names == null) throw new RuntimeException("fs:dir: not a directory: " + text(x));
            return java.util.Arrays.copyOf(names, names.length, Object[].class);
        });
        Arest.register("fs:read", x -> new String(io(() -> Files.readAllBytes(Paths.get(text(x)))), StandardCharsets.UTF_8));
        Arest.register("fs:write", x -> {
            String path = text(Arest.at(x, 0));
            unwatch(path);
            Path build = Paths.get(path + ".build");
            io(() -> Files.write(build, text(Arest.at(x, 1)).getBytes(StandardCharsets.UTF_8)));
            io(() -> Files.move(build, Paths.get(path), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE));
            return path;
        });
        // text -> cell-list: a carrier read as cells, registering nothing
        Arest.register("carrier:cells", x -> Reader.cells(text(x)));
        // object -> path: the directory the composition's lambda was read from
        Arest.register("module:root", x -> root);
        // object -> identifier: the storage engine this host provides
        Arest.register("storage:engine", x -> "sqlite");

        // text -> digest: SHA-256, hex
        Arest.register("crypt:digest", x -> hex(sha256(text(x).getBytes(StandardCharsets.UTF_8))));
        // key-and-text -> ciphertext; key-and-ciphertext -> text. AES-256-GCM
        // under the SHA-256 of the key's text, as one text atom: base64 of
        // iv (12) || tag (16) || ciphertext
        Arest.register("crypt:encrypt", Registrations::encrypt);
        Arest.register("crypt:decrypt", Registrations::decrypt);
        // env-path -> key-fingerprint: a new key appended to the file, never
        // answered; refused where a key is set or already in the file
        Arest.register("crypt:genkey", Registrations::genkey);
        // object -> boolean: whether the platform holds a key
        Arest.register("crypt:keyed", x -> present(masterKey()) ? "T" : "F");
        // type-and-value-and-store -> text: lambda's hook:write under the key
        Arest.register("hook:seal", x -> {
            String key = masterKey();
            if (!present(key)) throw new RuntimeException("hook:seal: there is no " + KEY + " to store a value through a Function with");
            return Arest.Ev("hook:write", new Object[] { key, Arest.at(x, 0), Arest.at(x, 1), Arest.at(x, 2) });
        });

        Arest.register("sqlite:exec", x -> {
            String path = text(Arest.at(x, 0));
            write(path, c -> { try (Statement st = c.createStatement()) { st.executeUpdate(text(Arest.at(x, 1))); } return null; });
            return path;
        });
        Arest.register("sqlite:run", Registrations::run);
        Arest.register("sqlite:query", x -> sql(() -> read(text(Arest.at(x, 0)), text(Arest.at(x, 1)), Arest.seq(Arest.at(x, 2)))));
        Arest.register("sqlite:scratch", x -> sql(() -> {
            try (Connection c = open(":memory:", false)) {
                try (Statement st = c.createStatement()) { st.executeUpdate(text(Arest.at(x, 0))); }
                return query(c, text(Arest.at(x, 1)), Arest.seq(Arest.at(x, 2)), false);
            }
        }));
        Arest.register("sqlite:program", Registrations::program);
        Arest.register("sqlite:data_version", x -> sql(() -> {
            try (Statement st = watched(text(x)).createStatement(); ResultSet rs = st.executeQuery("pragma data_version")) {
                rs.next();
                return Long.valueOf(rs.getLong(1));
            }
        }));
        Arest.register("sqlite:fresh", x -> {
            String path = text(x);
            unwatch(path);
            for (String p : new String[] { path, path + "-wal", path + "-shm", path + "-journal" })
                io(() -> Files.deleteIfExists(Paths.get(p)));
            return path;
        });
        Arest.register("sqlite:install", x -> {
            String build = text(Arest.at(x, 0)), path = text(Arest.at(x, 1));
            if (Files.exists(Paths.get(path)))
                throw new RuntimeException("sqlite:install refuses: " + path + " exists; a store that exists is changed in place, never overwritten by a fresh build");
            unwatch(build); unwatch(path);
            io(() -> Files.move(Paths.get(build), Paths.get(path)));
            return path;
        });
        Arest.register("sqlite:copy", x -> {
            String from = text(Arest.at(x, 0)), to = text(Arest.at(x, 1));
            if (from.equals(to) || !Files.exists(Paths.get(from))) throw new RuntimeException("sqlite:copy refuses: nothing to copy from " + from + " to " + to);
            unwatch(to);
            for (String p : new String[] { to, to + "-wal", to + "-shm", to + "-journal" })
                io(() -> Files.deleteIfExists(Paths.get(p)));
            sql(() -> {
                try (Connection c = open(from, true); PreparedStatement st = c.prepareStatement("vacuum into ?")) {
                    st.setString(1, to);
                    st.execute();
                }
                return null;
            });
            return to;
        });
        Arest.register("sqlite:replace", x -> {
            String build = text(Arest.at(x, 0)), path = text(Arest.at(x, 1));
            unwatch(build); unwatch(path); unwatch(path + ".prior");
            if (Files.exists(Paths.get(path))) {
                io(() -> Files.deleteIfExists(Paths.get(path + ".prior")));
                io(() -> Files.move(Paths.get(path), Paths.get(path + ".prior")));
            }
            io(() -> Files.move(Paths.get(build), Paths.get(path)));
            return path;
        });
    }

    // ---- the number ---------------------------------------------------------

    static Object round(Object x) {
        Object v = Arest.at(x, 0), s = Arest.at(x, 1);
        if (!(v instanceof Long)) throw new RuntimeException("round on non-number");
        if (!(s instanceof Long)) throw new RuntimeException("round to a non-integer scale");
        long n = (Long) v, scale = (Long) s;
        if (scale >= 0) return v;
        // a 64-bit number is under half of 10^20, so it rounds to 0 there and beyond
        if (scale <= -20) return Long.valueOf(0);
        java.math.BigInteger pow = java.math.BigInteger.TEN.pow((int) -scale);
        java.math.BigInteger[] qr = java.math.BigInteger.valueOf(n).divideAndRemainder(pow);
        java.math.BigInteger q = qr[0];
        if (qr[1].abs().shiftLeft(1).compareTo(pow) >= 0) q = q.add(java.math.BigInteger.valueOf(n < 0 ? -1 : 1));
        return Long.valueOf(q.multiply(pow).longValueExact());
    }

    // ---- crypt --------------------------------------------------------------

    static Object encrypt(Object x) {
        try {
            byte[] iv = new byte[12];
            ENTROPY.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, aesKey(Arest.at(x, 0)), new GCMParameterSpec(128, iv));
            byte[] sealed = c.doFinal(text(Arest.at(x, 1)).getBytes(StandardCharsets.UTF_8));
            // the platform answers ciphertext || tag; the atom carries iv || tag || ciphertext
            int body = sealed.length - 16;
            byte[] out = new byte[12 + sealed.length];
            System.arraycopy(iv, 0, out, 0, 12);
            System.arraycopy(sealed, body, out, 12, 16);
            System.arraycopy(sealed, 0, out, 28, body);
            return Base64.getEncoder().encodeToString(out);
        } catch (java.security.GeneralSecurityException e) {
            throw new RuntimeException("crypt:encrypt: " + e.getMessage());
        }
    }

    static Object decrypt(Object x) {
        byte[] all = Base64.getDecoder().decode(text(Arest.at(x, 1)));
        if (all.length < 28) throw new RuntimeException("crypt:decrypt on a ciphertext shorter than its iv and tag");
        byte[] sealed = new byte[all.length - 12];
        System.arraycopy(all, 28, sealed, 0, all.length - 28);
        System.arraycopy(all, 12, sealed, all.length - 28, 16);
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, aesKey(Arest.at(x, 0)), new GCMParameterSpec(128, all, 0, 12));
            return new String(c.doFinal(sealed), StandardCharsets.UTF_8);
        } catch (java.security.GeneralSecurityException e) {
            throw new RuntimeException("crypt:decrypt: " + e.getMessage());
        }
    }

    static Object genkey(Object x) {
        String path = text(x);
        if (present(System.getenv(KEY))) throw new RuntimeException("crypt:genkey refuses: " + KEY + " is already set in the environment");
        Path p = Paths.get(path);
        String had = Files.exists(p) ? new String(io(() -> Files.readAllBytes(p)), StandardCharsets.UTF_8) : "";
        if (Pattern.compile("^\\s*" + KEY + "\\s*=", Pattern.MULTILINE).matcher(had).find())
            throw new RuntimeException("crypt:genkey refuses: " + KEY + " is already in " + path);
        byte[] raw = new byte[32];
        ENTROPY.nextBytes(raw);
        String key = Base64.getEncoder().encodeToString(raw);
        String line = (had.isEmpty() || had.endsWith("\n") ? "" : "\n") + KEY + "=" + key + "\n";
        io(() -> Files.write(p, line.getBytes(StandardCharsets.UTF_8),
            java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND));
        return hex(sha256(key.getBytes(StandardCharsets.UTF_8))).substring(0, 12);
    }

    static SecretKeySpec aesKey(Object key) {
        return new SecretKeySpec(sha256(text(key).getBytes(StandardCharsets.UTF_8)), "AES");
    }

    static byte[] sha256(byte[] b) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(b);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    static String hex(byte[] d) {
        StringBuilder s = new StringBuilder();
        for (byte x : d) s.append(String.format("%02x", x));
        return s.toString();
    }

    // ---- sqlite -------------------------------------------------------------

    // path-and-sql-and-rows -> number: one prepared statement per row, # bound
    // as NULL, the count of rows run
    static Object run(Object x) {
        String path = text(Arest.at(x, 0)), statement = text(Arest.at(x, 1));
        Object[] rows = Arest.seq(Arest.at(x, 2));
        return write(path, c -> {
            int n = 0;
            try (PreparedStatement st = c.prepareStatement(statement)) {
                for (Object r : rows) {
                    bind(st, Arest.seq(r), true);
                    try { st.executeUpdate(); }
                    catch (SQLException e) { throw new SQLException(e.getMessage() + " -- row " + (n + 1) + " of " + rows.length); }
                    n++;
                }
            }
            return Long.valueOf(n);
        });
    }

    // path-and-steps -> program-answer: the steps in order between one begin and
    // one commit. A step is <kind, sql, parameters, guard>, the last two
    // optional, each parameter bound and # bound as NULL. exec answers the rows
    // its statement changed (its statements, with no parameter); rows answers
    // its rows; fix runs its statement again until it changes nothing and
    // answers the rows it changed in all; refuse answers no row or stops the
    // program, which answers <refused, its step, its rows>; deny answers its
    // rows, and a row any deny step answers makes the program's answer
    // <denied, each <step, rows>>. A guard is a select, and the step it guards
    // is asked only when the guard answers a row. A refused or denied program
    // is rolled back; otherwise it answers <committed, each step's answer>.
    static Object program(Object x) {
        String path = text(Arest.at(x, 0));
        Object[] steps = Arest.seq(Arest.at(x, 1));
        synchronized (Registrations.class) {
            return sql(() -> {
                if (kept(path)) { KEPT_WRITES++; return programOn(writer(path), steps); }
                try (Connection c = open(path, false)) {
                    c.setAutoCommit(false);
                    return programOn(c, steps);
                }
            });
        }
    }

    static Object[] programOn(Connection c, Object[] steps) throws SQLException {
        try {
            Object[] out = steps(c, steps);
            if ("committed".equals(out[0])) c.commit(); else c.rollback();
            return out;
        } catch (SQLException | RuntimeException e) {
            try { c.rollback(); } catch (SQLException ignored) { }
            throw e;
        }
    }

    static Object[] steps(Connection c, Object[] steps) throws SQLException {
        List<Object> answers = new ArrayList<>(), denied = new ArrayList<>();
        int n = 0;
        for (Object step : steps) {
            n++;
            Object[] s = Arest.seq(step);
            String kind = text(s[0]), statement = text(s[1]);
            Object[] ps = s.length > 2 ? Arest.seq(s[2]) : new Object[0];
            String guard = s.length > 3 && !"fix".equals(kind) ? text(s[3]) : "";
            try {
                if (!guard.isEmpty() && query(c, guard, new Object[0], true).length == 0) { answers.add(new Object[0]); continue; }
                if ("exec".equals(kind)) {
                    long was = changes(c);
                    if (ps.length > 0) { try (PreparedStatement st = c.prepareStatement(statement)) { bind(st, ps, true); st.executeUpdate(); } }
                    else { try (Statement st = c.createStatement()) { st.executeUpdate(statement); } }
                    answers.add(Long.valueOf(changes(c) - was));
                } else if ("rows".equals(kind)) {
                    answers.add(query(c, statement, ps, true));
                } else if ("fix".equals(kind)) {
                    long was = changes(c);
                    try (PreparedStatement st = c.prepareStatement(statement)) {
                        for (long before = -1; before != changes(c); ) { before = changes(c); bind(st, ps, true); st.executeUpdate(); }
                    }
                    answers.add(Long.valueOf(changes(c) - was));
                } else if ("refuse".equals(kind)) {
                    Object[] rows = query(c, statement, ps, true);
                    if (rows.length > 0) return new Object[] { "refused", Long.valueOf(n), rows };
                    answers.add(rows);
                } else if ("deny".equals(kind)) {
                    Object[] rows = query(c, statement, ps, true);
                    answers.add(rows);
                    if (rows.length > 0) denied.add(new Object[] { Long.valueOf(n), rows });
                } else {
                    throw new RuntimeException("no step of kind " + kind);
                }
            } catch (SQLException | RuntimeException e) {
                throw new RuntimeException("sqlite:program, step " + n + " (" + kind + "): " + e.getMessage()
                    + " -- " + statement.substring(0, Math.min(300, statement.length())));
            }
        }
        if (!denied.isEmpty()) return new Object[] { "denied", denied.toArray() };
        return new Object[] { "committed", answers.toArray() };
    }

    static long changes(Connection c) throws SQLException {
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select total_changes()")) {
            rs.next();
            return rs.getLong(1);
        }
    }

    // a statement's rows, each value the text SQLite gives it and NULL as #
    static Object[] query(Connection c, String statement, Object[] ps, boolean hashIsNull) throws SQLException {
        try (PreparedStatement st = c.prepareStatement(statement)) {
            bind(st, ps, hashIsNull);
            try (ResultSet rs = st.executeQuery()) {
                int w = rs.getMetaData().getColumnCount();
                List<Object> out = new ArrayList<>();
                while (rs.next()) {
                    Object[] r = new Object[w];
                    for (int i = 0; i < w; i++) { String v = rs.getString(i + 1); r[i] = v == null ? "#" : v; }
                    out.add(r);
                }
                return out.toArray();
            }
        }
    }

    static void bind(PreparedStatement st, Object[] ps, boolean hashIsNull) throws SQLException {
        for (int i = 0; i < ps.length; i++) {
            Object v = ps[i];
            if (v instanceof Object[]) throw new RuntimeException("a sequence where a value belongs");
            if (hashIsNull && "#".equals(v)) st.setNull(i + 1, java.sql.Types.NULL);
            else if (v instanceof Long) st.setLong(i + 1, (Long) v);
            else st.setString(i + 1, (String) v);
        }
    }

    interface Work<T> { T on(Connection c) throws SQLException; }

    // one write call, one transaction
    static <T> T write(String path, Work<T> work) {
        synchronized (Registrations.class) {
            return sql(() -> {
                if (kept(path)) { KEPT_WRITES++; return writeOn(writer(path), work); }
                try (Connection c = open(path, false)) {
                    c.setAutoCommit(false);
                    return writeOn(c, work);
                }
            });
        }
    }

    static <T> T writeOn(Connection c, Work<T> work) throws SQLException {
        try {
            T out = work.on(c);
            c.commit();
            return out;
        } catch (SQLException | RuntimeException e) {
            try { c.rollback(); } catch (SQLException ignored) { }
            throw e;
        }
    }

    static Connection open(String path, boolean readOnly) throws SQLException {
        Properties p = new Properties();
        // SQLITE_OPEN_READONLY, or SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE
        p.setProperty("open_mode", readOnly ? "1" : "6");
        return DriverManager.getConnection("jdbc:sqlite:" + path, p);
    }

    // PRAGMA data_version moves when ANOTHER connection commits, so it is asked
    // on a connection kept for that alone, one per path, closed before its file
    // is removed or renamed
    static final Map<String, Connection> WATCHED = new HashMap<>();

    static Connection watched(String path) throws SQLException {
        Connection c = WATCHED.get(path);
        if (c == null) { c = open(path, true); WATCHED.put(path, c); }
        return c;
    }

    static void unwatch(String path) {
        Connection c = WATCHED.remove(path);
        if (c != null) try { c.close(); } catch (SQLException ignored) { }
        unread(path);
    }

    // A read is a statement on the store's one read-only connection, kept open: a connection opened for each statement
    // parses the store's whole schema again (17-18 ms on an app's store, against 0.5 ms for a statement that reads no
    // table). Autocommit gives every statement its own read transaction, so it sees what any connection committed, and
    // SQLite parses the schema again itself when another connection changes it. On Windows an open connection keeps its
    // file from being replaced or removed, so whatever replaces, moves or removes a store closes it first (unwatch).
    static final Map<String, Connection> READERS = new HashMap<>();

    static synchronized Object[] read(String path, String statement, Object[] ps) throws SQLException {
        if (!kept(path)) {
            try (Connection c = open(path, true)) { return query(c, statement, ps, false); }
        }
        String key = key(path);
        Connection c = READERS.get(key);
        if (c == null) { c = open(path, true); READERS.put(key, c); }
        KEPT_READS++;
        try {
            return query(c, statement, ps, false);
        } catch (SQLException e) {
            // SQLite reads the schema again when a statement steps, not when it is prepared, so on a kept connection
            // a statement over what another connection created, dropped or altered since fails to compile (no such
            // table, a column count). It is asked once more on a connection opened for it, which reads the schema as
            // it stands; a statement that is wrong fails there the same way.
            READERS.remove(key);
            try { c.close(); } catch (SQLException ignored) { }
            c = open(path, true);
            READERS.put(key, c);
            return query(c, statement, ps, false);
        }
    }

    static synchronized void unread(String path) {
        if (!kept(path)) return;
        String key = key(path);
        Connection c = READERS.remove(key);
        if (c != null) try { c.close(); } catch (SQLException ignored) { }
        Connection w = WRITERS.remove(key);
        if (w != null) {
            try { w.rollback(); } catch (SQLException ignored) { }
            try { w.close(); } catch (SQLException ignored) { }
        }
    }

    // Only a store that is a file keeps its connections: `:memory:` (or a URI) is a new database for every connection.
    // A kept connection is this host's optimization, not lambda's: under AREST_NO_OVERRIDE, the one switch for them
    // all, every statement opens its own. KEPT_READS and KEPT_WRITES count what the kept ones ran, for the profile.
    static long KEPT_READS = 0, KEPT_WRITES = 0;
    static boolean kept(String path) {
        return !Arest.NO_OVERRIDE && !path.isEmpty() && !path.startsWith(":") && !path.startsWith("file:");
    }

    static String key(String path) { return Paths.get(path).toAbsolutePath().normalize().toString(); }

    // A write is one transaction on the store's one read-write connection, kept open like a read's: it begins when the
    // write's first statement runs and ends at its commit or rollback, so between writes it holds no lock.
    static final Map<String, Connection> WRITERS = new HashMap<>();

    static synchronized Connection writer(String path) throws SQLException {
        String key = key(path);
        Connection c = WRITERS.get(key);
        if (c == null || c.isClosed()) {
            c = open(path, false);
            c.setAutoCommit(false);
            WRITERS.put(key, c);
        }
        return c;
    }

    // ---- the atoms ----------------------------------------------------------

    static String text(Object x) {
        if (x instanceof Object[]) throw new RuntimeException("a sequence where a text belongs");
        return String.valueOf(x);
    }

    static boolean present(String s) { return s != null && !s.isEmpty(); }

    interface Io<T> { T get() throws java.io.IOException; }
    interface Sql<T> { T get() throws SQLException; }

    static <T> T io(Io<T> f) {
        try { return f.get(); } catch (java.io.IOException e) { throw new RuntimeException(e.toString()); }
    }

    static <T> T sql(Sql<T> f) {
        try { return f.get(); } catch (SQLException e) { throw new RuntimeException(e.getMessage()); }
    }
}
