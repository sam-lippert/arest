import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;

// The GUI CONTAINER — MonoCross's demonstration made structural: the same
// map (canon ui:screen), a different set of REGISTERED components. This
// host holds exactly one piece of platform state (the last event atom) and
// knows three element names; everything else — which buttons exist, what an
// event means, what text shows, how an unknown mode is refused — is decided
// by the canon. No app names, no mode names, no rendering decisions appear
// here; extending the UI is a canon edit plus, at most, one registration.
public class Gui {
    static final Map<String, Function<Object[], JComponent>> REGISTRY =
        new HashMap<String, Function<Object[], JComponent>>();

    static Object[] store;
    static volatile Object event = new Object[0]; // the one piece of platform state
    static final JPanel root = new JPanel(new BorderLayout());

    static JComponent walk(Object node) {
        Object[] n = (Object[]) node;
        Function<Object[], JComponent> f = REGISTRY.get((String) n[0]);
        if (f == null) throw new RuntimeException("unregistered component: " + n[0]);
        return f.apply(n);
    }

    static void register(String element, Function<Object[], JComponent> impl) {
        REGISTRY.put(element, impl);
    }

    static void fire(Object ev) {
        event = ev;
        new Thread(() -> {
            Object tree = Arest.Ev("ui:screen", new Object[] { store, event });
            SwingUtilities.invokeLater(() -> rebuild(tree));
        }).start();
    }

    static void rebuild(Object tree) {
        root.removeAll();
        Object[] nodes = (Object[]) tree;
        root.add(walk(nodes[0]), BorderLayout.NORTH);
        root.add(walk(nodes[1]), BorderLayout.CENTER);
        root.revalidate();
        root.repaint();
    }

    static void registerComponents() {
        register("menu", n -> {
            JPanel bar = new JPanel(new FlowLayout(FlowLayout.LEFT));
            for (Object child : (Object[]) n[1]) bar.add(walk(child));
            return bar;
        });
        register("button", n -> {
            JButton b = new JButton((String) n[1]);
            b.addActionListener(e -> fire(n[2]));
            return b;
        });
        register("text", n -> {
            JTextArea t = new JTextArea((String) n[1]);
            t.setEditable(false);
            t.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 13));
            return new JScrollPane(t);
        });
    }

    public static void main(String[] args) {
        Composed.load();
        Composed.loadCarriers();
        store = Arest.CELLS.toArray();
        registerComponents();

        SwingUtilities.invokeLater(() -> {
            rebuild(Arest.Ev("ui:screen", new Object[] { store, event }));
            JFrame frame = new JFrame("arest");
            frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
            frame.setContentPane(root);
            frame.setSize(900, 600);
            frame.setLocationByPlatform(true);
            frame.setVisible(true);
        });
    }
}
