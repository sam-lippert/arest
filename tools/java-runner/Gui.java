import java.awt.Color;
import java.awt.Cursor;
import java.awt.Font;
import java.awt.Rectangle;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;

// The GUI CONTAINER, the placer. The defaults and the layout algorithms
// live in canon (ui:style is the Style slots as data; ui:arrange is
// PerformLayout as canon): this host asks for the PLACED LIST — every
// concrete control with the rectangle it is TOLD (SetLocation) — reads
// its colors and font sizes from ui:style, navigates by the addresses on
// backbtn and itemrow rows, and decides nothing. One piece of platform
// state: the current address. An unregistered control name throws.
public class Gui {
    static Object[] store;
    // the registered stack population - this container's form factor:
    // master list pane and detail content pane, like its siblings
    static Object stacks = new Object[] {
        new Object[] { "master", new Object[0] },
        new Object[] { "detail", new Object[0] } };
    static final JPanel masterCanvas = new JPanel(null);
    static final JPanel detailCanvas = new JPanel(null);
    static final JScrollPane masterScroller = new JScrollPane(masterCanvas);
    static final JScrollPane detailScroller = new JScrollPane(detailCanvas);
    static JPanel canvas;          // the pane being rebuilt
    static JScrollPane scroller;   // the pane being measured
    static final Map<String, String> STYLE = new HashMap<String, String>();

    static String sv(String prop) { return STYLE.get(prop); }
    static Color color(String prop) { return Color.decode(sv(prop)); }
    static int num(String prop) { return Integer.parseInt(sv(prop)); }
    static Font font(String sizeProp, int style) {
        return new Font(sv("fontFamily"), style, num(sizeProp));
    }

    static String text(Object atom) {
        if (atom instanceof Object[]) throw new RuntimeException("control payload is a sequence");
        return String.valueOf(atom);
    }

    static void register(String control, Function<Object[], JComponent> impl) {
        Arest.register("render:" + control, x -> impl.apply((Object[]) x));
    }

    static void navigate(Object addr) {
        new Thread(() -> {
            // one canon evaluation per navigation over the registered
            // stack population; then each pane renders its own view
            Object[] od = (Object[]) Arest.Ev("ui:navpe", new Object[] { store, stacks, addr });
            store = (Object[]) od[0];
            stacks = od[1];
            // ui:navpe answers a PAIR now -- there is no third slot, because the
            // journal is gone (Samuel, 2026-09-11). This station already ignored it.
            Object masterPlaced = panePlaced("master", masterScroller);
            Object detailPlaced = panePlaced("detail", detailScroller);
            SwingUtilities.invokeLater(() -> {
                canvas = masterCanvas; rebuild((Object[]) masterPlaced);
                canvas = detailCanvas; rebuild((Object[]) detailPlaced);
            });
        }).start();
    }

    static Object panePlaced(String pane, JScrollPane s) {
        scroller = s;
        Object tree = Arest.Ev("ui:pane_view", new Object[] { store, stacks, pane });
        return Arest.Ev("ui:arrange", new Object[] { tree, canvasWidth() });
    }

    static Integer canvasWidth() {
        int w = scroller.getViewport().getWidth();
        return Integer.valueOf(w > 0 ? w : num("frameW"));
    }

    static void rebuild(Object[] placed) {
        canvas.removeAll();
        // the render pass is canon (ui:render = alpha(apply(render:<name>)));
        // the host keeps only the SetLocation seam. Later placed rows paint
        // ABOVE earlier ones; Swing paints lower child indices on top, so
        // add in reverse.
        Object[] widgets = (Object[]) Arest.Ev("ui:render", placed);
        for (int i = widgets.length - 1; i >= 0; i--) {
            JComponent c = (JComponent) widgets[i];
            if (c != null) {
                Object[] r = (Object[]) placed[i];
                c.setBounds(num2(r[1]), num2(r[2]), num2(r[3]), num2(r[4]));
                canvas.add(c);
            }
        }
        canvas.revalidate();
        canvas.repaint();
    }

    static int num2(Object n) { return ((Integer) n).intValue(); }

    // ---- THE ONE SEAM TO SERVE ------------------------------------------
    //
    // ONE CALL, NO METHOD BRANCH. api() sends the method it is handed and
    // reads back what came; what a method MEANS is http:method_kinds' business
    // on the other side -- main:api0 dispatches on the KIND (nav, transition,
    // retraction, replacement) and never on the spelling -- so a container that
    // tested the method here would be deciding that for it. There is no
    // dispatch here, no rendering of the answer, no status decision: serve
    // answers <body, status> and this reports both.
    static String serveBase() {
        String url = System.getenv("AREST_SERVE");
        if (url != null && !url.isEmpty()) return url;
        String port = System.getenv("AREST_PORT");
        return "http://127.0.0.1:" + (port == null || port.isEmpty() ? "8787" : port);
    }

    // a resource is words, and serve decodes the whole path at once
    // (decodeURIComponent), so each segment is encoded and the slashes stay
    // slashes -- a table's real name has spaces in it and + is not one
    static String enc(String resource) {
        StringBuilder out = new StringBuilder();
        for (String seg : resource.split("/", -1)) {
            if (out.length() > 0) out.append("/");
            try { out.append(java.net.URLEncoder.encode(seg, "UTF-8").replace("+", "%20")); }
            catch (java.io.UnsupportedEncodingException e) { out.append(seg); }
        }
        return out.toString();
    }

    static String[] api(String method, String resource, String fact) {
        String where = serveBase() + "/" + enc(resource);
        try {
            java.net.HttpURLConnection c =
                (java.net.HttpURLConnection) new java.net.URL(where).openConnection();
            c.setRequestMethod(method);
            c.setConnectTimeout(3000);
            c.setReadTimeout(30000);
            if (fact != null) {
                c.setDoOutput(true);
                c.setRequestProperty("content-type", "application/json");
                c.getOutputStream().write(fact.getBytes("UTF-8"));
            }
            int status = c.getResponseCode();
            return new String[] { read(status < 400 ? c.getInputStream() : c.getErrorStream()),
                                  String.valueOf(status) };
        } catch (Exception e) {
            // A WRITE THAT DID NOT LAND IS NOT A WRITE -- the lesson the
            // journal above taught, spelled as a status of 0 rather than as a
            // fact folded into a store only this window can see.
            return new String[] { String.valueOf(e), "0" };
        }
    }

    static String read(java.io.InputStream in) throws java.io.IOException {
        if (in == null) return "";
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        for (int n = in.read(buf); n > 0; n = in.read(buf)) b.write(buf, 0, n);
        in.close();
        return new String(b.toByteArray(), "UTF-8");
    }

    // the fact as canon reads it: <id, fact type, value, fact type, value...>,
    // ui:create0's own address with the two words that named the screen dropped
    static String json(java.util.List<String> words) {
        StringBuilder s = new StringBuilder("[");
        for (int i = 0; i < words.size(); i++) {
            if (i > 0) s.append(",");
            s.append('"');
            for (char ch : words.get(i).toCharArray()) {
                if (ch == '"' || ch == '\\') s.append('\\').append(ch);
                else if (ch < 0x20) s.append(' ');
                else s.append(ch);
            }
            s.append('"');
        }
        return s.append("]").toString();
    }

    static int status(String[] answer) {
        try { return Integer.parseInt(answer[1]); } catch (NumberFormatException e) { return 0; }
    }

    // THE WRITE GOES OUT THROUGH SERVE AND IS READ BACK THROUGH SERVE, both
    // legs on the one seam: POST the fact to the group's resource, then GET
    // the item. The read-back is unconditional because it is the honest
    // question -- what does the server hold now? -- and a refusal answers it
    // as truthfully as an acceptance does. Only a write serve took is folded
    // into the store this window draws from.
    static boolean submit(String group, String id, java.util.List<String> fact) {
        String[] wrote = api("POST", group, json(fact));
        System.err.println("POST /" + group + " -> " + wrote[1] + " " + wrote[0]);
        String[] back = api("GET", group + "/" + id, null);
        System.err.println("GET /" + group + "/" + id + " -> " + back[1] + " " + back[0]);
        return status(wrote) < 400 && status(wrote) > 0;
    }

    static void registerComponents() {
        register("canvas", r -> {
            canvas.setBackground(color("layerBg"));
            canvas.setPreferredSize(new java.awt.Dimension(num2(r[3]), num2(r[4])));
            return null;
        });
        register("headerbar", r -> {
            JPanel p = new JPanel(null);
            p.setBackground(color("headerColor"));
            p.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, color("headerSepColor")));
            return p;
        });
        register("titletext", r -> {
            JLabel l = new JLabel(text(r[5]));
            l.setFont(font("titleSize", Font.BOLD));
            l.setForeground(color("titleColor"));
            return l;
        });
        register("backbtn", r -> {
            JButton b = new JButton(sv("backLabel"));
            b.setFont(font("textSize", Font.PLAIN));
            b.setForeground(color("linkColor"));
            b.setBorderPainted(false);
            b.setContentAreaFilled(false);
            b.setFocusPainted(false);
            b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            b.setHorizontalAlignment(JLabel.LEFT);
            b.addActionListener(e -> navigate(r[5]));
            return b;
        });
        register("sectionheader", r -> {
            JLabel l = new JLabel(text(r[5]));
            l.setFont(font("sectionSize", Font.PLAIN));
            l.setForeground(color("sectionTextColor"));
            l.setVerticalAlignment(JLabel.BOTTOM);
            return l;
        });
        register("sep", r -> {
            JPanel p = new JPanel();
            p.setBackground(color("sepColor"));
            return p;
        });
        register("itemrow", r -> {
            boolean linked = !(r[7] instanceof Object[] && ((Object[]) r[7]).length == 0);
            boolean sub = !(r[6] instanceof Object[] && ((Object[]) r[6]).length == 0);
            JPanel p = new JPanel(null);
            p.setBackground(color("itemBg"));
            int h = num2(r[4]);
            int w = num2(r[3]);
            // cell-internal rectangles are canon's (ui:iteminner), not ours
            Object[] inner = (Object[]) Arest.Ev("ui:iteminner",
                new Object[] { Integer.valueOf(w), Integer.valueOf(h), sub ? "T" : "F" });
            Object[] tr = (Object[]) inner[0], sr = (Object[]) inner[1], cr = (Object[]) inner[2];
            JLabel t = new JLabel(text(r[5]));
            t.setFont(font("textSize", Font.PLAIN));
            t.setForeground(linked ? color("linkColor") : color("textColor"));
            t.setBounds(num2(tr[0]), num2(tr[1]), num2(tr[2]), num2(tr[3]));
            p.add(t);
            if (sub) {
                JLabel s = new JLabel(text(r[6]));
                s.setFont(font("subtextSize", Font.PLAIN));
                s.setForeground(color("subtextColor"));
                s.setBounds(num2(sr[0]), num2(sr[1]), num2(sr[2]), num2(sr[3]));
                p.add(s);
            }
            if (linked) {
                JLabel ch = new JLabel(sv("chevGlyph"));
                ch.setFont(font("titleSize", Font.PLAIN));
                ch.setForeground(color("chevronColor"));
                ch.setBounds(num2(cr[0]), num2(cr[1]), num2(cr[2]), num2(cr[3]));
                p.add(ch);
                p.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
                Object addr = r[7];
                p.addMouseListener(new MouseAdapter() {
                    public void mouseClicked(MouseEvent e) { navigate(addr); }
                    public void mouseEntered(MouseEvent e) { p.setBackground(color("selectionColor")); }
                    public void mouseExited(MouseEvent e) { p.setBackground(color("itemBg")); }
                });
            }
            return p;
        });
        register("blocktext", r -> {
            JTextArea t = new JTextArea(text(r[5]));
            t.setEditable(false);
            t.setFont(new Font(Font.MONOSPACED, Font.PLAIN, num("blockSize")));
            t.setBackground(color("itemBg"));
            t.setForeground(color("textColor"));
            t.setBorder(BorderFactory.createEmptyBorder(num("pad"), num("pad"), num("pad"), num("pad")));
            return new JScrollPane(t);
        });
    }

    public static void main(String[] args) {
        // READ, not compiled in — the move Program.java already made and this
        // container did not. Composed.g.java was 2.16 MB of generated source
        // that python compose.py produced and javac chewed on every canon edit;
        // a parser has no such cap, and canon stays STATE (AREST.tex:59) rather
        // than object code a station cannot be handed a different D of.
        // Order matches the js concatenation: canon, then the carriers.
        // Composed.loadCarriers() loaded DS/NA/J, so scenarios is not among them
        // and the journal is legitimately empty until a transition fires.
        Reader.load(Reader.path("AREST_CANON", "../../arest"));
        Reader.load(Reader.path("AREST_DESIGN_STATE", "../norma-oracle/design-state"));
        Reader.load(Reader.path("AREST_NORMA_ANSWER", "../norma-oracle/norma-answer"));
        // no journal here: it is not a carrier of this container any more, and
        // ../norma-oracle/journal does not exist in this tree either.
        store = Arest.CELLS.toArray();
        Object[] style = (Object[]) Arest.Ev(
            new Object[] { "COMP", "theta:flatten", "ui:style" }, new Object[0]);
        for (Object row : style) {
            Object[] pv = (Object[]) row;
            STYLE.put((String) pv[0], String.valueOf(pv[1]));
        }
        registerComponents();
        // the storage surface: the one durable write, and nothing else -
        // the byte form, the timing, and the sequence are all canon's
        Arest.register("clock", x -> String.valueOf(System.currentTimeMillis()));
        // the entry controls: fields register their inputs by fact type,
        // the button submits <submit, group, id, ft, v...> - values from
        // every registered field, in field order
        final java.util.LinkedHashMap<String, javax.swing.JTextField> inputs =
            new java.util.LinkedHashMap<>();
        register("textbox", r -> {
            JPanel p = new JPanel(null);
            p.setBackground(color("layerBg"));
            javax.swing.JLabel l = new javax.swing.JLabel(text(r[5]));
            l.setForeground(color("sectionTextColor"));
            l.setBounds(0, 0, 300, 20);
            p.add(l);
            javax.swing.JTextField t = new javax.swing.JTextField();
            t.setBounds(0, 22, 300, 28);
            p.add(t);
            inputs.put(text(r[6]), t);
            return p;
        });
        register("button", r -> {
            JButton b = new JButton(text(r[5]));
            final String group = text(r[6]);
            b.addActionListener(e -> {
                javax.swing.JTextField idf = inputs.get(group);
                if (idf == null || idf.getText().isEmpty()) return;
                final String id = idf.getText();
                java.util.ArrayList<Object> addr = new java.util.ArrayList<>();
                addr.add("submit"); addr.add(group); addr.add(id);
                for (java.util.Map.Entry<String, javax.swing.JTextField> en : inputs.entrySet())
                    if (!en.getKey().equals(group) && !en.getValue().getText().isEmpty()) {
                        addr.add(en.getKey()); addr.add(en.getValue().getText());
                    }
                // the fact is the address without the two words that named the
                // screen; the same list serves both, because ui:create0 and
                // main:api read the same order
                final java.util.ArrayList<String> fact = new java.util.ArrayList<String>();
                for (int i = 2; i < addr.size(); i++) fact.add(String.valueOf(addr.get(i)));
                final Object[] address = addr.toArray();
                // off the event thread: the durable write is a network call,
                // and a frozen window is not a rendering of anything
                new Thread(() -> {
                    if (!submit(group, id, fact)) return;   // refused: what was
                    // typed stays typed, and no fact enters this window's store
                    SwingUtilities.invokeLater(() -> { inputs.clear(); navigate(address); });
                }).start();
            });
            return b;
        });
        // THE ONE DURABLE WRITE IS GONE BECAUSE IT NEVER HAPPENED (Samuel,
        // 2026-09-11: GUI runners should work; they can't be journal-bound).
        // This registered store:append to append the entry to
        // ../../apps/sherlock/journal while the boot above LOADED
        // ../norma-oracle/journal -- two different files, so whatever it wrote
        // its own boot could never read. NEITHER EXISTS, and both are fatal:
        //
        //   Reader.load throws `canon reader: cannot read` on a missing file,
        //   so the container died in main() on the journal load, before a
        //   window was ever shown;
        //   and had it got past that, this write throws too -- measured today
        //   by running the exact Files.write from this exact directory,
        //   `NoSuchFileException: ..\..\apps\sherlock\journal`, because CREATE
        //   makes a file and not a directory and arest/apps has never been in
        //   this tree -- on EVERY navigation, before either pane rendered.
        //
        // It compiled, which is all anything here ever checked.
        //
        // Removing both is what makes the container RUN, and it loses nothing:
        // the only sherlock/journal that exists anywhere -- Repos/apps/sherlock,
        // which is where ../../apps resolves if you run from arest/tools rather
        // than from here -- is ZERO BYTES. A write that has never landed under
        // any reading of its own path is not durability. It also matches the js
        // host, which registers store:append nowhere at all: the GUI containers
        // were the only registrants left.
        //
        // WHAT REPLACED IT IS SERVE, AND NOT A DATABASE DRIVER HERE (#108,
        // 2026-09-15). What stood here proposed fetching sqlite-jdbc so this
        // station could run the js host's emitToDb itself; the wpf container
        // carried the same proposal against Microsoft.Data.Sqlite. That is one
        // persistence implementation per platform, and Samuel ruled it out
        // (2026-09-14): a gui should just be the abstract ui as a thin hateoas
        // wrapper, and a platform factory renders the abstract ui. The
        // rendering half is already here -- the render:<control> registrations
        // ARE the platform factory, and ui:screen is the abstract ui -- so the
        // durable half is reached the way any other client reaches it: over
        // HTTP to serve, which applies main:api and does the validating, the
        // deriving, the emitting into the tables and the deciding of the
        // status, none of which is per-platform. api() above is the whole
        // seam; the button posts through it and reads back through it.

        // PAIRING TOTALITY, ASKED OF THIS CONTAINER (#108). register(control,
        // impl) IS the pairing -- iFactr's IPairable, whose abstract half is
        // complete without the native half, and Pair is the slot the native
        // control goes in -- so the registrations above are this container's
        // pairs and the control kinds are the abstract view types.
        // law:origin_boundary now takes the set that pairing built, and asks
        // the one question no store can answer about itself: does every
        // abstract control kind the store declares registered HAVE a
        // registration here? The law shipped inside every composed module and
        // nothing ever handed it a container's table, so the containers were
        // unchecked by the check written for them. An unpaired kind is a
        // window that dies mid-render on the first row that names it, so this
        // refuses before the frame and law:unpaired names what is missing.
        //
        // AND THE TWO HALVES ARE REPORTED APART, because they are MEASURED
        // apart here (2026-09-15). law:origins_match -- the store halves, the
        // old law verbatim -- answers F over this container's store, and it is
        // not the pairing: thirteen names the store declares registered
        // (the ten control kinds, store:append, crypt:encrypt, crypt:decrypt)
        // are in no canon cell's atoms, so manifest:origins cannot compute
        // them. They are in the js host's computed surface only because that
        // host BOOTS -- FILE projected, the meta-types reflected, the closure
        // taken -- and those cells carry the names as DATA. This container
        // reads and never boots, which is Boot.cs's own finding written down
        // in 2026-09-07: the hosts were not disagreeing about an answer, they
        // were answering over different stores. That is a store defect and
        // law:report is where it is gated; refusing a window over it would
        // trade a working container for a check that belongs elsewhere. The
        // PAIRING half is this container's own, and it IS fatal here.
        Object[] registered = Arest.PRIMS.keySet().toArray();
        Object[] pair = new Object[] { store, registered };
        Object[] kinds = (Object[]) Arest.Ev("law:ctl_declared", store);
        Object[] unpaired = (Object[]) Arest.Ev("law:unpaired", pair);
        System.err.println("law:origin_boundary over <store, " + registered.length
            + " registered>: " + Arest.Ev("law:origin_boundary", pair)
            + "  (store halves " + Arest.Ev("law:origins_match", store)
            + ", pairing " + Arest.Ev("law:paired", pair)
            + " over " + kinds.length + " declared control kinds)");
        if (!"T".equals(String.valueOf(Arest.Ev("law:paired", pair)))) {
            for (Object m : unpaired) System.err.println("  unpaired control kind: " + m);
            System.exit(2);
        }

        SwingUtilities.invokeLater(() -> {
            // the frame names its tenant, like the root layer
            String tenant = String.valueOf(((Object[]) Arest.Ev("ui:screen",
                new Object[] { store, new Object[0], new Object[0] }))[1]);
            JFrame frame = new JFrame(tenant);
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            masterScroller.setBorder(null);
            detailScroller.setBorder(null);
            masterScroller.getVerticalScrollBar().setUnitIncrement(16);
            detailScroller.getVerticalScrollBar().setUnitIncrement(16);
            masterScroller.setPreferredSize(new java.awt.Dimension(320, 0));
            JPanel split = new JPanel(new java.awt.BorderLayout());
            split.add(masterScroller, java.awt.BorderLayout.WEST);
            split.add(detailScroller, java.awt.BorderLayout.CENTER);
            frame.setContentPane(split);
            frame.setSize(num("frameW"), num("frameH"));
            frame.setLocationByPlatform(true);
            frame.setVisible(true);
            navigate(new Object[0]);
            // browse the FIXED store: derive once, then every screen
            // carries the derived facts (Prop 3). Async - the pristine
            // store shows immediately, the fixed one swaps in.
            new Thread(() -> {
                Object fixed = ((Object[]) Arest.Ev("solve:fix", store))[0];
                store = (Object[]) fixed;
                navigate(new Object[0]);
            }).start();
            frame.addComponentListener(new java.awt.event.ComponentAdapter() {
                public void componentResized(java.awt.event.ComponentEvent e) { navigate(new Object[0]); }
            });
        });
    }
}
