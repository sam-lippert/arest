import java.awt.Component;
import java.awt.Font;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;

// The GUI CONTAINER. The abstract UI is laid out in canon (ui:screen
// answers the whole control tree for an address; ui:controls declares the
// vocabulary); this platform registers CONCRETE OVERRIDES of the abstract
// controls ONLY — no layout, no composition, no meaning lives here. A
// container override realizes "my children in tree order"; a leaf override
// realizes its payload; a link fires its canon-emitted target address —
// hypermedia as the engine of application state (Thm 2). The host holds
// exactly one piece of platform state: the current address.
public class Gui {
    static final Map<String, Function<Object[], JComponent>> REGISTRY =
        new HashMap<String, Function<Object[], JComponent>>();

    static Object[] store;
    static volatile Object address = new Object[0]; // the one piece of platform state
    static final JPanel root = new JPanel(new java.awt.BorderLayout()); // mounts the one walked screen

    // toolkit realization of an atom payload; a sequence here is a canon
    // bug and stays a loud failure
    static String text(Object atom) {
        if (atom instanceof Object[]) throw new RuntimeException("control payload is a sequence");
        return String.valueOf(atom);
    }

    static JComponent walk(Object node) {
        Object[] n = (Object[]) node;
        Function<Object[], JComponent> f = REGISTRY.get((String) n[0]);
        if (f == null) throw new RuntimeException("unregistered control: " + n[0]);
        return f.apply(n);
    }

    static void register(String control, Function<Object[], JComponent> impl) {
        REGISTRY.put(control, impl);
    }

    static void navigate(Object addr) {
        address = addr;
        new Thread(() -> {
            Object tree = Arest.Ev("ui:screen", new Object[] { store, address });
            SwingUtilities.invokeLater(() -> rebuild(tree));
        }).start();
    }

    static void rebuild(Object tree) {
        root.removeAll();
        root.add(walk(tree));
        root.revalidate();
        root.repaint();
    }

    static JPanel vertical(Object[] n) {
        JPanel p = new JPanel();
        p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        for (int i = 1; i < n.length; i++) {
            JComponent c = walk(n[i]);
            c.setAlignmentX(Component.LEFT_ALIGNMENT);
            p.add(c);
        }
        return p;
    }

    static void registerComponents() {
        register("screen", n -> {
            JScrollPane s = new JScrollPane(vertical(n));
            s.getVerticalScrollBar().setUnitIncrement(14);
            return s;
        });
        register("list", Gui::vertical);
        register("row", n -> {
            JPanel p = new JPanel();
            p.setLayout(new BoxLayout(p, BoxLayout.X_AXIS));
            for (int i = 1; i < n.length; i++) {
                p.add(walk(n[i]));
                p.add(Box.createHorizontalStrut(8));
            }
            p.add(Box.createHorizontalGlue());
            return p;
        });
        register("title", n -> {
            JLabel l = new JLabel(text(n[1]));
            l.setFont(l.getFont().deriveFont(Font.BOLD, 17f));
            return l;
        });
        register("field", n -> {
            JLabel l = new JLabel(text(n[1]));
            l.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 13));
            return l;
        });
        register("link", n -> {
            JButton b = new JButton(text(n[1]));
            b.addActionListener(e -> navigate(n[2]));
            return b;
        });
        register("text", n -> {
            JTextArea t = new JTextArea(text(n[1]));
            t.setEditable(false);
            t.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 13));
            return t;
        });
    }

    public static void main(String[] args) {
        Composed.load();
        Composed.loadCarriers();
        store = Arest.CELLS.toArray();
        registerComponents();

        SwingUtilities.invokeLater(() -> {
            rebuild(Arest.Ev("ui:screen", new Object[] { store, address }));
            JFrame frame = new JFrame("arest");
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            frame.setContentPane(root);
            frame.setSize(980, 640);
            frame.setLocationByPlatform(true);
            frame.setVisible(true);
        });
    }
}
