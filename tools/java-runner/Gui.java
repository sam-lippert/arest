import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Container;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.ImageIcon;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JComponent;
import javax.swing.JFormattedTextField;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JScrollPane;
import javax.swing.JSlider;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import javax.swing.text.JTextComponent;

// THE SWING CONTAINER (#124, 2026-10-02): a shim that registers its paired
// controls, hands each event to lambda and draws what lambda answers, and
// nothing else (Sam, 2026-09-20). Sam, 2026-10-01: a registration surface per
// platform -- Slint in Rust, WPF in C#, React for the web -- and any host
// language registers through the same surface. This is the Java one, the
// sibling of ui.do's src/render (registry.ts, defaults.ts, controls.tsx,
// screen.tsx, navigate.ts, frame.tsx), and it holds the same four things:
//
//   - THE REGISTRATION: one widget per iFactr interface lambda places,
//     render:<kind>, and its own layout engine, render:swing
//     (metamodel/resolution.md declares each; readings/ui/components.md binds
//     each to Toolkit 'swing' at the symbol iFactr names it by; the Render
//     Target is 'swing' in readings/ui/render-target-instances.md).
//   - ITS IPlatformDefaults: the Swing look and feel's own fonts and the
//     iFactr margins, so lambda places and measures this platform's screen.
//   - THE ONE CALL: navigate, the request
//     <stacks, address, widths, registered, defaults, from, app> and the answer
//     <stacks, style, panes, unpaired, alert> (the note above DEF("navigate")),
//     handed to the transport this container registered (AREST_TRANSPORT): remote,
//     POST /navigate on a serving host, or local, lambda in this process.
//     The App is the one this container was opened at, by its id (AREST_APP):
//     lambda roots every navigation there. Who is signed in (AREST_CALLER) rides
//     beside the request as the serving host's x-arest-caller, so a transition
//     this container fires names its user as the actor, an Admin approving a
//     draft as that Admin.
//   - THE STACKS, the platform's form factor, carried from one answer to the
//     next request.
//
// THE PAIRING IS LAMBDA'S. Each request carries the names registered here and
// lambda answers ui:unpaired over them; a frame naming any is a refusal to
// draw, by name. A write is a request of the same interface (a submit or a
// fire, main:api through navigate), so this container validates nothing and
// persists nothing. The old one read lambda in-process and called ui:navpe,
// ui:iteminner and the old ui:arrange, and could neither boot nor draw after the
// iFactr interfaces replaced them; the local transport reads lambda in-process
// too, but only to make the one call the serving host makes, main:api on
// navigate, so a screen is the same bytes either way.
public class Gui {

    // ---- THE REGISTRATION -------------------------------------------------

    static final String TOOLKIT = "swing";
    static final String LAYOUT_ENGINE = "render:swing";
    static final String[] CONTROL_KINDS = {
        "listview", "sectionheader", "gridcell", "label", "richcontentcell", "textbox",
        "passwordbox", "textarea", "datepicker", "timepicker", "selectlist", "switch",
        "slider", "image", "button", "menu", "menubutton", "searchbox", "alert" };

    /** register(control, impl) IS the pairing (iFactr's IPairable): a placed row to its Swing component. */
    interface Widget { JComponent draw(Object[] row, Pane pane); }

    static final Map<String, Widget> WIDGETS = new LinkedHashMap<String, Widget>();
    static {
        WIDGETS.put("render:listview", Gui::listView);
        WIDGETS.put("render:sectionheader", Gui::sectionHeader);
        WIDGETS.put("render:gridcell", Gui::gridCell);
        WIDGETS.put("render:label", Gui::label);
        WIDGETS.put("render:richcontentcell", Gui::richContentCell);
        WIDGETS.put("render:textbox", Gui::textBox);
        WIDGETS.put("render:passwordbox", Gui::passwordBox);
        WIDGETS.put("render:textarea", Gui::textArea);
        WIDGETS.put("render:datepicker", (row, pane) -> formatted(row, pane, "Date", "yyyy-MM-dd"));
        WIDGETS.put("render:timepicker", (row, pane) -> formatted(row, pane, "Time", "HH:mm"));
        WIDGETS.put("render:selectlist", Gui::selectList);
        WIDGETS.put("render:switch", Gui::switchBox);
        WIDGETS.put("render:slider", Gui::slider);
        WIDGETS.put("render:image", Gui::image);
        WIDGETS.put("render:button", Gui::button);
        WIDGETS.put("render:menu", Gui::menu);
        WIDGETS.put("render:menubutton", Gui::menuButton);
        WIDGETS.put("render:searchbox", Gui::searchBox);
        WIDGETS.put("render:alert", Gui::alert);
        // the table cannot drift from the list: a kind with no widget refuses here, at load
        for (String kind : CONTROL_KINDS)
            if (!WIDGETS.containsKey("render:" + kind))
                throw new IllegalStateException("no widget paired to render:" + kind);
    }

    /** Every name this container registers: the widgets, then the layout engine. */
    static List<String> registeredNames() {
        List<String> names = new ArrayList<String>(WIDGETS.keySet());
        names.add(LAYOUT_ENGINE);
        return names;
    }

    // ---- ITS IPlatformDefaults --------------------------------------------

    static Object[] fontOf(Font f) {
        return new Object[] { f.getFamily(), Integer.valueOf(f.getSize()), f.isBold() ? "bold" : "normal" };
    }

    static Object[] member(String name, Object value) { return new Object[] { name, value }; }

    /**
     * IPlatformDefaults, member by member: the margins and spacings of the
     * iFactr bindings, and a font for each use from the look and feel this
     * container draws with, so a row's font is the one its widget shows.
     */
    static Object[] platformDefaults() {
        Font label = UIManager.getFont("Label.font");
        Font text = UIManager.getFont("TextField.font");
        Font button = UIManager.getFont("Button.font");
        Font combo = UIManager.getFont("ComboBox.font");
        Font area = UIManager.getFont("TextArea.font");
        Font small = label.deriveFont(Math.max(9f, label.getSize2D() - 1f));
        return new Object[] {
            member("LeftMargin", 8), member("RightMargin", 8), member("TopMargin", 8), member("BottomMargin", 8),
            member("LargeHorizontalSpacing", 10), member("SmallHorizontalSpacing", 4),
            member("LargeVerticalSpacing", 10), member("SmallVerticalSpacing", 4),
            member("CellHeight", 40),
            member("ButtonFont", fontOf(button)),
            member("DateTimePickerFont", fontOf(text)),
            member("HeaderFont", fontOf(small)),
            member("LabelFont", fontOf(label)),
            member("MessageBodyFont", fontOf(area)),
            member("MessageTitleFont", fontOf(label.deriveFont(Font.BOLD))),
            member("SectionHeaderFont", fontOf(small)),
            member("SectionFooterFont", fontOf(small)),
            member("SelectListFont", fontOf(combo)),
            member("SmallFont", fontOf(small)),
            member("TabFont", fontOf(small)),
            member("TextBoxFont", fontOf(text)),
            member("ValueFont", fontOf(label)),
        };
    }

    // ---- THE ROWS ---------------------------------------------------------

    static String kindOf(Object[] row) { return row.length > 0 && row[0] instanceof String ? (String) row[0] : ""; }

    /** A row's properties by member: sixth on a placed row, second on an unplaced one. */
    static Map<String, Object> props(Object[] row) {
        Map<String, Object> out = new LinkedHashMap<String, Object>();
        Object list = row.length >= 6 ? row[5] : (row.length >= 2 ? row[1] : null);
        if (list instanceof Object[])
            for (Object pair : (Object[]) list)
                if (pair instanceof Object[] && ((Object[]) pair).length >= 2 && ((Object[]) pair)[0] instanceof String)
                    out.put((String) ((Object[]) pair)[0], ((Object[]) pair)[1]);
        return out;
    }

    static int num(Object n) {
        if (n instanceof Number) return ((Number) n).intValue();
        try { return (int) Math.round(Double.parseDouble(String.valueOf(n))); } catch (NumberFormatException e) { return 0; }
    }

    static String text(Object v) {
        if (v instanceof String) return (String) v;
        if (v instanceof Number) return String.valueOf(v);
        return "";
    }

    static boolean nonEmpty(Object v) { return v instanceof Object[] && ((Object[]) v).length > 0; }

    static Color color(Object v) {
        String s = text(v);
        if (s.isEmpty()) return null;
        try { return Color.decode(s); } catch (NumberFormatException e) { return null; }
    }

    static Font font(Object v, Font fallback) {
        if (!(v instanceof Object[]) || ((Object[]) v).length < 2) return fallback;
        Object[] f = (Object[]) v;
        return new Font(text(f[0]), "bold".equals(f.length > 2 ? f[2] : null) ? Font.BOLD : Font.PLAIN, num(f[1]));
    }

    static void place(JComponent c, Object[] row) {
        if (row.length >= 5) c.setBounds(num(row[1]), num(row[2]), num(row[3]), num(row[4]));
    }

    /** Draw one row through the widget paired to its kind; a kind with none is a refusal, never a blank. */
    static JComponent draw(Object[] row, Pane pane) {
        Widget w = WIDGETS.get("render:" + kindOf(row));
        if (w == null)
            throw new IllegalStateException("no widget paired to render:" + kindOf(row)
                + "; lambda placed a control this container does not have");
        JComponent c = w.draw(row, pane);
        place(c, row);
        return c;
    }

    static Object[] concat(Object link, List<Object> more) {
        List<Object> all = new ArrayList<Object>();
        if (link instanceof Object[]) for (Object o : (Object[]) link) all.add(o);
        all.addAll(more);
        return all.toArray();
    }

    // ---- THE PANE: where a navigation comes from, and what a Submit sends --

    static final class Pane {
        final String name;
        Color separator;
        /** <SubmitKey, the control>, in the order the screen placed them. */
        final List<Object[]> submits = new ArrayList<Object[]>();
        Pane(String name) { this.name = name; }

        void submits(Object key, JComponent control) {
            if (key instanceof String) submits.add(new Object[] { key, control });
        }

        /**
         * IListView.GetSubmissionValues: each control carrying a SubmitKey as a
         * <key, value> pair, the value as the control holds it. A read-only
         * label and an empty value send nothing, and a switch sends true when
         * it is on.
         */
        List<Object> submissionValues() {
            List<Object> pairs = new ArrayList<Object>();
            for (Object[] s : submits) {
                Object c = s[1];
                String v;
                if (c instanceof JCheckBox) { if (!((JCheckBox) c).isSelected()) continue; v = "true"; }
                else if (c instanceof JComboBox) v = String.valueOf(((JComboBox<?>) c).getSelectedItem());
                else if (c instanceof JSlider) v = String.valueOf(((JSlider) c).getValue());
                else if (c instanceof JPasswordField) v = new String(((JPasswordField) c).getPassword());
                else if (c instanceof JTextComponent) {
                    if (!((JTextComponent) c).isEditable()) continue;
                    v = ((JTextComponent) c).getText();
                } else continue;
                if (v == null || v.isEmpty() || "null".equals(v)) continue;
                pairs.add(new Object[] { s[0], v });
            }
            return pairs;
        }
    }

    /** The event half of the shim: a container that hands its events to lambda sets this. */
    interface Navigator { void go(Object address, String from); }
    static Navigator NAVIGATOR = (address, from) -> {};

    static void follow(Object address, Pane pane) {
        if (nonEmpty(address)) NAVIGATOR.go(address, pane == null ? null : pane.name);
    }

    // ---- THE WIDGETS: one per iFactr interface ----------------------------

    /** IListView: the view's chrome (BackLink, Title, Menu, SearchBox) around its content. */
    static final class ViewPanel extends JPanel {
        final JPanel content = new JPanel(null);
        ViewPanel() { super(new BorderLayout()); }
    }

    static JComponent listView(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        ViewPanel v = new ViewPanel();
        Color bg = color(p.get("BackgroundColor"));
        if (bg != null) v.setBackground(bg);
        Color sep = color(p.get("SeparatorColor"));
        if (pane != null) pane.separator = sep;
        JPanel header = new JPanel(new BorderLayout(8, 0));
        Color hc = color(p.get("HeaderColor"));
        if (hc != null) header.setBackground(hc);
        header.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createMatteBorder(0, 0, 1, 0, sep != null ? sep : header.getBackground()),
            BorderFactory.createEmptyBorder(6, 14, 6, 14)));
        Object back = p.get("BackLink");
        if (nonEmpty(back)) {
            JButton b = linkButton("‹ back");
            b.addActionListener(e -> follow(back, pane));
            header.add(b, BorderLayout.WEST);
        }
        JLabel title = new JLabel(text(p.get("Title")));
        title.setFont(title.getFont().deriveFont(Font.BOLD));
        Color tc = color(p.get("TitleColor"));
        if (tc != null) title.setForeground(tc);
        header.add(title, BorderLayout.CENTER);
        Object menu = p.get("Menu");
        if (nonEmpty(menu)) header.add(draw((Object[]) menu, pane), BorderLayout.EAST);
        JPanel north = new JPanel();
        north.setLayout(new BoxLayout(north, BoxLayout.Y_AXIS));
        north.add(header);
        Object search = p.get("SearchBox");
        if (nonEmpty(search)) {
            JPanel s = new JPanel(new BorderLayout());
            s.setOpaque(false);
            s.setBorder(BorderFactory.createEmptyBorder(8, 14, 8, 14));
            s.add(draw((Object[]) search, pane), BorderLayout.CENTER);
            north.add(s);
        }
        north.setOpaque(false);
        v.add(north, BorderLayout.NORTH);
        v.content.setOpaque(false);
        int w = row.length >= 5 ? num(row[3]) : 0, h = row.length >= 5 ? num(row[4]) : 0;
        v.content.setPreferredSize(new Dimension(w, h));
        v.add(v.content, BorderLayout.CENTER);
        return v;
    }

    static JButton linkButton(String label) {
        JButton b = new JButton(label);
        b.setBorderPainted(false);
        b.setContentAreaFilled(false);
        b.setFocusPainted(false);
        b.setMargin(new java.awt.Insets(0, 0, 0, 0));
        b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        return b;
    }

    /** ISectionHeader. */
    static JComponent sectionHeader(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JLabel l = new JLabel(text(p.get("Text")).toUpperCase());
        l.setFont(font(p.get("Font"), l.getFont()));
        Color fg = color(p.get("ForegroundColor")), bg = color(p.get("BackgroundColor"));
        if (fg != null) l.setForeground(fg);
        if (bg != null) { l.setOpaque(true); l.setBackground(bg); }
        return l;
    }

    /** IGridCell: a rectangle holding its Children placed relative to it; with a NavigationLink, the cell is the link. */
    static JComponent gridCell(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JPanel cell = new JPanel(null);
        Color bg = color(p.get("BackgroundColor"));
        if (bg != null) cell.setBackground(bg);
        if (pane != null && pane.separator != null)
            cell.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, pane.separator));
        Object kids = p.get("Children");
        if (kids instanceof Object[])
            for (Object k : (Object[]) kids)
                if (k instanceof Object[]) cell.add(draw((Object[]) k, pane), 0);
        Object link = p.get("NavigationLink");
        if (nonEmpty(link)) {
            Color sel = color(p.get("SelectionColor"));
            cell.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            cell.addMouseListener(new MouseAdapter() {
                public void mouseClicked(MouseEvent e) { follow(link, pane); }
                public void mouseEntered(MouseEvent e) { if (sel != null) cell.setBackground(sel); }
                public void mouseExited(MouseEvent e) { if (bg != null) cell.setBackground(bg); }
            });
        }
        return cell;
    }

    /** ILabel; one carrying a SubmitKey is a value a person does not type, shown read-only and not sent. */
    static JComponent label(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        Color fg = color(p.get("ForegroundColor"));
        if (p.get("SubmitKey") instanceof String) {
            JTextField t = new JTextField(text(p.get("Text")));
            t.setEditable(false);
            t.setFont(font(p.get("Font"), t.getFont()));
            if (fg != null) t.setForeground(fg);
            return t;
        }
        JLabel l = new JLabel(text(p.get("Text")));
        l.setFont(font(p.get("Font"), l.getFont()));
        if (fg != null) l.setForeground(fg);
        return l;
    }

    /** IRichContentCell: a block of text, wrapped and scrollable. */
    static JComponent richContentCell(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JTextArea t = new JTextArea(text(p.get("Text")));
        t.setEditable(false);
        t.setLineWrap(true);
        t.setWrapStyleWord(true);
        t.setFont(font(p.get("Font"), t.getFont()));
        Color fg = color(p.get("ForegroundColor")), bg = color(p.get("BackgroundColor"));
        if (fg != null) t.setForeground(fg);
        if (bg != null) t.setBackground(bg);
        JScrollPane s = new JScrollPane(t);
        s.setBorder(null);
        return s;
    }

    /** ITextBox; a KeyboardType of Symbolic or PIN is a number's, right-aligned as Swing aligns one. */
    static JComponent textBox(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JTextField t = new JTextField(text(p.get("Text")));
        t.setFont(font(p.get("Font"), t.getFont()));
        Object k = p.get("KeyboardType");
        if ("Symbolic".equals(k) || "PIN".equals(k)) t.setHorizontalAlignment(JTextField.RIGHT);
        if (pane != null) pane.submits(p.get("SubmitKey"), t);
        return t;
    }

    /** IPasswordBox: masked entry of its Password. */
    static JComponent passwordBox(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JPasswordField t = new JPasswordField(text(p.get("Password")));
        t.setFont(font(p.get("Font"), t.getFont()));
        if (pane != null) pane.submits(p.get("SubmitKey"), t);
        return t;
    }

    /** ITextArea: multi-line entry of its Text. */
    static JComponent textArea(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JTextArea t = new JTextArea(text(p.get("Text")));
        t.setLineWrap(true);
        t.setWrapStyleWord(true);
        t.setFont(font(p.get("Font"), t.getFont()));
        if (pane != null) pane.submits(p.get("SubmitKey"), t);
        return new JScrollPane(t);
    }

    /** IDatePicker and ITimePicker: Swing's formatted entry of a Date or a Time, empty until one is entered. */
    static JComponent formatted(Object[] row, Pane pane, String member, String pattern) {
        Map<String, Object> p = props(row);
        JFormattedTextField t = new JFormattedTextField(new java.text.SimpleDateFormat(pattern));
        t.setText(text(p.get(member)));
        t.setFont(font(p.get("Font"), t.getFont()));
        t.setToolTipText(pattern);
        if (pane != null) pane.submits(p.get("SubmitKey"), t);
        return t;
    }

    /** ISelectList: its SelectedItem among its Items, nothing chosen first. */
    static JComponent selectList(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JComboBox<String> c = new JComboBox<String>();
        c.addItem("");
        Object items = p.get("Items");
        if (items instanceof Object[]) for (Object i : (Object[]) items) c.addItem(text(i));
        c.setSelectedItem(text(p.get("SelectedItem")));
        c.setFont(font(p.get("Font"), c.getFont()));
        if (pane != null) pane.submits(p.get("SubmitKey"), c);
        return c;
    }

    /** ISwitch: on when its Value is true. */
    static JComponent switchBox(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JCheckBox c = new JCheckBox();
        c.setOpaque(false);
        c.setSelected("true".equals(text(p.get("Value"))) || Boolean.TRUE.equals(p.get("Value")));
        if (pane != null) pane.submits(p.get("SubmitKey"), c);
        return c;
    }

    /** ISlider: its Value between MinValue and MaxValue. */
    static JComponent slider(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        int min = num(p.get("MinValue")), max = num(p.get("MaxValue"));
        if (max < min) max = min;
        int value = Math.max(min, Math.min(max, num(p.get("Value"))));
        JSlider s = new JSlider(min, max, value);
        s.setOpaque(false);
        if (pane != null) pane.submits(p.get("SubmitKey"), s);
        return s;
    }

    /** IImage: the image at its FilePath, scaled into its rectangle. */
    static JComponent image(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JLabel l = new JLabel();
        String path = text(p.get("FilePath"));
        if (!path.isEmpty() && new java.io.File(path).isFile() && row.length >= 5) {
            Image img = new ImageIcon(path).getImage();
            l.setIcon(new ImageIcon(img.getScaledInstance(num(row[3]), num(row[4]), Image.SCALE_SMOOTH)));
        }
        return l;
    }

    /** IButton: its Title, following its NavigationLink. */
    static JComponent button(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JButton b = new JButton(text(p.get("Title")));
        b.setFont(font(p.get("Font"), b.getFont()));
        Color fg = color(p.get("ForegroundColor"));
        if (fg != null) b.setForeground(fg);
        Object link = p.get("NavigationLink");
        b.addActionListener(e -> follow(link, pane));
        return b;
    }

    /** IMenu: the view's Buttons, drawn in its chrome. */
    static JComponent menu(Object[] row, Pane pane) {
        JPanel m = new JPanel(new FlowLayout(FlowLayout.RIGHT, 6, 0));
        m.setOpaque(false);
        Object buttons = props(row).get("Buttons");
        if (buttons instanceof Object[])
            for (Object b : (Object[]) buttons)
                if (b instanceof Object[]) m.add(draw((Object[]) b, pane));
        return m;
    }

    /** IMenuButton: one action; a Submit sends the view's values with its link, as IListView.Submit does. */
    static JComponent menuButton(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JButton b = new JButton(text(p.get("Title")));
        b.setMargin(new java.awt.Insets(2, 8, 2, 8));
        Object link = p.get("NavigationLink");
        boolean submit = "Submit".equals(p.get("Action"));
        b.addActionListener(e -> {
            if (submit && pane != null && nonEmpty(link)) follow(concat(link, pane.submissionValues()), pane);
            else follow(link, pane);
        });
        return b;
    }

    /** ISearchBox: its Placeholder and Text; a search follows its NavigationLink with the text appended. */
    static JComponent searchBox(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        final String placeholder = text(p.get("Placeholder"));
        JTextField t = new JTextField(text(p.get("Text"))) {
            protected void paintComponent(Graphics g) {
                super.paintComponent(g);
                if (getText().isEmpty() && !placeholder.isEmpty()) {
                    g.setColor(Color.GRAY);
                    g.drawString(placeholder, getInsets().left + 2, getHeight() / 2 + g.getFontMetrics().getAscent() / 2 - 2);
                }
            }
        };
        Object link = p.get("NavigationLink");
        t.addActionListener(e -> {
            List<Object> words = new ArrayList<Object>();
            words.add(t.getText());
            follow(concat(link, words), pane);
        });
        return t;
    }

    /** IAlert: a Title and a Message over the screen. */
    static JComponent alert(Object[] row, Pane pane) {
        Map<String, Object> p = props(row);
        JPanel a = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        a.setBackground(new Color(0xFF, 0xF4, 0xE5));
        JLabel title = new JLabel(text(p.get("Title")));
        title.setFont(title.getFont().deriveFont(Font.BOLD));
        a.add(title);
        a.add(new JLabel(text(p.get("Message"))));
        return a;
    }

    // ---- THE LAYOUT ENGINE: render:swing ----------------------------------

    /**
     * A screen's placed rows to its Swing view. Lambda decided every position
     * (ui:arrange) and every color and font (each row's members), so this takes
     * the first row, the view, as the container and adds every other row's
     * paired widget inside its content at the rectangle lambda gave it, a later
     * row above an earlier one.
     */
    static JComponent screen(Object[] placed, Pane pane) {
        Object[] view = new Object[] { "listview", 0, 0, 0, 0, new Object[0] };
        for (Object r : placed) if (r instanceof Object[] && "listview".equals(kindOf((Object[]) r))) { view = (Object[]) r; break; }
        ViewPanel v = (ViewPanel) WIDGETS.get("render:listview").draw(view, pane);
        for (Object r : placed) {
            if (r == view || !(r instanceof Object[])) continue;
            v.content.add(draw((Object[]) r, pane), 0);
        }
        return v;
    }

    // ---- THE ONE CALL ------------------------------------------------------

    static String serveBase() {
        String url = System.getenv("AREST_SERVE");
        if (url != null && !url.isEmpty()) return url;
        String port = System.getenv("AREST_PORT");
        return "http://127.0.0.1:" + (port == null || port.isEmpty() ? "8787" : port);
    }

    /** What lambda answers for one navigation, read positionally as ui:frame_out built it. */
    static final class Frame {
        Object stacks;
        Object[] style = new Object[0];
        final LinkedHashMap<String, Object[]> panes = new LinkedHashMap<String, Object[]>();
        final List<String> unpaired = new ArrayList<String>();
        Object[] alert;
        int status;
    }

    static Frame frameFrom(Object answer, int status) {
        Object[] a = answer instanceof Object[] ? (Object[]) answer : new Object[0];
        Frame f = new Frame();
        f.status = status;
        f.stacks = a.length > 0 ? a[0] : new Object[0];
        if (a.length > 1 && a[1] instanceof Object[]) f.style = (Object[]) a[1];
        if (a.length > 2 && a[2] instanceof Object[])
            for (Object e : (Object[]) a[2])
                if (e instanceof Object[] && ((Object[]) e).length >= 2)
                    f.panes.put(text(((Object[]) e)[0]),
                        ((Object[]) e)[1] instanceof Object[] ? (Object[]) ((Object[]) e)[1] : new Object[0]);
        if (a.length > 3 && a[3] instanceof Object[]) for (Object u : (Object[]) a[3]) f.unpaired.add(text(u));
        f.alert = a.length > 4 && nonEmpty(a[4]) ? (Object[]) a[4] : null;
        return f;
    }

    /**
     * Hand one navigation to lambda. A write answers its status, and a refused
     * one answers its frame with the refusal as its alert; any other non-2xx
     * answer, or a transport failure, is an error and never an empty frame.
     */
    static Frame navigate(Object stacks, Object address, Object[] widths, List<String> registered, String from)
            throws java.io.IOException {
        return navigate(transportOf(), stacks, address, widths, registered, from, null, null);
    }

    static Frame navigate(Transport transport, Object stacks, Object address, Object[] widths, List<String> registered,
                          String from, String app, String caller) throws java.io.IOException {
        return frameOf(transport.navigate(requestBody(stacks, address, widths, registered, from, app), caller));
    }

    /** The request body, in the order lambda reads it (ui:req_at). */
    static String requestBody(Object stacks, Object address, Object[] widths, List<String> registered, String from, String app) {
        Object[] body = new Object[] { stacks, address, widths, registered.toArray(), platformDefaults(),
                                       from == null ? new Object[0] : from,
                                       app == null || app.isEmpty() ? new Object[0] : app };
        return Json.write(body);
    }

    /** A navigation's answer read as a frame, or the error it is. */
    static Frame frameOf(Answer a) throws java.io.IOException {
        Object answer;
        try { answer = Json.parse(a.text); } catch (RuntimeException e) { answer = null; }
        if ((a.status < 200 || a.status >= 300) && !(answer instanceof Object[] && ((Object[]) answer).length == 5))
            throw new java.io.IOException("navigate answered " + a.status + ": " + a.text.substring(0, Math.min(200, a.text.length())));
        return frameFrom(answer, a.status);
    }

    // ---- THE TRANSPORTS ----------------------------------------------------
    //
    // A navigation is one request and one answer whichever way it goes (Sam,
    // 2026-10-02: platforms support both local and remote rendering, and an
    // admin can boot this container and approve drafts with it).
    //   - remote: POST /navigate on a serving host (AREST_SERVE, or AREST_PORT on
    //     this machine), the caller as its x-arest-caller (run_serve).
    //   - local: this runner's own host. Reader reads lambda, the case table and a
    //     carriers directory (AREST_LAMBDA, AREST_SCENARIOS, AREST_CARRIERS, as
    //     Program does); the store boots as the js host boots one from carriers
    //     (ast:File over store:state, then store:close); and main:api answers
    //     POST navigate with the caller, the store a write leaves adopted, as
    //     run_serve adopts it. Nothing is written anywhere, which a serving host
    //     booted from carriers does not do either.
    // WHICH ONE A PLATFORM USES IS A REGISTRATION: each is registered under its
    // name, and the platform asks for the one AREST_TRANSPORT names, remote when
    // it names none. A registration is a factory, so a transport nobody asks for
    // costs nothing; local reads lambda and boots its store when first asked.

    /** What one navigation answers: the status main:api decided and the text render:json made. */
    static final class Answer {
        final int status;
        final String text;
        Answer(int status, String text) { this.status = status; this.text = text; }
    }

    /** One way to hand a navigation to lambda: the request body as JSON text, and who is signed in. */
    interface Transport { Answer navigate(String body, String caller) throws java.io.IOException; }

    /** remote: POST /navigate on the serving host at base. */
    static final class RemoteTransport implements Transport {
        final String base;
        RemoteTransport(String base) { this.base = base; }
        public Answer navigate(String body, String caller) throws java.io.IOException {
            java.net.HttpURLConnection c =
                (java.net.HttpURLConnection) new java.net.URL(base + "/navigate").openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(3000);
            c.setReadTimeout(120000);
            c.setDoOutput(true);
            c.setRequestProperty("content-type", "application/json");
            if (caller != null && !caller.isEmpty()) c.setRequestProperty("x-arest-caller", caller);
            c.getOutputStream().write(body.getBytes("UTF-8"));
            int status = c.getResponseCode();
            return new Answer(status, read(status < 400 ? c.getInputStream() : c.getErrorStream()));
        }
    }

    /** local: lambda in this process, over the store booted from a carriers directory. */
    static final class LocalTransport implements Transport {
        private Object[] store;

        LocalTransport(String lambda, String scenarios, String carriers) {
            Reader.load(lambda);
            Reader.load(scenarios);
            Reader.loadCarriers(carriers);
            Object built = Arest.Ev("ast:File", Arest.Ev("store:state", Arest.CELLS.toArray()));
            for (Object cell : (Object[]) built) Arest.CELLS.add(0, cell);
            Arest.memoClear();
            Object closed = Arest.Ev("store:close", new Object[] { Arest.CELLS.toArray(), new Object[0], new Object[0], new Object[0] });
            adopt(((Object[]) closed)[0]);
        }

        private void adopt(Object next) {
            Arest.CELLS.clear();
            for (Object cell : (Object[]) next) Arest.CELLS.add(cell);
            Arest.memoClear();
            store = Arest.CELLS.toArray();
        }

        public synchronized Answer navigate(String body, String caller) {
            Object[] out = (Object[]) Arest.Ev("main:api",
                new Object[] { store, "POST", "navigate", caller == null ? "" : caller, fromJson(Json.parse(body)) });
            if (out.length > 2) adopt(out[2]);
            return new Answer(((Number) out[1]).intValue(), String.valueOf(out[0]));
        }
    }

    /** JSON as the serving host reads it (host.js fromJson): an object is its pairs, a number a number, the rest atoms. */
    static Object fromJson(Object x) {
        if (x instanceof Object[]) {
            Object[] a = (Object[]) x, out = new Object[a.length];
            for (int i = 0; i < a.length; i++) out[i] = fromJson(a[i]);
            return out;
        }
        if (x instanceof Map) {
            List<Object> out = new ArrayList<Object>();
            for (Map.Entry<?, ?> e : ((Map<?, ?>) x).entrySet()) out.add(new Object[] { String.valueOf(e.getKey()), fromJson(e.getValue()) });
            return out.toArray();
        }
        if (x instanceof Number) return x;
        return String.valueOf(x);
    }

    interface TransportFactory { Transport make(); }

    static final LinkedHashMap<String, TransportFactory> TRANSPORTS = new LinkedHashMap<String, TransportFactory>();
    static final Map<String, Transport> MADE = new java.util.HashMap<String, Transport>();

    static {
        registerTransport("remote", () -> new RemoteTransport(serveBase()));
        registerTransport("local", () -> new LocalTransport(Reader.path("AREST_LAMBDA", "../../arest"),
            Reader.path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon"),
            Reader.path("AREST_CARRIERS", "../carriers/base")));
    }

    /** Register a transport under its name; the last registration of a name is the one asked for. */
    static void registerTransport(String name, TransportFactory factory) {
        TRANSPORTS.put(name, factory);
        MADE.remove(name);
    }

    /** The transport registered under a name, made once; a name nothing registered is an error, never a default. */
    static synchronized Transport transportNamed(String name) {
        Transport made = MADE.get(name);
        if (made != null) return made;
        TransportFactory f = TRANSPORTS.get(name);
        if (f == null) throw new IllegalArgumentException("no transport is registered as '" + name + "' (registered: " + TRANSPORTS.keySet() + ")");
        made = f.make();
        MADE.put(name, made);
        return made;
    }

    /** The transport this container's deployment names (AREST_TRANSPORT), remote when it names none. */
    static Transport transportOf() { return transportNamed(Reader.path("AREST_TRANSPORT", "remote")); }

    static String read(java.io.InputStream in) throws java.io.IOException {
        if (in == null) return "";
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        for (int n = in.read(buf); n > 0; n = in.read(buf)) b.write(buf, 0, n);
        in.close();
        return new String(b.toByteArray(), "UTF-8");
    }

    // ---- THE PLATFORM: its stacks, its pane widths, the last frame ---------

    /** The master pane's width in a split view; the detail takes the rest. */
    static final int MASTER_WIDTH = 320;
    /** Below this window width the platform registers one pane, as a phone does. */
    static final int SPLIT_MIN_WIDTH = 900;

    static String[] panesFor(int width) {
        return width >= SPLIT_MIN_WIDTH ? new String[] { "master", "detail" } : new String[] { "master" };
    }

    static Object stacksFor(String[] panes) {
        Object[] s = new Object[panes.length];
        for (int i = 0; i < panes.length; i++) s[i] = new Object[] { panes[i], new Object[0] };
        return s;
    }

    static int paneWidth(String[] panes, int width, int i) {
        if (panes.length <= 1) return width;
        int rest = Math.max(width - MASTER_WIDTH * (panes.length - 1), MASTER_WIDTH);
        return i < panes.length - 1 ? MASTER_WIDTH : rest;
    }

    static Object[] widths(String[] panes, int width) {
        Object[] w = new Object[panes.length];
        for (int i = 0; i < panes.length; i++) w[i] = new Object[] { panes[i], paneWidth(panes, width, i) };
        return w;
    }

    /** The App this container was opened at (AREST_APP), by its id, or none. */
    static String appOf() { String a = System.getenv("AREST_APP"); return a == null || a.isEmpty() ? null : a; }

    /** Who is signed in (AREST_CALLER), sent as the serving host's caller, or nobody. */
    static String callerOf() { String c = System.getenv("AREST_CALLER"); return c == null || c.isEmpty() ? null : c; }

    /** One platform: what it registered and the last frame lambda answered, panes it left out kept. */
    static final class Platform {
        final String[] panes;
        final int width;
        final List<String> registered;
        String app = appOf();
        String caller = callerOf();
        Transport transport;
        Object stacks;
        final LinkedHashMap<String, Object[]> placed = new LinkedHashMap<String, Object[]>();
        Object[] alert;
        List<String> unpaired = new ArrayList<String>();
        int status;

        Platform(int width, List<String> registered) {
            this.width = width;
            this.panes = panesFor(width);
            this.registered = registered;
            this.stacks = stacksFor(panes);
        }

        Frame go(Object address, String from) throws java.io.IOException {
            if (transport == null) transport = transportOf();
            Frame f = navigate(transport, stacks, address, widths(panes, width), registered, from, app, caller);
            unpaired = f.unpaired;
            status = f.status;
            if (!f.unpaired.isEmpty()) return f;     // a refusal to draw: nothing moves
            stacks = f.stacks;
            placed.putAll(f.panes);                  // a pane the answer leaves out keeps what it showed
            alert = f.alert;
            return f;
        }
    }

    // ---- THE WINDOW --------------------------------------------------------

    public static void main(String[] args) {
        try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); } catch (Exception e) { /* the cross-platform one */ }
        final Platform platform = new Platform(1100, registeredNames());
        final JFrame frame = new JFrame("AREST");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        final JPanel alertHolder = new JPanel(new BorderLayout());
        final JPanel panes = new JPanel();
        panes.setLayout(new BoxLayout(panes, BoxLayout.X_AXIS));
        frame.getContentPane().add(alertHolder, BorderLayout.NORTH);
        frame.getContentPane().add(panes, BorderLayout.CENTER);
        frame.setSize(platform.width, 760);
        NAVIGATOR = (address, from) -> new Thread(() -> {
            try {
                platform.go(address, from);
                SwingUtilities.invokeLater(() -> redraw(platform, alertHolder, panes, frame));
            } catch (Exception e) {
                SwingUtilities.invokeLater(() -> {
                    alertHolder.removeAll();
                    alertHolder.add(alert(new Object[] { "alert", new Object[] {
                        new Object[] { "Title", "error" }, new Object[] { "Message", String.valueOf(e.getMessage()) } } }, null));
                    frame.revalidate();
                });
            }
        }).start();
        frame.setVisible(true);
        NAVIGATOR.go(new Object[0], null);           // MonoCross's NavigateOnLoad: the root
    }

    static void redraw(Platform platform, JPanel alertHolder, JPanel panes, JFrame frame) {
        alertHolder.removeAll();
        panes.removeAll();
        if (!platform.unpaired.isEmpty()) {
            // THE GATE IS LAMBDA'S: a frame naming an unpaired kind is a refusal to draw, by name
            JLabel refusal = new JLabel("refusing to draw: lambda declares control kinds this container does not pair: "
                + String.join(", ", platform.unpaired));
            refusal.setForeground(new Color(0xB0, 0x00, 0x20));
            alertHolder.add(refusal);
            System.err.println(refusal.getText());
        } else {
            if (platform.alert != null) alertHolder.add(draw(platform.alert, null));
            int i = 0;
            for (Map.Entry<String, Object[]> e : platform.placed.entrySet()) {
                JScrollPane s = new JScrollPane(screen(e.getValue(), new Pane(e.getKey())));
                s.getVerticalScrollBar().setUnitIncrement(16);
                int w = paneWidth(platform.panes, platform.width, i++);
                s.setPreferredSize(new Dimension(w, 0));
                s.setMaximumSize(new Dimension(w, Integer.MAX_VALUE));
                panes.add(s);
            }
        }
        frame.revalidate();
        frame.repaint();
    }

    // ---- OFFSCREEN: a frame painted without a window -----------------------

    /** Lay a component tree out at its size, with no window: what the toolkit would do on show. */
    static void layout(Component c) {
        synchronized (c.getTreeLock()) { c.doLayout(); }
        if (c instanceof Container) for (Component k : ((Container) c).getComponents()) layout(k);
    }

    /** The platform's frame as an image: the alert, then each pane at its width, up to maxHeight. */
    static java.awt.image.BufferedImage paint(Platform platform, int maxHeight) {
        List<JComponent> views = new ArrayList<JComponent>();
        int height = 0;
        for (Map.Entry<String, Object[]> e : platform.placed.entrySet()) {
            JComponent v = screen(e.getValue(), new Pane(e.getKey()));
            views.add(v);
            height = Math.max(height, v.getPreferredSize().height);
        }
        JComponent alertView = platform.alert != null ? draw(platform.alert, null) : null;
        int alertH = alertView != null ? alertView.getPreferredSize().height : 0;
        height = Math.min(maxHeight, Math.max(1, height));
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(
            platform.width, alertH + height, java.awt.image.BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, img.getWidth(), img.getHeight());
        if (alertView != null) {
            alertView.setSize(platform.width, alertH);
            layout(alertView);
            alertView.printAll(g);
        }
        int x = 0;
        for (int i = 0; i < views.size(); i++) {
            JComponent v = views.get(i);
            int w = paneWidth(platform.panes, platform.width, i);
            v.setSize(w, height);
            layout(v);
            Graphics2D pg = (Graphics2D) g.create(x, alertH, w, height);
            v.printAll(pg);
            pg.dispose();
            g.setColor(new Color(0xDD, 0xDD, 0xDD));
            g.drawLine(x + w - 1, alertH, x + w - 1, alertH + height);
            x += w;
        }
        g.dispose();
        return img;
    }

    // ---- JSON, the request's and the answer's encoding ---------------------

    static final class Json {
        private final String s;
        private int i;
        private Json(String s) { this.s = s; }

        static Object parse(String text) {
            Json j = new Json(text);
            j.ws();
            Object v = j.value();
            j.ws();
            if (j.i != j.s.length()) throw new IllegalArgumentException("json: trailing text at " + j.i);
            return v;
        }

        private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }

        private Object value() {
            if (i >= s.length()) throw new IllegalArgumentException("json: unexpected end");
            char c = s.charAt(i);
            if (c == '[') {
                i++;
                List<Object> out = new ArrayList<Object>();
                ws();
                if (s.charAt(i) == ']') { i++; return out.toArray(); }
                while (true) {
                    ws(); out.add(value()); ws();
                    char d = s.charAt(i++);
                    if (d == ']') return out.toArray();
                    if (d != ',') throw new IllegalArgumentException("json: expected , or ] at " + (i - 1));
                }
            }
            if (c == '{') {
                i++;
                Map<String, Object> out = new LinkedHashMap<String, Object>();
                ws();
                if (s.charAt(i) == '}') { i++; return out; }
                while (true) {
                    ws(); String k = string(); ws();
                    if (s.charAt(i++) != ':') throw new IllegalArgumentException("json: expected : at " + (i - 1));
                    ws(); out.put(k, value()); ws();
                    char d = s.charAt(i++);
                    if (d == '}') return out;
                    if (d != ',') throw new IllegalArgumentException("json: expected , or } at " + (i - 1));
                }
            }
            if (c == '"') return string();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return null; }
            int start = i;
            while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            String n = s.substring(start, i);
            if (n.isEmpty()) throw new IllegalArgumentException("json: unexpected " + c + " at " + start);
            if (n.indexOf('.') < 0 && n.indexOf('e') < 0 && n.indexOf('E') < 0) {
                long l = Long.parseLong(n);
                if (l >= Integer.MIN_VALUE && l <= Integer.MAX_VALUE) return Integer.valueOf((int) l);
                return Long.valueOf(l);
            }
            return Double.valueOf(n);
        }

        private String string() {
            if (s.charAt(i) != '"') throw new IllegalArgumentException("json: expected a string at " + i);
            i++;
            StringBuilder b = new StringBuilder();
            while (true) {
                char c = s.charAt(i++);
                if (c == '"') return b.toString();
                if (c != '\\') { b.append(c); continue; }
                char e = s.charAt(i++);
                switch (e) {
                    case '"': b.append('"'); break;
                    case '\\': b.append('\\'); break;
                    case '/': b.append('/'); break;
                    case 'b': b.append('\b'); break;
                    case 'f': b.append('\f'); break;
                    case 'n': b.append('\n'); break;
                    case 'r': b.append('\r'); break;
                    case 't': b.append('\t'); break;
                    case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break;
                    default: throw new IllegalArgumentException("json: bad escape at " + (i - 1));
                }
            }
        }

        static String write(Object v) {
            StringBuilder b = new StringBuilder();
            write(v, b);
            return b.toString();
        }

        private static void write(Object v, StringBuilder b) {
            if (v == null) { b.append("null"); return; }
            if (v instanceof Object[]) {
                b.append('[');
                Object[] a = (Object[]) v;
                for (int k = 0; k < a.length; k++) { if (k > 0) b.append(','); write(a[k], b); }
                b.append(']');
                return;
            }
            if (v instanceof List) { write(((List<?>) v).toArray(), b); return; }
            if (v instanceof Boolean || v instanceof Integer || v instanceof Long) { b.append(v); return; }
            if (v instanceof Number) {
                double d = ((Number) v).doubleValue();
                if (d == Math.rint(d) && Math.abs(d) < 1e15) b.append((long) d); else b.append(d);
                return;
            }
            String t = String.valueOf(v);
            b.append('"');
            for (int k = 0; k < t.length(); k++) {
                char c = t.charAt(k);
                if (c == '"') b.append("\\\"");
                else if (c == '\\') b.append("\\\\");
                else if (c == '\n') b.append("\\n");
                else if (c == '\r') b.append("\\r");
                else if (c == '\t') b.append("\\t");
                else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
                else b.append(c);
            }
            b.append('"');
        }
    }
}
