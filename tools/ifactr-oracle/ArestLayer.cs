using System;
using System.Collections.Generic;
using System.Linq;
using iFactr.Core;
using iFactr.Core.Layers;
using iFactr.Core.Controls;

// THE GENERIC AREST LAYER: old-school iFactr as a thin hypermedia
// client. One layer class serves EVERY canon address - the navigated
// URI is the address, ui:screen's tree becomes iMenus of iItems, and
// each item's Link IS the canon address (Thm 2's controls carried as
// the framework's own hypermedia). A fire address applies its event
// through ui:apply before rendering - controller.Load mutating the
// model and outputting a perspective, MonoCross's own semantics. The
// framework supplies navigation, panes, and history; the canon
// supplies everything else.
public class ArestLayer : iLayer
{
    static object[] Split(string uri)
    {
        if (string.IsNullOrEmpty(uri)) return new object[0];
        return uri.Split('/').Cast<object>().ToArray();
    }

    static string Join(object[] addr)
    {
        return string.Join("/", addr.Select(a => a.ToString()));
    }

    public override void Load(string navigatedUri, Dictionary<string, string> parameters)
    {
        object[] addr = Split(navigatedUri);
        Console.Out.Write("layer load: [" + (navigatedUri ?? "<null>") + "]" + (char)10);

        if (addr.Length > 0 && "fire".Equals(addr[0]))
        {
            // state transfer: apply the event, then render its entity
            try
            {
                var r = (object[])Arest.Ev("ui:applye",
                    new object[] { OracleHost.Store, addr });
                OracleHost.Store = (object[])r[1];
                addr = (object[])r[0];
                Console.Out.Write("fired; status in answer: "
                    + Arest.Ev("ui:status", new object[] {
                        r[1], "Case", "The Speckled Band" }) + (char)10);
            }
            catch (Exception ex)
            {
                Console.Out.Write("FIRE FAILED: " + ex.Message + (char)10);
                throw;
            }
        }

        // the framework owns navigation history; the canon's back slot
        // stays empty and iFactr's own stacks supply the back chrome
        var tree = (object[])Arest.Ev("ui:screen",
            new object[] { OracleHost.Store, addr, new object[0] });

        Title = tree[1].ToString();
        Items.Clear();
        // the flat tree: <layer, title, back, sec...>
        foreach (object secRow in tree.Skip(3))
        {
            var sec = (object[])secRow;
            if ("menu".Equals(sec[0]))
            {
                var menu = new iMenu(sec[1].ToString());
                foreach (object itemRow in sec.Skip(2))
                {
                    var it = (object[])itemRow;
                    string text = it[1].ToString();
                    var linkAddr = it[3] as object[];
                    var item = (linkAddr != null && linkAddr.Length > 0)
                        ? new iItem(Join(linkAddr), text)
                        : new iItem { Text = text };
                    var sub = it[2] as object[];
                    if (sub == null) item.Subtext = it[2].ToString();
                    menu.Add(item);
                }
                Items.Add(menu);
            }
            else
            {
                var panel = new iPanel("");
                panel.Text = string.Join(" ",
                    sec.Skip(1).Select(x => x is object[] ? "" : x.ToString()));
                Items.Add(panel);
            }
        }
    }
}
