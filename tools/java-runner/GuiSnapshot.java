import java.awt.Component;
import java.awt.Container;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.swing.AbstractButton;
import javax.swing.JComponent;
import javax.swing.JTextField;
import javax.swing.UIManager;

// THE SWING CONTAINER WITH NO WINDOW (#124, 2026-10-02): the evidence that Gui
// pairs and draws, run headless against a serving host. Every frame below is
// one navigate the container sends with its own registration and defaults, and
// every image is that frame drawn by its own widgets and layout engine into an
// offscreen image. The submit is the form's own Submit button, clicked.
//
//   java -Djava.awt.headless=true -cp . GuiSnapshot <out-dir>
//
// with AREST_PORT (or AREST_SERVE) naming the serving host.
public class GuiSnapshot {
    static Object captured;

    public static void main(String[] args) throws Exception {
        System.setProperty("java.awt.headless", "true");
        UIManager.put("swing.boldMetal", Boolean.FALSE);
        String out = args.length > 0 ? args[0] : ".";
        new java.io.File(out).mkdirs();
        System.out.println("registered " + Gui.registeredNames().size() + ": " + Gui.registeredNames());

        Gui.Platform p = new Gui.Platform(980, Gui.registeredNames());
        step(p, out, "1-root", new Object[0], null);
        step(p, out, "2-collection", new Object[] { "Function" }, "master");
        step(p, out, "3-entity", new Object[] { "Function", "render:listview" }, "master");
        step(p, out, "4-form", new Object[] { "new", "Function" }, "master");

        // the entry form's Submit, through the controls the layout engine drew
        Object address = clickSubmit(p, "detail", "Function", "f-swing");
        System.out.println("submit address " + Gui.Json.write(address));
        step(p, out, "5-submitted", address, "detail");
        step(p, out, "6-form-again", new Object[] { "new", "Function" }, "master");
        // a submit with no identifier is a write the gate refuses, its refusal the alert
        Object bare = clickSubmit(p, "detail", "Function", "");
        System.out.println("submit address " + Gui.Json.write(bare));
        step(p, out, "7-refused", bare, "detail");

        // THE PAIRING IS LAMBDA'S: the same container short of one control, and short of its engine
        refused("render:gridcell");
        refused(Gui.LAYOUT_ENGINE);
    }

    static void step(Gui.Platform p, String out, String name, Object address, String from) throws Exception {
        long t0 = System.nanoTime();
        Gui.Frame f = p.go(address, from);
        long ms = (System.nanoTime() - t0) / 1000000;
        StringBuilder s = new StringBuilder();
        s.append(name).append(": status ").append(f.status).append(", ").append(ms).append(" ms, unpaired ")
         .append(f.unpaired).append(", stacks ").append(Gui.Json.write(p.stacks));
        for (Map.Entry<String, Object[]> e : f.panes.entrySet())
            s.append("\n  pane ").append(e.getKey()).append(": ").append(e.getValue().length).append(" rows ")
             .append(kinds(e.getValue()));
        if (p.alert != null) s.append("\n  alert ").append(Gui.Json.write(p.alert));
        System.out.println(s);
        javax.imageio.ImageIO.write(Gui.paint(p, 1400), "png", new java.io.File(out, name + ".png"));
    }

    /** The control kinds of a screen's rows, the rows inside a cell or a menu included. */
    static Map<String, Integer> kinds(Object[] rows) {
        Map<String, Integer> k = new TreeMap<String, Integer>();
        for (Object r : rows) count((Object[]) r, k);
        return k;
    }

    static void count(Object[] row, Map<String, Integer> k) {
        String kind = Gui.kindOf(row);
        k.put(kind, k.containsKey(kind) ? k.get(kind) + 1 : 1);
        Map<String, Object> p = Gui.props(row);
        for (String m : new String[] { "Children", "Buttons" })
            if (p.get(m) instanceof Object[])
                for (Object c : (Object[]) p.get(m)) if (c instanceof Object[]) count((Object[]) c, k);
        for (String m : new String[] { "Menu", "SearchBox" })
            if (Gui.nonEmpty(p.get(m))) count((Object[]) p.get(m), k);
    }

    /** Type the identifier into the pane's control for it and click the view's Submit; answer the address it sends. */
    static Object clickSubmit(Gui.Platform p, String pane, String key, String value) {
        Gui.Pane drawn = new Gui.Pane(pane);
        JComponent view = Gui.screen(p.placed.get(pane), drawn);
        for (Object[] s : drawn.submits)
            if (key.equals(s[0]) && s[1] instanceof JTextField) { ((JTextField) s[1]).setText(value); break; }
        AbstractButton submit = find(view, "save");
        if (submit == null) throw new IllegalStateException("the form offers no save");
        captured = null;
        Gui.NAVIGATOR = (address, from) -> captured = address;
        submit.doClick(0);
        return captured;
    }

    static AbstractButton find(Component c, String title) {
        if (c instanceof AbstractButton && title.equals(((AbstractButton) c).getText())) return (AbstractButton) c;
        if (c instanceof Container)
            for (Component k : ((Container) c).getComponents()) {
                AbstractButton b = find(k, title);
                if (b != null) return b;
            }
        return null;
    }

    static void refused(String drop) throws Exception {
        List<String> names = new ArrayList<String>(Gui.registeredNames());
        names.remove(drop);
        Gui.Platform p = new Gui.Platform(980, names);
        Gui.Frame f = p.go(new Object[0], null);
        System.out.println("without " + drop + ": unpaired " + f.unpaired + ", panes drawn " + p.placed.size());
    }
}
