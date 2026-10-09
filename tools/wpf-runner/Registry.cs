using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;

namespace Arest.Wpf
{
    // THE PAIRING TABLE FOR WPF (#124, 2026-10-02). Sam, 2026-09-21: "the
    // correct way to render html or any other ui is to register the widgets and
    // layout engines and resolve them to mirror the idealized agnostic paired ui
    // controls"; 2026-10-01: the idealized controls are the MonoView and iFactr
    // interfaces, and there should be a WPF registration in C# the way there is
    // a React one for the web. This is that registration, iFactr-WPF's
    // WpfFactory.OnSetDefinitions over lambda's names: render:<kind> for each
    // interface lambda places (metamodel/resolution.md), bound to Toolkit 'wpf'
    // at the class it names (readings/ui/components.md), and the layout engine
    // render:wpf, the platform's Render Target (render-target-instances.md).
    //
    // THE PAIRING LAW IS NOT RESTATED HERE: each navigate request carries these
    // names and lambda answers ui:unpaired over them.
    public static class Registry
    {
        public const string Toolkit = "wpf";
        public const string LayoutEngine = "render:wpf";

        public static readonly string[] ControlKinds =
        {
            "listview", "sectionheader", "gridcell", "label", "richcontentcell", "textbox",
            "passwordbox", "textarea", "datepicker", "timepicker", "selectlist", "switch",
            "slider", "image", "button", "menu", "menubutton", "searchbox", "alert",
        };

        /// <summary>register(control, impl) IS the pairing (iFactr's IPairable): a row to its element.</summary>
        public delegate FrameworkElement Widget(object[] row, Pane pane);

        public static readonly Dictionary<string, Widget> Widgets = new Dictionary<string, Widget>
        {
            ["render:listview"] = Controls.ListView,
            ["render:sectionheader"] = Controls.SectionHeader,
            ["render:gridcell"] = Controls.GridCell,
            ["render:label"] = Controls.Label,
            ["render:richcontentcell"] = Controls.RichContentCell,
            ["render:textbox"] = Controls.TextBox,
            ["render:passwordbox"] = Controls.PasswordBox,
            ["render:textarea"] = Controls.TextArea,
            ["render:datepicker"] = Controls.DatePicker,
            ["render:timepicker"] = Controls.TimePicker,
            ["render:selectlist"] = Controls.SelectList,
            ["render:switch"] = Controls.Switch,
            ["render:slider"] = Controls.Slider,
            ["render:image"] = Controls.Image,
            ["render:button"] = Controls.Button,
            ["render:menu"] = Controls.Menu,
            ["render:menubutton"] = Controls.MenuButton,
            ["render:searchbox"] = Controls.SearchBox,
            ["render:alert"] = Controls.Alert,
        };

        static Registry()
        {
            // the table cannot drift from the list: a kind with no widget refuses here, at load
            var missing = ControlKinds.Where(k => !Widgets.ContainsKey("render:" + k)).ToArray();
            if (missing.Length > 0)
                throw new InvalidOperationException("no widget paired to " + string.Join(", ", missing.Select(k => "render:" + k)));
        }

        /// <summary>Every name this container registers: the widgets, then the layout engine.</summary>
        public static List<string> RegisteredNames()
        {
            var names = ControlKinds.Select(k => "render:" + k).ToList();
            names.Add(LayoutEngine);
            return names;
        }

        static object[] Font(string family, int size, string formatting = "normal") => new object[] { family, size, formatting };
        static object[] Member(string name, object value) => new object[] { name, value };

        /// <summary>
        /// IPlatformDefaults, member by member: iFactr-WPF's own (UIBuilder/PlatformDefaults.cs) --
        /// its margins and spacings, a CellHeight of 48, and Segoe UI at 12 and 11 points, so lambda
        /// places and measures this platform's screen and the rows carry these fonts.
        /// </summary>
        public static object[] PlatformDefaults() => new object[]
        {
            Member("LeftMargin", 8), Member("RightMargin", 8), Member("TopMargin", 8), Member("BottomMargin", 8),
            Member("LargeHorizontalSpacing", 10), Member("SmallHorizontalSpacing", 4),
            Member("LargeVerticalSpacing", 10), Member("SmallVerticalSpacing", 4),
            Member("CellHeight", 48),
            Member("ButtonFont", Font("Segoe UI", 12)),
            Member("DateTimePickerFont", Font("Segoe UI", 12)),
            Member("HeaderFont", Font("Segoe UI", 12)),
            Member("LabelFont", Font("Segoe UI", 12)),
            Member("MessageBodyFont", Font("Segoe UI", 11)),
            Member("MessageTitleFont", Font("Segoe UI", 12)),
            Member("SectionHeaderFont", Font("Segoe UI", 12)),
            Member("SectionFooterFont", Font("Segoe UI", 11)),
            Member("SelectListFont", Font("Segoe UI", 12)),
            Member("SmallFont", Font("Segoe UI", 11)),
            Member("TabFont", Font("Segoe UI", 11)),
            Member("TextBoxFont", Font("Segoe UI", 12)),
            Member("ValueFont", Font("Segoe UI", 12)),
        };
    }
}
