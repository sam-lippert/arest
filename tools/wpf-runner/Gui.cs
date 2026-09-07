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
        Arest.Ev("store:append", new object[] { "journal", od[2] });
        renderPane("master", masterCanvas, masterScroller);
        renderPane("detail", detailCanvas, detailScroller);
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
        Arest.Register("render:canvas", x =>
        {
            var r = (object[])x;
            canvas.Background = brush("layerBg");
            canvas.Width = num2(r[3]);
            canvas.Height = num2(r[4]);
            return null;
        });
        Arest.Register("render:headerbar", x =>
        {
            var b = new Border();
            b.Background = brush("headerColor");
            b.BorderBrush = brush("headerSepColor");
            b.BorderThickness = new Thickness(0, 0, 0, 1);
            return b;
        });
        Arest.Register("render:titletext", x =>
        {
            var r = (object[])x;
            return label(text(r[5]), "titleSize", "titleColor", true);
        });
        Arest.Register("render:backbtn", x =>
        {
            var r = (object[])x;
            var l = label(sv("backLabel"), "textSize", "linkColor", false);
            l.Cursor = Cursors.Hand;
            object addr = r[5];
            l.MouseLeftButtonUp += (s, e) => navigate(addr);
            return l;
        });
        Arest.Register("render:sectionheader", x =>
        {
            var r = (object[])x;
            var l = label(text(r[5]), "sectionSize", "sectionTextColor", false);
            return l;
        });
        Arest.Register("render:sep", x =>
        {
            var b = new Border();
            b.Background = brush("sepColor");
            return b;
        });
        Arest.Register("render:itemrow", x =>
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
        Arest.Register("render:textbox", x =>
        {
            var t = new TextBox();
            return field((object[])x, t, () => t.Text);
        });
        Arest.Register("render:textarea", x =>
        {
            var t = new TextBox();
            t.AcceptsReturn = true;
            t.TextWrapping = TextWrapping.Wrap;
            return field((object[])x, t, () => t.Text);
        });
        Arest.Register("render:numericfield", x =>
        {
            var t = new TextBox();
            t.PreviewTextInput += (s, e) =>
                e.Handled = !System.Text.RegularExpressions.Regex.IsMatch(e.Text, "^[0-9.-]$");
            return field((object[])x, t, () => t.Text);
        });
        Arest.Register("render:datepicker", x =>
        {
            var d = new DatePicker();
            return field((object[])x, d, () =>
                d.SelectedDate.HasValue ? d.SelectedDate.Value.ToString("yyyy-MM-dd") : "");
        });
        // WPF ships no time picker; the text is the time
        Arest.Register("render:timepicker", x =>
        {
            var t = new TextBox();
            return field((object[])x, t, () => t.Text);
        });
        // the image is a value the store holds by address
        Arest.Register("render:imagepicker", x =>
        {
            var t = new TextBox();
            return field((object[])x, t, () => t.Text);
        });
        Arest.Register("render:switch", x =>
        {
            var c = new CheckBox();
            return field((object[])x, c, () => c.IsChecked == true ? "true" : "");
        });
        Arest.Register("render:label", x =>
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
        Arest.Register("render:selectlist", select);
        Arest.Register("render:navigationfield", select);
        Arest.Register("render:button", x =>
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
                var addr = new System.Collections.Generic.List<object> { "submit", group, idf() };
                foreach (var kv in formInputs)
                    if (kv.Key != group && kv.Value().Length > 0)
                    { addr.Add(kv.Key); addr.Add(kv.Value()); }
                formInputs.Clear();
                navigate(addr.ToArray());
            };
            return b;
        });
        Arest.Register("render:blocktext", x =>
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
        Arest.Register("clock", x =>
            System.DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",
                System.Globalization.CultureInfo.InvariantCulture));
        Arest.Register("store:append", x =>
        {
            var p = (object[])x;
            System.IO.File.AppendAllText(
                System.IO.Path.Combine(carrierDir(), (string)p[0]),
                (string)p[1]);
            return "T";
        });
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
        win.SizeChanged += (s, e) => navigate(new object[0]);
        win.Loaded += (s, e) =>
        {
            navigate(new object[0]);
            // browse the FIXED store: derive once (async), swap, re-render
            new System.Threading.Thread(() =>
            {
                var fixedStore = (object[])Arest.Ev("ui:boot", store);
                win.Dispatcher.BeginInvoke(new Action(() =>
                {
                    store = fixedStore;
                    navigate(new object[0]);
                }));
            }).Start();
        };
        new Application().Run(win);
    }
}
