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
            Arest.Ev("store:append", new Object[] { "journal", od[2] });
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
        Composed.load();
        Composed.loadCarriers();
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
        Arest.register("store:append", x -> {
            Object[] p = (Object[]) x;
            try {
                java.nio.file.Files.write(
                    java.nio.file.Paths.get("..", "..", "apps", "sherlock", (String) p[0]),
                    ((String) p[1]).getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.APPEND);
            } catch (java.io.IOException e) { throw new RuntimeException(e); }
            return "T";
        });

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
                Object fixed = Arest.Ev("ui:boot", store);
                store = (Object[]) fixed;
                navigate(new Object[0]);
            }).start();
            frame.addComponentListener(new java.awt.event.ComponentAdapter() {
                public void componentResized(java.awt.event.ComponentEvent e) { navigate(new Object[0]); }
            });
        });
    }
}
