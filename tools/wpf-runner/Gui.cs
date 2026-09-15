using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

// The WPF CONTAINER: MonoCross's own components under the canon's mu.
// The registered render functions CONSTRUCT real iFactr.Wpf controls
// (the Distribution DLLs - the last signed-era binaries) and register
// INTO DEFS, never a named type map: drawing a control is
// Ev("render:<name>", row) - rho-application through the one mu. The
// container holds <store, stack, address>, evaluates ui:nav once per
// navigation, and decides nothing.
public static class Gui
{
    static object[] store;
    // the registered stack population - this container's form factor:
    // a master list pane and a detail content pane, side by side
    static object stacks = new object[] {
        new object[] { "master", new object[0] },
        new object[] { "detail", new object[0] } };
    static readonly Canvas masterCanvas = new Canvas();
    static readonly Canvas detailCanvas = new Canvas();
    static Canvas canvas;                 // the pane being rebuilt
    static ScrollViewer masterScroller;
    static ScrollViewer detailScroller;
    static ScrollViewer scroller;         // the pane being measured
    static readonly Dictionary<string, string> STYLE = new Dictionary<string, string>();
    // the form's inputs by fact type: each typed control registers how it
    // reads back as the value text the address carries
    static readonly Dictionary<string, Func<string>> formInputs = new Dictionary<string, Func<string>>();

    // THE PAIRS THIS CONTAINER MADE. Registration goes into the mu's DEFS,
    // which is the mu's business; the PAIRING is this container's -- an
    // abstract control kind bound to the native control that draws it
    // (iFactr's IPairable, whose abstract half is complete without the native
    // half, and Pair is the slot the native one goes in). So the table is kept
    // here, and law:origin_boundary is handed it at boot.
    static readonly List<object> paired = new List<object>();
    static void Pair(string name, Func<object, object> impl)
    {
        paired.Add(name);
        Arest.Register(name, impl);
    }

    // ---- THE ONE SEAM TO SERVE -------------------------------------------
    //
    // ONE CALL, NO METHOD BRANCH. api() sends the method it is handed and
    // reads back what came; what a method MEANS is http:method_kinds' business
    // on the other side -- main:api0 dispatches on the KIND (nav, transition,
    // retraction, replacement) and never on the spelling -- so a container
    // that tested the method here would be deciding that for it.
    static string serveBase()
    {
        var url = Environment.GetEnvironmentVariable("AREST_SERVE");
        if (!string.IsNullOrEmpty(url)) return url;
        var port = Environment.GetEnvironmentVariable("AREST_PORT");
        return "http://127.0.0.1:" + (string.IsNullOrEmpty(port) ? "8787" : port);
    }

    // a resource is words, and serve decodes the whole path at once
    // (decodeURIComponent), so each segment is encoded and the slashes stay
    // slashes -- a table's real name has spaces in it
    static string enc(string resource)
    {
        var parts = resource.Split('/');
        for (int i = 0; i < parts.Length; i++) parts[i] = Uri.EscapeDataString(parts[i]);
        return string.Join("/", parts);
    }

    static string[] api(string method, string resource, string fact)
    {
        var where = serveBase() + "/" + enc(resource);
        try
        {
            var req = (System.Net.HttpWebRequest)System.Net.WebRequest.Create(where);
            req.Method = method;
            req.Timeout = 30000;
            req.ReadWriteTimeout = 30000;
            if (fact != null)
            {
                req.ContentType = "application/json";
                var body = System.Text.Encoding.UTF8.GetBytes(fact);
                req.ContentLength = body.Length;
                using (var s = req.GetRequestStream()) s.Write(body, 0, body.Length);
            }
            using (var res = (System.Net.HttpWebResponse)req.GetResponse())
                return new string[] { readBody(res), ((int)res.StatusCode).ToString() };
        }
        catch (System.Net.WebException e)
        {
            // A REFUSAL IS AN ANSWER. Canon decided the status (http:status_of)
            // and 4xx arrives here as an exception only because this is .NET;
            // the answer is read out of it rather than thrown away.
            var res = e.Response as System.Net.HttpWebResponse;
            if (res != null) using (res) return new string[] { readBody(res), ((int)res.StatusCode).ToString() };
            // A WRITE THAT DID NOT LAND IS NOT A WRITE -- the lesson the
            // journal taught, spelled as a status of 0 rather than as a fact
            // folded into a store only this window can see.
            return new string[] { e.Message, "0" };
        }
        catch (Exception e) { return new string[] { e.Message, "0" }; }
    }

    static string readBody(System.Net.HttpWebResponse res)
    {
        using (var s = res.GetResponseStream())
        using (var r = new System.IO.StreamReader(s, System.Text.Encoding.UTF8))
            return r.ReadToEnd();
    }

    // the fact as canon reads it: <id, fact type, value, fact type, value...>,
    // ui:create0's own address with the two words that named the screen dropped
    static string json(List<string> words)
    {
        var s = new System.Text.StringBuilder("[");
        for (int i = 0; i < words.Count; i++)
        {
            if (i > 0) s.Append(",");
            s.Append('"');
            foreach (char ch in words[i])
            {
                if (ch == '"' || ch == '\\') s.Append('\\').Append(ch);
                else if (ch < 0x20) s.Append(' ');
                else s.Append(ch);
            }
            s.Append('"');
        }
        return s.Append("]").ToString();
    }

    static int statusOf(string[] answer)
    {
        int n;
        return int.TryParse(answer[1], out n) ? n : 0;
    }

    // THE WRITE GOES OUT THROUGH SERVE AND IS READ BACK THROUGH SERVE, both
    // legs on the one seam: POST the fact to the group's resource, then GET the
    // item. The read-back is unconditional because it is the honest question --
    // what does the server hold now? -- and a refusal answers it as truthfully
    // as an acceptance does. A WinExe has no console, so both exchanges go to
    // stage.txt beside the exe, which is where this container speaks.
    static bool submit(string group, string id, List<string> fact)
    {
        var wrote = api("POST", group, json(fact));
        stage = "POST /" + group + " -> " + wrote[1] + " " + wrote[0];
        var back = api("GET", group + "/" + id, null);
        stage = "GET /" + group + "/" + id + " -> " + back[1] + " " + back[0];
        return statusOf(wrote) > 0 && statusOf(wrote) < 400;
    }

    static string sv(string prop) { return STYLE[prop]; }
    static int num(string prop) { return int.Parse(STYLE[prop]); }
    static Brush brush(string prop)
    {
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString(sv(prop)));
    }
    static string text(object atom)
    {
        if (atom is object[]) throw new Exception("control payload is a sequence");
        return atom == null ? "" : atom.ToString();
    }
    static int num2(object n) { return Convert.ToInt32(n); }
    static bool empty(object x) { return x is object[] && ((object[])x).Length == 0; }

    static void navigate(object addr)
    {
        try { navigate0(addr); }
        catch (Exception e) { crash(e); throw; }
    }

    static void navigate0(object addr)
    {
        stage = "navigate " + show(addr);
        var od = (object[])Arest.Ev("ui:navpe", new object[] { store, stacks, addr });
        store = (object[])od[0];
        stacks = od[1];
        renderPane("master", masterCanvas, masterScroller);
        renderPane("detail", detailCanvas, detailScroller);
    }

    static void rerender()
    {
        renderPane("master", masterCanvas, masterScroller);
        renderPane("detail", detailCanvas, detailScroller);
    }

    static bool formHasInput()
    {
        foreach (var kv in formInputs)
            if (kv.Value().Length > 0) return true;
        return false;
    }

    static void renderPane(string pane, Canvas c, ScrollViewer s)
    {
        canvas = c;
        scroller = s;
        object tree = Arest.Ev("ui:pane_view", new object[] { store, stacks, pane });
        object placed = Arest.Ev("ui:arrange", new object[] { tree, canvasWidth() });
        rebuild((object[])placed);
    }

    static int canvasWidth()
    {
        int w = scroller == null ? 0 : (int)scroller.ViewportWidth;
        return w > 0 ? w : num("frameW");
    }

    static void rebuild(object[] placed)
    {
        canvas.Children.Clear();
        // the render pass is canon (ui:render = alpha(apply(render:<name>)));
        // the host keeps only the SetLocation seam
        var widgets = (object[])Arest.Ev("ui:render", placed);
        for (int i = 0; i < widgets.Length; i++)
        {
            var c = (UIElement)widgets[i];
            if (c != null)
            {
                var r = (object[])placed[i];
                Canvas.SetLeft(c, num2(r[1]));
                Canvas.SetTop(c, num2(r[2]));
                var fe = c as FrameworkElement;
                if (fe != null) { fe.Width = num2(r[3]); fe.Height = num2(r[4]); }
                canvas.Children.Add(c);
            }
        }
    }

    static iFactr.Wpf.Label label(string content, string sizeProp, string colorProp, bool bold)
    {
        var l = new iFactr.Wpf.Label();
        l.Text = content;
        l.FontFamily = new FontFamily(sv("fontFamily"));
        l.FontSize = num(sizeProp);
        l.Foreground = brush(colorProp);
        l.FontWeight = bold ? FontWeights.Bold : FontWeights.Normal;
        return l;
    }

    static void registerComponents()
    {
        Pair("render:canvas", x =>
        {
            var r = (object[])x;
            canvas.Background = brush("layerBg");
            canvas.Width = num2(r[3]);
            canvas.Height = num2(r[4]);
            return null;
        });
        Pair("render:headerbar", x =>
        {
            var b = new Border();
            b.Background = brush("headerColor");
            b.BorderBrush = brush("headerSepColor");
            b.BorderThickness = new Thickness(0, 0, 0, 1);
            return b;
        });
        Pair("render:titletext", x =>
        {
            var r = (object[])x;
            return label(text(r[5]), "titleSize", "titleColor", true);
        });
        Pair("render:backbtn", x =>
        {
            var r = (object[])x;
            var l = label(sv("backLabel"), "textSize", "linkColor", false);
            l.Cursor = Cursors.Hand;
            object addr = r[5];
            l.MouseLeftButtonUp += (s, e) => navigate(addr);
            return l;
        });
        Pair("render:sectionheader", x =>
        {
            var r = (object[])x;
            var l = label(text(r[5]), "sectionSize", "sectionTextColor", false);
            return l;
        });
        Pair("render:sep", x =>
        {
            var b = new Border();
            b.Background = brush("sepColor");
            return b;
        });
        Pair("render:itemrow", x =>
        {
            var r = (object[])x;
            bool linked = !empty(r[7]);
            bool sub = !empty(r[6]);
            int w = num2(r[3]), h = num2(r[4]);
            var p = new Canvas();
            p.Background = brush("itemBg");
            // cell-internal rectangles are canon's (ui:iteminner), not ours
            var inner = (object[])Arest.Ev("ui:iteminner",
                new object[] { w, h, sub ? "T" : "F" });
            var tr = (object[])inner[0];
            var sr = (object[])inner[1];
            var cr = (object[])inner[2];
            var t = label(text(r[5]), "textSize", linked ? "linkColor" : "textColor", false);
            place(p, t, tr);
            if (sub)
            {
                var s2 = label(text(r[6]), "subtextSize", "subtextColor", false);
                place(p, s2, sr);
            }
            if (linked)
            {
                var ch = label(sv("chevGlyph"), "titleSize", "chevronColor", false);
                place(p, ch, cr);
                p.Cursor = Cursors.Hand;
                object addr = r[7];
                p.MouseLeftButtonUp += (s, e) => navigate(addr);
                p.MouseEnter += (s, e) => p.Background = brush("selectionColor");
                p.MouseLeave += (s, e) => p.Background = brush("itemBg");
            }
            return p;
        });
        // THE TYPED ENTRY CONTROLS. The placed row is <control, x, y, w, h,
        // label, fact type, options>; the control's name was chosen in canon
        // from the column's conceptual data type (ui:control_for over
        // ui:field_type), and each registration here is the concrete WPF
        // control that abstract control binds to: a text box, a multi-line
        // text box, a numeric text box, a date picker, a check box whose
        // value is 'true', a read-only box for the columns the store fills
        // itself, and a combo box over the row's options (the enumeration,
        // or the referenced type's population for the navigation field).
        Pair("render:textbox", x =>
        {
            var t = new TextBox();
            return field((object[])x, t, () => t.Text);
        });
        Pair("render:textarea", x =>
        {
            var t = new TextBox();
            t.AcceptsReturn = true;
            t.TextWrapping = TextWrapping.Wrap;
            return field((object[])x, t, () => t.Text);
        });
        Pair("render:numericfield", x =>
        {
            var t = new TextBox();
            t.PreviewTextInput += (s, e) =>
                e.Handled = !System.Text.RegularExpressions.Regex.IsMatch(e.Text, "^[0-9.-]$");
            return field((object[])x, t, () => t.Text);
        });
        Pair("render:datepicker", x =>
        {
            var d = new DatePicker();
            return field((object[])x, d, () =>
                d.SelectedDate.HasValue ? d.SelectedDate.Value.ToString("yyyy-MM-dd") : "");
        });
        // WPF ships no time picker; the text is the time
        Pair("render:timepicker", x =>
        {
            var t = new TextBox();
            return field((object[])x, t, () => t.Text);
        });
        // the image is a value the store holds by address
        Pair("render:imagepicker", x =>
        {
            var t = new TextBox();
            return field((object[])x, t, () => t.Text);
        });
        Pair("render:switch", x =>
        {
            var c = new CheckBox();
            return field((object[])x, c, () => c.IsChecked == true ? "true" : "");
        });
        Pair("render:label", x =>
        {
            var t = new TextBox();
            t.IsReadOnly = true;
            return field((object[])x, t, () => "");
        });
        Func<object, object> select = x =>
        {
            var r = (object[])x;
            var c = new ComboBox();
            c.Items.Add("");
            foreach (string o in options(r)) c.Items.Add(o);
            c.SelectedIndex = 0;
            return field(r, c, () => c.SelectedItem == null ? "" : c.SelectedItem.ToString());
        };
        Pair("render:selectlist", select);
        Pair("render:navigationfield", select);
        Pair("render:button", x =>
        {
            var r = (object[])x;
            var b = new Button();
            b.Content = text(r[5]);
            string group = text(r[6]);
            b.Click += (s, e) =>
            {
                Func<string> idf;
                stage = "submit " + group + " with " + formInputs.Count + " inputs";
                if (!formInputs.TryGetValue(group, out idf) || idf().Length == 0) return;
                string id = idf();
                var addr = new System.Collections.Generic.List<object> { "submit", group, id };
                foreach (var kv in formInputs)
                    if (kv.Key != group && kv.Value().Length > 0)
                    { addr.Add(kv.Key); addr.Add(kv.Value()); }
                // the fact is the address without the two words that named the
                // screen; the same list serves both, because ui:create0 and
                // main:api read the same order
                var fact = new List<string>();
                for (int i = 2; i < addr.Count; i++) fact.Add(Convert.ToString(addr[i]));
                var address = addr.ToArray();
                // off the UI thread: the durable write is a network call, and a
                // frozen window is not a rendering of anything
                new System.Threading.Thread(() =>
                {
                    if (!submit(group, id, fact)) return;   // refused: what was
                    // typed stays typed, and no fact enters this window's store
                    b.Dispatcher.BeginInvoke(new Action(() =>
                    { formInputs.Clear(); navigate(address); }));
                }).Start();
            };
            return b;
        });
        Pair("render:blocktext", x =>
        {
            var r = (object[])x;
            var t = new TextBox();
            t.Text = text(r[5]);
            t.IsReadOnly = true;
            t.FontFamily = new FontFamily("Consolas");
            t.FontSize = num("blockSize");
            t.Background = brush("itemBg");
            t.Foreground = brush("textColor");
            t.Padding = new Thickness(num("pad"));
            t.VerticalScrollBarVisibility = ScrollBarVisibility.Auto;
            return t;
        });
        // the storage surface: the one durable write, and nothing else -
        // the byte form, the timing, and the sequence are all canon's
        // the same instant stamps the same bytes on every host: ISO 8601 UTC
        // to the millisecond, as the js and rust hosts answer it
        Pair("clock", x =>
            System.DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                System.Globalization.CultureInfo.InvariantCulture));
        // NO store:append. The journal is gone (Samuel, 2026-09-11), so this
        // container no longer writes an entry file and no longer replays one at
        // boot: what it loses is its OWN session restore, which nothing else read.
        //
        // AND WHAT REPLACED IT IS SERVE, NOT A DATABASE DRIVER HERE (#108,
        // 2026-09-15). What stood here said durability for this station was a
        // write into the tables the way the js host does it, needing
        // Microsoft.Data.Sqlite; the java container carried the same proposal
        // against sqlite-jdbc. That is one persistence implementation per
        // platform, and Samuel ruled it out (2026-09-14): a gui should just be
        // the abstract ui as a thin hateoas wrapper, and a platform factory
        // renders the abstract ui. The rendering half is already here -- the
        // Pair(render:<control>, native control) table above IS the platform
        // factory, and ui:screen is the abstract ui -- so the durable half is
        // reached the way any other client reaches it: over HTTP to serve,
        // which applies main:api and does the validating, the deriving, the
        // emitting into the tables and the deciding of the status, none of
        // which is per-platform. api() above is the whole seam; the button
        // posts through it and reads back through it.
    }

    // the carriers this build composed from: AREST_CARRIERS when set (the js
    // host's convention), else the path the build recorded beside the exe
    static string carrierDir()
    {
        var env = Environment.GetEnvironmentVariable("AREST_CARRIERS");
        if (!string.IsNullOrEmpty(env)) return env;
        var beside = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "carriers.path");
        if (System.IO.File.Exists(beside)) return System.IO.File.ReadAllText(beside).Trim();
        return System.IO.Path.Combine("..", "..", "apps", "sherlock");
    }

    // one labelled entry control: the label above, the input below, the
    // read-back registered under the fact type the row names
    static Canvas field(object[] r, FrameworkElement input, Func<string> value)
    {
        var p = new Canvas();
        p.Background = brush("layerBg");
        var l = label(text(r[5]), "subtextSize", "sectionTextColor", false);
        Canvas.SetLeft(l, 0); Canvas.SetTop(l, 0); l.Width = 300; l.Height = 20;
        p.Children.Add(l);
        Canvas.SetLeft(input, 0); Canvas.SetTop(input, 22); input.Width = 300; input.Height = 26;
        p.Children.Add(input);
        formInputs[text(r[6])] = value;
        return p;
    }
    static string[] options(object[] r)
    {
        var o = r.Length > 7 && r[7] is object[] ? (object[])r[7] : new object[0];
        var s = new string[o.Length];
        for (int i = 0; i < o.Length; i++) s[i] = text(o[i]);
        return s;
    }

    static void place(Canvas parent, FrameworkElement c, object[] rect)
    {
        Canvas.SetLeft(c, num2(rect[0]));
        Canvas.SetTop(c, num2(rect[1]));
        c.Width = num2(rect[2]);
        c.Height = num2(rect[3]);
        parent.Children.Add(c);
    }

    // WHAT THE CONTAINER WAS DOING WHEN IT DIED. A WinExe has no console, so
    // an exception out of the mu reached the event log as a bare
    // IndexOutOfRange with lambda numbers for a stack; the stage and the
    // exception now land in crash.txt beside the exe before the rethrow.
    // the stage is also written beside the exe as it changes (stage.txt), so
    // a container that is killed or hangs still says what it was doing last
    static string stageValue = "load";
    static string stage
    {
        get { return stageValue; }
        set
        {
            stageValue = value;
            try
            {
                System.IO.File.WriteAllText(
                    System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "stage.txt"), value);
            }
            catch { }
        }
    }
    static string show(object x)
    {
        if (!(x is object[])) return x == null ? "" : x.ToString();
        var parts = new List<string>();
        foreach (object y in (object[])x) parts.Add(show(y));
        return "(" + string.Join(" ", parts) + ")";
    }
    static void crash(Exception e)
    {
        try
        {
            System.IO.File.WriteAllText(
                System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "crash.txt"),
                stage + "\n" + e);
        }
        catch { }
    }

    [STAThread]
    public static void Main()
    {
        try { Run(); }
        catch (Exception e) { crash(e); throw; }
    }

    static void Run()
    {
        Arest.Load();
        stage = "carriers";
        Arest.LoadCarriers();
        // AND THE STORE IS BOOTED, not merely read (the cs-runner's Boot.cs):
        // FILE projected, the meta-types reflected, the closure taken, the
        // journal folded -- the same four canon calls the js host makes
        stage = "boot";
        Arest.Boot();
        store = new List<object>(Arest.CELLS).ToArray();
        stage = "style";
        var style = (object[])Arest.Ev(
            new object[] { "COMP", "theta:flatten", "ui:style" }, new object[0]);
        foreach (object row in style)
        {
            var pv = (object[])row;
            STYLE[(string)pv[0]] = pv[1].ToString();
        }
        registerComponents();

        // PAIRING TOTALITY, ASKED OF THIS CONTAINER (#108). Pair(control,
        // impl) IS the pairing, so the table it built is this container's half
        // of Def 11, and law:origin_boundary now takes it: does every abstract
        // control kind the store declares registered HAVE a registration here?
        // The law ships inside Composed.g.cs -- it has been compiled into this
        // container all along -- and nothing ever handed it this table, so the
        // container was unchecked by the one check written for it. An unpaired
        // kind is a window that dies mid-render on the first row that names it,
        // so this refuses before the window and law:unpaired names what is
        // missing. The two halves are reported apart because they measure
        // different things: law:origins_match is the store's, and law:report is
        // where a store is gated; law:paired is this container's own.
        stage = "pairing";
        var registered = paired.ToArray();
        var pair = new object[] { store, registered };
        var kinds = (object[])Arest.Ev("law:ctl_declared", store);
        var verdict = "law:origin_boundary over <store, " + registered.Length + " registered>: "
            + Convert.ToString(Arest.Ev("law:origin_boundary", pair))
            + "  (store halves " + Convert.ToString(Arest.Ev("law:origins_match", store))
            + ", pairing " + Convert.ToString(Arest.Ev("law:paired", pair))
            + " over " + kinds.Length + " declared control kinds)";
        stage = verdict;
        // AND A VERDICT NOTHING CAN READ IS NOT A VERDICT. stage.txt holds only
        // the last thing this container was doing, and the next stage overwrites
        // this one a millisecond later; a WinExe has no console to have said it
        // to. So the answer is left beside the exe the way the build leaves
        // carriers.path, and the last boot's boundary is readable after it.
        try
        {
            System.IO.File.WriteAllText(
                System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "boundary.txt"), verdict);
        }
        catch { }
        if (!"T".Equals(Convert.ToString(Arest.Ev("law:paired", pair))))
        {
            var names = new List<string>();
            foreach (var m in (object[])Arest.Ev("law:unpaired", pair)) names.Add(Convert.ToString(m));
            crash(new Exception("unpaired control kinds: " + string.Join(", ", names)));
            Environment.Exit(2);
        }

        // the canvas sits where canon placed it: a ScrollViewer centres content
        // smaller than its viewport, which put every rectangle ~130 px below
        // the coordinates canon computed for it
        masterCanvas.VerticalAlignment = VerticalAlignment.Top;
        masterCanvas.HorizontalAlignment = HorizontalAlignment.Left;
        detailCanvas.VerticalAlignment = VerticalAlignment.Top;
        detailCanvas.HorizontalAlignment = HorizontalAlignment.Left;
        masterScroller = new ScrollViewer();
        masterScroller.Content = masterCanvas;
        masterScroller.HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled;
        detailScroller = new ScrollViewer();
        detailScroller.Content = detailCanvas;
        detailScroller.HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled;
        var grid = new Grid();
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(320) });
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        Grid.SetColumn(masterScroller, 0);
        Grid.SetColumn(detailScroller, 1);
        grid.Children.Add(masterScroller);
        grid.Children.Add(detailScroller);
        var win = new Window();
        // the window names its tenant, like the root layer
        stage = "title";
        win.Title = text(((object[])Arest.Ev("ui:screen",
            new object[] { store, new object[0], new object[0], new object[0] }))[1]);
        win.Width = num("frameW");
        win.Height = num("frameH");
        win.Content = grid;
        // a resize re-renders the panes where they are; it used to navigate to
        // the root, which pushed the root onto the master stack on every resize
        win.SizeChanged += (s, e) => rerender();
        win.Loaded += (s, e) =>
        {
            navigate(new object[0]);
            // browse the FIXED store: derive once (async), swap, re-render --
            // unless the user is mid-form, because a re-render rebuilds every
            // input and wiped what had been typed in the first forty seconds
            // (2026-09-07); the swapped store is read at the next navigation
            new System.Threading.Thread(() =>
            {
                var fixedStore = (object[])((object[])Arest.Ev("solve:fix", store))[0];
                win.Dispatcher.BeginInvoke(new Action(() =>
                {
                    store = fixedStore;
                    if (!formHasInput()) rerender();
                }));
            }).Start();
        };
        new Application().Run(win);
    }
}
