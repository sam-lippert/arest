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
    static final Map<String, Function<Object[], JComponent>> REGISTRY =
        new HashMap<String, Function<Object[], JComponent>>();

    static Object[] store;
    static volatile Object address = new Object[0]; // the one piece of platform state
    static final JPanel canvas = new JPanel(null);   // absolute: canon owns geometry
    static final JScrollPane scroller = new JScrollPane(canvas);
    static final Map<String, String> STYLE = new HashMap<String, String>();

    static String sv(String prop) { return STYLE.get(prop); }
    static Color color(String prop) { return Color.decode(sv(prop)); }
    static int num(String prop) { return Integer.parseInt(sv(prop)); }
    static Font font(String sizeProp, int style) {
        return new Font("Segoe UI", style, num(sizeProp));
    }

    static String text(Object atom) {
        if (atom instanceof Object[]) throw new RuntimeException("control payload is a sequence");
        return String.valueOf(atom);
    }

    static void register(String control, Function<Object[], JComponent> impl) {
        REGISTRY.put(control, impl);
    }

    static void navigate(Object addr) {
        address = addr;
        new Thread(() -> {
            Object tree = Arest.Ev("ui:screen", new Object[] { store, address });
            Object placed = Arest.Ev("ui:arrange", new Object[] { tree, canvasWidth() });
            SwingUtilities.invokeLater(() -> rebuild((Object[]) placed));
        }).start();
    }

    static Integer canvasWidth() {
        int w = scroller.getViewport().getWidth();
        return Integer.valueOf(w > 0 ? w : 960);
    }

    static void rebuild(Object[] placed) {
        canvas.removeAll();
        // later placed rows paint ABOVE earlier ones (canon's z contract);
        // Swing paints lower child indices on top, so add in reverse
        for (int i = placed.length - 1; i >= 0; i--) {
            Object row = placed[i];
            Object[] r = (Object[]) row;
            Function<Object[], JComponent> f = REGISTRY.get((String) r[0]);
            if (f == null) throw new RuntimeException("unregistered control: " + r[0]);
            JComponent c = f.apply(r);
            if (c != null) {
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
            JButton b = new JButton("‹ back");
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
            JLabel l = new JLabel(text(r[5]).toUpperCase(java.util.Locale.ROOT));
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
            JLabel t = new JLabel(text(r[5]));
            t.setFont(font("textSize", Font.PLAIN));
            t.setForeground(linked ? color("linkColor") : color("textColor"));
            t.setBounds(12, sub ? 6 : 0, w - 40, sub ? 22 : h);
            p.add(t);
            if (sub) {
                JLabel s = new JLabel(text(r[6]));
                s.setFont(font("subtextSize", Font.PLAIN));
                s.setForeground(color("subtextColor"));
                s.setBounds(12, 30, w - 40, 18);
                p.add(s);
            }
            if (linked) {
                JLabel ch = new JLabel("›");
                ch.setFont(font("titleSize", Font.PLAIN));
                ch.setForeground(color("chevronColor"));
                ch.setBounds(w - 26, 0, 18, h);
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
            t.setBorder(BorderFactory.createEmptyBorder(8, 10, 8, 10));
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

        SwingUtilities.invokeLater(() -> {
            JFrame frame = new JFrame("arest");
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            scroller.setBorder(null);
            scroller.getVerticalScrollBar().setUnitIncrement(16);
            frame.setContentPane(scroller);
            frame.setSize(980, 680);
            frame.setLocationByPlatform(true);
            frame.setVisible(true);
            navigate(address);
            frame.addComponentListener(new java.awt.event.ComponentAdapter() {
                public void componentResized(java.awt.event.ComponentEvent e) { navigate(address); }
            });
        });
    }
}
