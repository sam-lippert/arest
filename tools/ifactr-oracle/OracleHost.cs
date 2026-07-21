using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using iFactr.Core;
using iFactr.Core.Targets;
using iFactr.Core.Layers;
using iFactr.Core.Controls;
using iFactr.UI;
using iFactr.Wpf;
using MonoCross.Navigation;

// THE RENDERING ORACLE: old-school iFactr as a thin renderer of AREST
// hypermedia. The shipped WpfFactory (Distribution DLLs) renders an
// iLayer whose items are built FROM THE CANON STORE - each iItem's link
// IS a canon address (Thm 2's controls) - so the framework's own
// rendering stands beside the canon-placed rendering as the reference.
// the pane split mirrors ui:prefpane's rule: lists master, content detail
public class MasterArestLayer : ArestLayer, iFactr.Core.Layers.IMasterLayer { }

public class OracleApp : iApp
{
    public override void OnAppLoad()
    {
        Title = "arest ifactr oracle";
        FormFactor = iFactr.Core.FormFactor.SplitView;
        var master = new MasterArestLayer();
        var detail = new ArestLayer();
        NavigationMap.Add("", master);
        NavigationMap.Add("fire/{e}/{g}/{i}", detail);
        NavigationMap.Add("{a}", master);
        NavigationMap.Add("{a}/{b}", detail);
        NavigationMap.Add("{a}/{b}/{c}", detail);
        NavigateOnLoad = "";
    }
}

public static class OracleHost
{
    public static object[] Store;

    [STAThread]
    public static void Main()
    {
        Arest.Load();
        Arest.LoadCarriers();
        Store = Arest.CELLS.ToArray();

        var app = new Application();
        var win = new Window();
        win.Title = "ifactr oracle";
        win.Width = 700;
        win.Height = 700;
        app.MainWindow = win;
        win.Show();

        WpfFactory.Initialize();
        win.Content = WpfFactory.Instance.MainWindow;
        TargetFactory.Initialize(WpfFactory.Instance, new OracleApp());
        Arest.Register("clock", x =>
            System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                .ToString(System.Globalization.CultureInfo.InvariantCulture));
        // the storage surface: the one durable write, and nothing else
        Arest.Register("store:append", x =>
        {
            var p = (object[])x;
            System.IO.File.AppendAllText(
                System.IO.Path.Combine("..", "..", "apps", "sherlock", (string)p[0]),
                (string)p[1]);
            return "T";
        });
        win.Dispatcher.BeginInvoke(new Action(() => iApp.Navigate("")));
        // browse the FIXED store: derive once (async), swap when done
        new System.Threading.Thread(() =>
        {
            var fixedStore = (object[])Arest.Ev("ui:boot", Store);
            win.Dispatcher.BeginInvoke(new Action(() =>
            {
                Store = fixedStore;
                iApp.Navigate("");
            }));
        }).Start();
        app.Run(win);
    }
}
