import java.util.List;

// THE TWO TRANSPORTS ANSWER ALIKE (Gui.java, THE TRANSPORTS): a screen is the same bytes whether lambda
// ran in this process or behind a serving host. This walks one fixed sequence of navigations through the
// local and the remote transport in step -- each request built once, by Gui.requestBody, and handed to
// both -- and prints, per screen, each side's status, its length and its time, and whether the texts are
// the same bytes. The exit status is 0 only when every screen is.
//
//   java TransportCheck [app] [caller]
//
// The serving host (AREST_SERVE, or AREST_PORT on this machine) must be booted over the carriers the local
// transport reads (AREST_CARRIERS, tools/carriers/base unless set) with no AREST_STORE_DB, since the
// sequence writes: its save answers 201 on both sides, and both must start from the same store. The
// screens are the base store's, as ui.do's src/render/parity.ts walks them: the root, a list, an entity,
// an entry form and its save, and an empty save, which the gate refuses with its alert.
public class TransportCheck {
    static final Object[][] SCREENS = {
        { "root", new Object[0], null },
        { "list", new Object[] { "Function" }, "master" },
        { "entity", new Object[] { "Function", "render:listview" }, "master" },
        { "entry form", new Object[] { "new", "Function" }, "master" },
        { "save (201)", new Object[] { "submit", "Function", new Object[] { "Function", "f-parity" } }, "detail" },
        { "empty save (400)", new Object[] { "submit", "Function" }, "detail" },
    };

    public static void main(String[] args) throws Exception {
        String app = args.length > 0 && !args[0].isEmpty() ? args[0] : null;
        String caller = args.length > 1 && !args[1].isEmpty() ? args[1] : null;
        long t0 = System.nanoTime();
        Gui.Transport local = Gui.transportNamed("local");
        System.out.println(String.format("local: booted in %.1f s", (System.nanoTime() - t0) / 1e9));
        Gui.Transport remote = Gui.transportNamed("remote");
        String[] panes = { "master", "detail" };
        Object stacks = Gui.stacksFor(panes);
        Object[] widths = Gui.widths(panes, 980);
        List<String> registered = Gui.registeredNames();
        boolean all = true;
        for (Object[] screen : SCREENS) {
            String body = Gui.requestBody(stacks, screen[1], widths, registered, (String) screen[2], app);
            long a = System.nanoTime();
            Gui.Answer left = local.navigate(body, caller);
            long b = System.nanoTime();
            Gui.Answer right = remote.navigate(body, caller);
            long c = System.nanoTime();
            boolean same = left.status == right.status && left.text.equals(right.text);
            all &= same;
            System.out.println(String.format("%s  %s: status %d / %d, %d / %d B, local %d ms, remote %d ms",
                same ? "same" : "DIFFERENT", screen[0], left.status, right.status,
                left.text.getBytes("UTF-8").length, right.text.getBytes("UTF-8").length,
                (b - a) / 1000000, (c - b) / 1000000));
            try { stacks = Gui.frameFrom(Gui.Json.parse(left.text), left.status).stacks; } catch (RuntimeException e) { /* keep the stacks */ }
        }
        System.exit(all ? 0 : 1);
    }
}
