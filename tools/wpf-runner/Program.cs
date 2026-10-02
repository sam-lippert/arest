using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace Arest.Wpf
{
    // THE WPF CONTAINER (#124, 2026-10-02). Sam, 2026-10-01: a registration
    // surface per platform -- Slint in Rust, WPF in C#, React for the web -- and
    // any host language registers through the same surface. This is the C# one:
    // Registry.cs is the pairing table and the platform's defaults, Controls.cs
    // the elements and the render:wpf layout engine, Navigate.cs the one call.
    // tools/wpf-runner held a 15,311-line Gui.cs until 2026-09-20, deleted as a
    // UI host that was not a registration (Sam: "delete the UI hosts too. They're
    // probably all wrong."); this starts from navigate, not from that.
    //
    //   arest-wpf                      the window, master and detail, over AREST_PORT
    //   arest-wpf snapshot <dir>       the same container with no window, each frame
    //                                  it draws written to a PNG (the evidence)
    public static class Program
    {
        [STAThread]
        public static int Main(string[] args)
        {
            if (args.Length >= 2 && args[0] == "snapshot") return Snapshot.Run(args[1]);
            var app = new Application();
            var platform = new Platform(1100, Registry.RegisteredNames());
            var window = new Window { Title = "AREST", Width = platform.Width, Height = 760 };
            var root = new DockPanel();
            var alert = new ContentControl();
            DockPanel.SetDock(alert, Dock.Top);
            var panes = new StackPanel { Orientation = Orientation.Horizontal };
            root.Children.Add(alert);
            root.Children.Add(panes);
            window.Content = root;
            Controls.Navigator = (address, from) => Task.Run(() =>
            {
                try
                {
                    platform.Go(address, from);
                    app.Dispatcher.Invoke(() => Redraw(platform, alert, panes, window));
                }
                catch (Exception e)
                {
                    app.Dispatcher.Invoke(() => alert.Content = Controls.Alert(new object[] { "alert", new object[] {
                        new object[] { "Title", "error" }, new object[] { "Message", e.Message } } }, null));
                }
            });
            window.Loaded += (s, e) => Controls.Navigator(new object[0], null);   // MonoCross's NavigateOnLoad: the root
            return app.Run(window);
        }

        static void Redraw(Platform platform, ContentControl alert, StackPanel panes, Window window)
        {
            panes.Children.Clear();
            if (platform.Unpaired.Count > 0)
            {
                // THE GATE IS LAMBDA'S: a frame naming an unpaired kind is a refusal to draw, by name
                var refusal = "refusing to draw: lambda declares control kinds this container does not pair: "
                    + string.Join(", ", platform.Unpaired);
                Console.Error.WriteLine(refusal);
                alert.Content = new TextBlock { Text = refusal, Foreground = Brushes.Firebrick, Margin = new Thickness(16) };
                return;
            }
            alert.Content = platform.Alert != null ? Controls.Draw(platform.Alert, null) : null;
            for (var i = 0; i < platform.Placed.Count; i++)
            {
                var pane = platform.Placed[i];
                panes.Children.Add(new ScrollViewer
                {
                    Content = Screen.Draw(pane.Value, new Pane(pane.Key)),
                    Width = platform.PaneWidth(i),
                    Height = Math.Max(100, window.ActualHeight - 60),
                    VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                    HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
                });
            }
        }
    }

    /// <summary>
    /// THE CONTAINER WITH NO WINDOW: every frame below is one navigate the container sends with its
    /// own registration and defaults, and every image is that frame laid out by its own elements and
    /// layout engine and rendered offscreen (RenderTargetBitmap). The submit is the form's own Submit
    /// button, clicked.
    /// </summary>
    static class Snapshot
    {
        public static int Run(string outDir)
        {
            Directory.CreateDirectory(outDir);
            var names = Registry.RegisteredNames();
            Console.WriteLine("registered " + names.Count + ": " + string.Join(", ", names));
            var p = new Platform(980, names);
            Step(p, outDir, "1-root", new object[0], null);
            Step(p, outDir, "2-collection", new object[] { "Function" }, "master");
            Step(p, outDir, "3-entity", new object[] { "Function", "render:listview" }, "master");
            Step(p, outDir, "4-form", new object[] { "new", "Function" }, "master");
            var address = ClickSubmit(p, "detail", "Function", "f-wpf");
            Console.WriteLine("submit address " + Json.Write(address));
            Step(p, outDir, "5-submitted", address, "detail");
            Step(p, outDir, "6-form-again", new object[] { "new", "Function" }, "master");
            var bare = ClickSubmit(p, "detail", "Function", "");
            Console.WriteLine("submit address " + Json.Write(bare));
            Step(p, outDir, "7-refused", bare, "detail");
            // THE PAIRING IS LAMBDA'S: the same container short of one control, and short of its engine
            Refused("render:gridcell");
            Refused(Registry.LayoutEngine);
            return 0;
        }

        static void Step(Platform p, string outDir, string name, object address, string from)
        {
            var t0 = DateTime.UtcNow;
            var f = p.Go(address, from);
            var ms = (int)(DateTime.UtcNow - t0).TotalMilliseconds;
            Console.WriteLine(name + ": status " + f.Status + ", " + ms + " ms, unpaired [" + string.Join(", ", f.Unpaired)
                + "], stacks " + Json.Write(p.Stacks));
            foreach (var pane in f.Panes)
                Console.WriteLine("  pane " + pane.Key + ": " + pane.Value.Length + " rows " + Kinds(pane.Value));
            if (p.Alert != null) Console.WriteLine("  alert " + Json.Write(p.Alert));
            Save(Paint(p, 1400), Path.Combine(outDir, name + ".png"));
        }

        static string Kinds(object[] rows)
        {
            var k = new SortedDictionary<string, int>(StringComparer.Ordinal);
            void Count(object[] row)
            {
                var kind = Rows.KindOf(row);
                k[kind] = k.TryGetValue(kind, out var n) ? n + 1 : 1;
                var props = Rows.Props(row);
                foreach (var m in new[] { "Children", "Buttons" })
                    if (props.GetValueOrDefault(m) is object[] kids) foreach (var c in kids.OfType<object[]>()) Count(c);
                foreach (var m in new[] { "Menu", "SearchBox" })
                    if (Rows.NonEmpty(props.GetValueOrDefault(m))) Count((object[])props[m]);
            }
            foreach (var r in rows.OfType<object[]>()) Count(r);
            return "{" + string.Join(", ", k.Select(e => e.Key + "=" + e.Value)) + "}";
        }

        /// <summary>Type the identifier into the pane's control for it and click the view's Submit; answer what it sends.</summary>
        static object ClickSubmit(Platform p, string paneName, string key, string value)
        {
            var pane = new Pane(paneName);
            var view = Screen.Draw(p.Placed.First(e => e.Key == paneName).Value, pane);
            foreach (var s in pane.Submits)
                if (s.Key == key && s.Value is TextBox t) { t.Text = value; break; }
            var save = Find(view, "save") ?? throw new InvalidOperationException("the form offers no save");
            object captured = null;
            Controls.Navigator = (address, from) => captured = address;
            save.RaiseEvent(new RoutedEventArgs(System.Windows.Controls.Primitives.ButtonBase.ClickEvent));
            return captured;
        }

        static System.Windows.Controls.Button Find(DependencyObject d, string title)
        {
            if (d is System.Windows.Controls.Button b && title.Equals(b.Content)) return b;
            foreach (var child in LogicalTreeHelper.GetChildren(d).OfType<DependencyObject>())
            {
                var found = Find(child, title);
                if (found != null) return found;
            }
            return null;
        }

        static void Refused(string drop)
        {
            var names = Registry.RegisteredNames().Where(n => n != drop).ToList();
            var p = new Platform(980, names);
            var f = p.Go(new object[0], null);
            Console.WriteLine("without " + drop + ": unpaired [" + string.Join(", ", f.Unpaired) + "], panes drawn " + p.Placed.Count);
        }

        /// <summary>The platform's frame laid out with no window: the alert, then each pane at its width, up to maxHeight.</summary>
        static BitmapSource Paint(Platform p, int maxHeight)
        {
            var grid = new Grid { Background = Brushes.White, Width = p.Width };
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            if (p.Alert != null)
            {
                var a = Controls.Draw(p.Alert, null);
                Grid.SetRow(a, 0);
                grid.Children.Add(a);
            }
            var panes = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Top };
            for (var i = 0; i < p.Placed.Count; i++)
                panes.Children.Add(new Border
                {
                    Child = Screen.Draw(p.Placed[i].Value, new Pane(p.Placed[i].Key)),
                    Width = p.PaneWidth(i),
                    BorderBrush = new SolidColorBrush(Color.FromRgb(0xDD, 0xDD, 0xDD)),
                    BorderThickness = new Thickness(0, 0, 1, 0),
                    VerticalAlignment = VerticalAlignment.Top,
                    ClipToBounds = true,
                });
            Grid.SetRow(panes, 1);
            grid.Children.Add(panes);
            grid.Measure(new Size(p.Width, double.PositiveInfinity));
            var height = Math.Min(maxHeight, Math.Max(1, grid.DesiredSize.Height));
            grid.Height = height;
            grid.Measure(new Size(p.Width, height));
            grid.Arrange(new Rect(0, 0, p.Width, height));
            grid.UpdateLayout();
            var bmp = new RenderTargetBitmap(p.Width, (int)Math.Ceiling(height), 96, 96, PixelFormats.Pbgra32);
            bmp.Render(grid);
            return bmp;
        }

        static void Save(BitmapSource bmp, string path)
        {
            var enc = new PngBitmapEncoder();
            enc.Frames.Add(BitmapFrame.Create(bmp));
            using var s = File.Create(path);
            enc.Save(s);
        }
    }
}
