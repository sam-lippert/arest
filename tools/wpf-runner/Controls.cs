using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using WpfButton = System.Windows.Controls.Button;
using WpfImage = System.Windows.Controls.Image;

namespace Arest.Wpf
{
    /// <summary>Where a navigation comes from, and what a Submit sends.</summary>
    public sealed class Pane
    {
        public readonly string Name;
        public Brush Separator;
        /// <summary>SubmitKey and its control, in the order the screen placed them.</summary>
        public readonly List<KeyValuePair<string, FrameworkElement>> Submits = new List<KeyValuePair<string, FrameworkElement>>();
        public Pane(string name) { Name = name; }

        public void Submit(object key, FrameworkElement control)
        {
            if (key is string k) Submits.Add(new KeyValuePair<string, FrameworkElement>(k, control));
        }

        /// <summary>
        /// IListView.GetSubmissionValues: each control carrying a SubmitKey as a key and value pair,
        /// the value as the control holds it. A read-only label and an empty value send nothing, and
        /// a switch sends true when it is on.
        /// </summary>
        public List<object> SubmissionValues()
        {
            var pairs = new List<object>();
            foreach (var s in Submits)
            {
                string v;
                switch (s.Value)
                {
                    case CheckBox c: if (c.IsChecked != true) continue; v = "true"; break;
                    case ComboBox c: v = c.SelectedItem as string; break;
                    case Slider c: v = ((int)Math.Round(c.Value)).ToString(CultureInfo.InvariantCulture); break;
                    case PasswordBox c: v = c.Password; break;
                    case DatePicker c: v = c.SelectedDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture); break;
                    case TextBox c: if (c.IsReadOnly) continue; v = c.Text; break;
                    default: continue;
                }
                if (string.IsNullOrEmpty(v)) continue;
                pairs.Add(new object[] { s.Key, v });
            }
            return pairs;
        }
    }

    // THE WIDGETS: one WPF element per iFactr interface lambda places. Each draws
    // the members its interface names -- ITextBox.Text, ISelectList.Items and
    // SelectedItem, IGridCell.NavigationLink and Children, the Font and colors of
    // its row, set by lambda as iFactr's Converter sets them from the Style -- and
    // nothing else decides a color, a size, a route or a control.
    public static class Controls
    {
        /// <summary>The event half of the shim: a container that hands its events to lambda sets this.</summary>
        public static Action<object, string> Navigator = (address, from) => { };

        public static void Follow(object address, Pane pane)
        {
            if (Rows.NonEmpty(address)) Navigator(address, pane?.Name);
        }

        static Brush BrushOf(object v)
        {
            var s = Rows.Text(v);
            if (s.Length == 0) return null;
            try { return (Brush)new BrushConverter().ConvertFromString(s); } catch (FormatException) { return null; }
        }

        static void Font(Control c, object font)
        {
            if (font is object[] f && f.Length >= 2)
            {
                c.FontFamily = new FontFamily(Rows.Text(f[0]));
                c.FontSize = Rows.Num(f[1]);   // lambda measures a size as pixels, and so does WPF
                if (f.Length > 2 && "bold".Equals(f[2])) c.FontWeight = FontWeights.Bold;
            }
        }

        static void Font(TextBlock c, object font)
        {
            if (font is object[] f && f.Length >= 2)
            {
                c.FontFamily = new FontFamily(Rows.Text(f[0]));
                c.FontSize = Rows.Num(f[1]);   // lambda measures a size as pixels, and so does WPF
                if (f.Length > 2 && "bold".Equals(f[2])) c.FontWeight = FontWeights.Bold;
            }
        }

        /// <summary>Draw one row through the element paired to its kind; a kind with none refuses, never a blank.</summary>
        public static FrameworkElement Draw(object[] row, Pane pane)
        {
            if (!Registry.Widgets.TryGetValue("render:" + Rows.KindOf(row), out var w))
                throw new InvalidOperationException("no widget paired to render:" + Rows.KindOf(row)
                    + "; lambda placed a control this container does not have");
            var e = w(row, pane);
            if (row.Length >= 5)
            {
                Canvas.SetLeft(e, Rows.Num(row[1]));
                Canvas.SetTop(e, Rows.Num(row[2]));
                e.Width = Rows.Num(row[3]);
                e.Height = Rows.Num(row[4]);
            }
            return e;
        }

        /// <summary>IListView: the view's chrome (BackLink, Title, Menu, SearchBox) around its Canvas.</summary>
        public sealed class View : DockPanel
        {
            public readonly Canvas Content = new Canvas { ClipToBounds = true };
        }

        public static FrameworkElement ListView(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var v = new View { LastChildFill = true };
            v.Background = BrushOf(p.GetValueOrDefault("BackgroundColor"));
            var sep = BrushOf(p.GetValueOrDefault("SeparatorColor"));
            if (pane != null) pane.Separator = sep;
            var header = new DockPanel { LastChildFill = true, Background = BrushOf(p.GetValueOrDefault("HeaderColor")) };
            var back = p.GetValueOrDefault("BackLink");
            if (Rows.NonEmpty(back))
            {
                var b = new WpfButton { Content = "‹ back", Background = Brushes.Transparent, BorderThickness = new Thickness(0),
                                        Cursor = Cursors.Hand, Margin = new Thickness(0, 0, 8, 0) };
                b.Click += (s, e) => Follow(back, pane);
                DockPanel.SetDock(b, Dock.Left);
                header.Children.Add(b);
            }
            var menu = p.GetValueOrDefault("Menu");
            if (Rows.NonEmpty(menu))
            {
                var m = Draw((object[])menu, pane);
                DockPanel.SetDock(m, Dock.Right);
                header.Children.Add(m);
            }
            var title = new TextBlock { Text = Rows.Text(p.GetValueOrDefault("Title")), FontWeight = FontWeights.SemiBold,
                                        VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis };
            var tc = BrushOf(p.GetValueOrDefault("TitleColor"));
            if (tc != null) title.Foreground = tc;
            header.Children.Add(title);
            var top = new StackPanel();
            top.Children.Add(new Border { Child = header, Padding = new Thickness(14, 6, 14, 6), MinHeight = 32,
                                          BorderBrush = sep, BorderThickness = new Thickness(0, 0, 0, 1) });
            var search = p.GetValueOrDefault("SearchBox");
            if (Rows.NonEmpty(search))
                top.Children.Add(new Border { Child = Draw((object[])search, pane), Padding = new Thickness(14, 8, 14, 8) });
            DockPanel.SetDock(top, Dock.Top);
            v.Children.Add(top);
            if (row.Length >= 5)
            {
                v.Content.Width = Rows.Num(row[3]);
                v.Content.Height = Rows.Num(row[4]);
            }
            v.Content.HorizontalAlignment = HorizontalAlignment.Left;
            v.Content.VerticalAlignment = VerticalAlignment.Top;
            v.Children.Add(v.Content);
            return v;
        }

        /// <summary>ISectionHeader.</summary>
        public static FrameworkElement SectionHeader(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new TextBlock { Text = Rows.Text(p.GetValueOrDefault("Text")).ToUpperInvariant(), VerticalAlignment = VerticalAlignment.Center,
                                    TextTrimming = TextTrimming.CharacterEllipsis };
            Font(t, p.GetValueOrDefault("Font"));
            var fg = BrushOf(p.GetValueOrDefault("ForegroundColor"));
            if (fg != null) t.Foreground = fg;
            return new Border { Child = t, Background = BrushOf(p.GetValueOrDefault("BackgroundColor")) };
        }

        /// <summary>IGridCell: a Canvas holding its Children placed relative to it; with a NavigationLink, the cell is the link.</summary>
        public static FrameworkElement GridCell(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var cell = new Canvas { ClipToBounds = true };
            var bg = BrushOf(p.GetValueOrDefault("BackgroundColor"));
            cell.Background = bg ?? Brushes.Transparent;
            if (p.GetValueOrDefault("Children") is object[] kids)
                foreach (var k in kids)
                    if (k is object[] kr) cell.Children.Add(Draw(kr, pane));
            var border = new Border { Child = cell, BorderBrush = pane?.Separator, BorderThickness = new Thickness(0, 0, 0, 1) };
            var link = p.GetValueOrDefault("NavigationLink");
            if (Rows.NonEmpty(link))
            {
                var sel = BrushOf(p.GetValueOrDefault("SelectionColor"));
                border.Cursor = Cursors.Hand;
                border.MouseLeftButtonUp += (s, e) => Follow(link, pane);
                border.MouseEnter += (s, e) => { if (sel != null) cell.Background = sel; };
                border.MouseLeave += (s, e) => { cell.Background = bg ?? Brushes.Transparent; };
            }
            return border;
        }

        /// <summary>ILabel; one carrying a SubmitKey is a value a person does not type, shown read-only and not sent.</summary>
        public static FrameworkElement Label(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var fg = BrushOf(p.GetValueOrDefault("ForegroundColor"));
            if (p.GetValueOrDefault("SubmitKey") is string)
            {
                var t = new TextBox { Text = Rows.Text(p.GetValueOrDefault("Text")), IsReadOnly = true };
                Font(t, p.GetValueOrDefault("Font"));
                if (fg != null) t.Foreground = fg;
                return t;
            }
            var l = new TextBlock { Text = Rows.Text(p.GetValueOrDefault("Text")), TextTrimming = TextTrimming.CharacterEllipsis };
            Font(l, p.GetValueOrDefault("Font"));
            if (fg != null) l.Foreground = fg;
            return l;
        }

        /// <summary>IRichContentCell: a block of text, wrapped and scrollable.</summary>
        public static FrameworkElement RichContentCell(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new TextBox { Text = Rows.Text(p.GetValueOrDefault("Text")), IsReadOnly = true, TextWrapping = TextWrapping.Wrap,
                                  VerticalScrollBarVisibility = ScrollBarVisibility.Auto, BorderThickness = new Thickness(0) };
            Font(t, p.GetValueOrDefault("Font"));
            var fg = BrushOf(p.GetValueOrDefault("ForegroundColor"));
            if (fg != null) t.Foreground = fg;
            var bg = BrushOf(p.GetValueOrDefault("BackgroundColor"));
            if (bg != null) t.Background = bg;
            return t;
        }

        /// <summary>ITextBox; a KeyboardType of Symbolic or PIN is a number's, right-aligned.</summary>
        public static FrameworkElement TextBox(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new TextBox { Text = Rows.Text(p.GetValueOrDefault("Text")), VerticalContentAlignment = VerticalAlignment.Center };
            Font(t, p.GetValueOrDefault("Font"));
            var k = p.GetValueOrDefault("KeyboardType");
            if ("Symbolic".Equals(k) || "PIN".Equals(k)) t.TextAlignment = TextAlignment.Right;
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), t);
            return t;
        }

        /// <summary>IPasswordBox: masked entry of its Password.</summary>
        public static FrameworkElement PasswordBox(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new PasswordBox { Password = Rows.Text(p.GetValueOrDefault("Password")), VerticalContentAlignment = VerticalAlignment.Center };
            Font(t, p.GetValueOrDefault("Font"));
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), t);
            return t;
        }

        /// <summary>ITextArea: multi-line entry of its Text.</summary>
        public static FrameworkElement TextArea(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new TextBox { Text = Rows.Text(p.GetValueOrDefault("Text")), AcceptsReturn = true, TextWrapping = TextWrapping.Wrap,
                                  VerticalScrollBarVisibility = ScrollBarVisibility.Auto };
            Font(t, p.GetValueOrDefault("Font"));
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), t);
            return t;
        }

        /// <summary>IDatePicker: WPF's own, its Date when there is one.</summary>
        public static FrameworkElement DatePicker(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var d = new DatePicker { SelectedDateFormat = DatePickerFormat.Short };
            if (DateTime.TryParseExact(Rows.Text(p.GetValueOrDefault("Date")), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                                       DateTimeStyles.None, out var when))
                d.SelectedDate = when;
            Font(d, p.GetValueOrDefault("Font"));
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), d);
            return d;
        }

        /// <summary>ITimePicker: WPF has none of its own, so a text box holding HH:mm.</summary>
        public static FrameworkElement TimePicker(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new TextBox { Text = Rows.Text(p.GetValueOrDefault("Time")), ToolTip = "HH:mm", VerticalContentAlignment = VerticalAlignment.Center };
            Font(t, p.GetValueOrDefault("Font"));
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), t);
            return t;
        }

        /// <summary>ISelectList: its SelectedItem among its Items, nothing chosen first.</summary>
        public static FrameworkElement SelectList(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var c = new ComboBox { VerticalContentAlignment = VerticalAlignment.Center };
            c.Items.Add("");
            if (p.GetValueOrDefault("Items") is object[] items)
                foreach (var i in items) c.Items.Add(Rows.Text(i));
            var selected = Rows.Text(p.GetValueOrDefault("SelectedItem"));
            c.SelectedItem = c.Items.Contains(selected) ? selected : "";
            Font(c, p.GetValueOrDefault("Font"));
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), c);
            return c;
        }

        /// <summary>ISwitch: on when its Value is true.</summary>
        public static FrameworkElement Switch(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var c = new CheckBox { IsChecked = "true".Equals(Rows.Text(p.GetValueOrDefault("Value"))) || true.Equals(p.GetValueOrDefault("Value")),
                                   VerticalAlignment = VerticalAlignment.Center };
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), c);
            return c;
        }

        /// <summary>ISlider: its Value between MinValue and MaxValue.</summary>
        public static FrameworkElement Slider(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            double min = Rows.Num(p.GetValueOrDefault("MinValue")), max = Math.Max(min, Rows.Num(p.GetValueOrDefault("MaxValue")));
            var s = new Slider { Minimum = min, Maximum = max, Value = Math.Max(min, Math.Min(max, Rows.Num(p.GetValueOrDefault("Value")))),
                                 VerticalAlignment = VerticalAlignment.Center };
            pane?.Submit(p.GetValueOrDefault("SubmitKey"), s);
            return s;
        }

        /// <summary>IImage: the image at its FilePath, scaled into its rectangle.</summary>
        public static FrameworkElement Image(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var i = new WpfImage { Stretch = Stretch.Uniform };
            var path = Rows.Text(p.GetValueOrDefault("FilePath"));
            if (path.Length > 0 && System.IO.File.Exists(path))
                i.Source = new BitmapImage(new Uri(System.IO.Path.GetFullPath(path)));
            return i;
        }

        /// <summary>IButton: its Title, following its NavigationLink.</summary>
        public static FrameworkElement Button(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var b = new WpfButton { Content = Rows.Text(p.GetValueOrDefault("Title")) };
            Font(b, p.GetValueOrDefault("Font"));
            var fg = BrushOf(p.GetValueOrDefault("ForegroundColor"));
            if (fg != null) b.Foreground = fg;
            var link = p.GetValueOrDefault("NavigationLink");
            b.Click += (s, e) => Follow(link, pane);
            return b;
        }

        /// <summary>IMenu: the view's Buttons, drawn in its chrome.</summary>
        public static FrameworkElement Menu(object[] row, Pane pane)
        {
            var m = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right };
            if (Rows.Props(row).GetValueOrDefault("Buttons") is object[] buttons)
                foreach (var b in buttons)
                    if (b is object[] br) m.Children.Add(Draw(br, pane));
            return m;
        }

        /// <summary>IMenuButton: one action; a Submit sends the view's values with its link, as IListView.Submit does.</summary>
        public static FrameworkElement MenuButton(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var b = new WpfButton { Content = Rows.Text(p.GetValueOrDefault("Title")), Padding = new Thickness(8, 2, 8, 2), Margin = new Thickness(6, 0, 0, 0) };
            var link = p.GetValueOrDefault("NavigationLink");
            var submit = "Submit".Equals(p.GetValueOrDefault("Action"));
            b.Click += (s, e) =>
            {
                if (submit && pane != null && Rows.NonEmpty(link)) Follow(Rows.Concat(link, pane.SubmissionValues()), pane);
                else Follow(link, pane);
            };
            return b;
        }

        /// <summary>ISearchBox: its Placeholder and Text; a search follows its NavigationLink with the text appended.</summary>
        public static FrameworkElement SearchBox(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new TextBox { Text = Rows.Text(p.GetValueOrDefault("Text")), VerticalContentAlignment = VerticalAlignment.Center, MinHeight = 24 };
            var placeholder = new TextBlock { Text = Rows.Text(p.GetValueOrDefault("Placeholder")), Foreground = Brushes.Gray,
                                              Margin = new Thickness(5, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center, IsHitTestVisible = false };
            placeholder.Visibility = t.Text.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
            t.TextChanged += (s, e) => placeholder.Visibility = t.Text.Length == 0 ? Visibility.Visible : Visibility.Collapsed;
            var link = p.GetValueOrDefault("NavigationLink");
            t.KeyDown += (s, e) =>
            {
                if (e.Key == Key.Enter) Follow(Rows.Concat(link, new List<object> { t.Text }), pane);
            };
            var g = new Grid();
            g.Children.Add(t);
            g.Children.Add(placeholder);
            return g;
        }

        /// <summary>IAlert: a Title and a Message over the screen.</summary>
        public static FrameworkElement Alert(object[] row, Pane pane)
        {
            var p = Rows.Props(row);
            var t = new TextBlock { TextWrapping = TextWrapping.Wrap };
            t.Inlines.Add(new System.Windows.Documents.Run(Rows.Text(p.GetValueOrDefault("Title"))) { FontWeight = FontWeights.Bold });
            t.Inlines.Add(new System.Windows.Documents.Run("  " + Rows.Text(p.GetValueOrDefault("Message"))));
            return new Border { Child = t, Padding = new Thickness(16, 8, 16, 8),
                                Background = new SolidColorBrush(Color.FromRgb(0xFF, 0xF4, 0xE5)) };
        }
    }

    /// <summary>A placed row as lambda answers it: kind, x, y, w, h, properties; or kind, properties.</summary>
    public static class Rows
    {
        public static string KindOf(object[] row) => row.Length > 0 && row[0] is string s ? s : "";

        /// <summary>A row's properties by member: sixth on a placed row, second on an unplaced one.</summary>
        public static Dictionary<string, object> Props(object[] row)
        {
            var out_ = new Dictionary<string, object>();
            var list = row.Length >= 6 ? row[5] : row.Length >= 2 ? row[1] : null;
            if (list is object[] pairs)
                foreach (var pair in pairs)
                    if (pair is object[] pv && pv.Length >= 2 && pv[0] is string m) out_[m] = pv[1];
            return out_;
        }

        public static double Num(object n) => n switch
        {
            int i => i,
            long l => l,
            double d => d,
            string s when double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var d2) => d2,
            _ => 0,
        };

        public static string Text(object v) => v switch
        {
            string s => s,
            int or long or double => Convert.ToString(v, CultureInfo.InvariantCulture),
            _ => "",
        };

        public static bool NonEmpty(object v) => v is object[] a && a.Length > 0;

        public static object[] Concat(object link, List<object> more)
        {
            var all = new List<object>();
            if (link is object[] a) all.AddRange(a);
            all.AddRange(more);
            return all.ToArray();
        }
    }

    /// <summary>
    /// THE LAYOUT ENGINE, render:wpf: a screen's placed rows to its WPF view. Lambda decided every
    /// position (ui:arrange) and every color and font (each row's members), so this takes the
    /// first row, the view, as the container and puts every other row's element on its Canvas at
    /// the rectangle lambda gave it, a later row above an earlier one -- the absolutely placed
    /// rectangles iFactr's Canvas layout engine took.
    /// </summary>
    public static class Screen
    {
        public static FrameworkElement Draw(object[] placed, Pane pane)
        {
            var view = placed.OfType<object[]>().FirstOrDefault(r => Rows.KindOf(r) == "listview")
                       ?? new object[] { "listview", 0, 0, 0, 0, new object[0] };
            var v = (Controls.View)Registry.Widgets["render:listview"](view, pane);
            foreach (var r in placed.OfType<object[]>())
                if (!ReferenceEquals(r, view)) v.Content.Children.Add(Controls.Draw(r, pane));
            return v;
        }
    }
}
