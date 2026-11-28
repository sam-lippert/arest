using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;

// The lambda laws over the booted base, one by one, a peer of tools/js-runner/laws.js: boot the store once
// (main:boot over the cells), apply each named law to it, and print its name, its answer and its time.
//
//   dotnet run --project laws -- <list-file | law...>
public static class Laws
{
    static void Canon(object x, System.Text.StringBuilder o)
    {
        if (x is object[] a) { o.Append("S("); for (int i = 0; i < a.Length; i++) { if (i > 0) o.Append(','); Canon(a[i], o); } o.Append(')'); return; }
        if (x is long n) { o.Append("N(").Append(n.ToString(System.Globalization.CultureInfo.InvariantCulture)).Append(')'); return; }
        o.Append("A(\"");
        foreach (var ch in Arest.Show(x))
            switch (ch)
            {
                case '\\': o.Append("\\\\"); break;
                case '"': o.Append("\\\""); break;
                case '\n': o.Append("\\n"); break;
                case '\r': o.Append("\\r"); break;
                case '\t': o.Append("\\t"); break;
                default: o.Append(ch); break;
            }
        o.Append("\")");
    }

    public static int Main(string[] args)
    {
        var lambda = Reader.Path("AREST_LAMBDA", "../../arest");
        Reader.Load(lambda);
        Reader.Load(Reader.Path("AREST_TESTS", "../../arest.tests"));
        Reader.Load(Reader.Path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon"));
        Reader.LoadBase(Reader.Path("AREST_CARRIERS", "../base"));
        Registrations.Register(lambda);

        // AREST_DUMP=<file>: every cell loaded, one "<name>\t<body>" a line in load order, in the canonical spelling
        // every host's law run writes, so two loads compare line for line. Nothing is booted.
        var dump = Reader.Path("AREST_DUMP", "");
        if (dump != "")
        {
            var sb = new System.Text.StringBuilder();
            foreach (var c in Arest.CELLS) { var cell = (object[])c; sb.Append(Arest.Show(cell[1])).Append('\t'); Canon(cell[2], sb); sb.Append('\n'); }
            File.WriteAllText(dump, sb.ToString(), new System.Text.UTF8Encoding(false));
            return 0;
        }
        var names = args.ToList();
        if (names.Count == 1 && File.Exists(names[0]))
            names = File.ReadAllLines(names[0]).Select(s => s.Trim()).Where(s => s != "").ToList();

        return Arest.Deep(() =>
        {
            var w = Stopwatch.StartNew();
            var store = Arest.Ev("main:boot", Arest.CELLS.ToArray());
            Console.WriteLine("boot " + w.ElapsedMilliseconds + " ms");
            int bad = 0;
            foreach (var l in names)
            {
                w.Restart();
                string r;
                try
                {
                    var o = Arest.Ev(l, store);
                    r = o is object[] a ? "SEQ " + a.Length : Arest.Show(o);
                }
                catch (Exception e)
                {
                    r = ("ERROR " + (e.Message ?? "").Replace('\n', ' '));
                    if (r.Length > 260) r = r.Substring(0, 260);
                }
                if (r != "T") bad++;
                Console.WriteLine(l + " " + r + " " + w.ElapsedMilliseconds + " ms");
            }
            Console.WriteLine(names.Count + " laws, " + bad + " not T");
            return bad == 0 ? 0 : 1;
        });
    }
}
