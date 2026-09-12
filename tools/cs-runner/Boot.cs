using System;
using System.Collections.Generic;
using System.Linq;

// THE BOOT. A store is not the file it was read from. FILE is a projection of
// state:fts, the reflected meta-types are computed from the schema itself, and
// the derived populations are the closure under the program's own rules --
// three steps js-runner/host.js has taken for months and this host took none
// of. That is the whole of "the law golden is js-only": the two hosts were not
// disagreeing about an answer, they were answering over different stores.
//
// Every step here is the same canon call the js host makes, in the same order,
// under the same rule about the memo: CELLS is mutated, so MemoClear runs at
// each mutation point, because Ev keys on the store's identity and a store
// whose contents changed under the same reference would keep answering from
// the old one.
//
// Order is not free. FILE is what the population accessor reads, so it comes
// first; a reflected population is an INPUT a rule may read, so it comes before
// the closure; and the journal is folded last because its entries change
// state:fts, whose projection FILE then has to be rebuilt.
public static partial class Arest
{
    static object[] Cells() { return CELLS.ToArray(); }

    static string Name(object o) { return o as string ?? Convert.ToString(o); }

    static bool IsCellNamed(object c, string name)
    {
        var a = c as object[];
        return a != null && a.Length >= 2 && "CELL".Equals(a[0] as string) && name.Equals(Name(a[1]));
    }

    public static void Boot()
    {
        // A STORE WITH NO SCHEMA SURFACE has no FILE to build, nothing to
        // reflect and no rules to close under, and asking anyway throws.
        if ("#".Equals(Ev("ast:fetch", new object[] { "state:fts", Cells() }))) return;
        LoadFile();
        LoadReflected();
        LoadDerived();
    }

    static void LoadFile()
    {
        if (!"#".Equals(Ev("ast:fetch", new object[] { "FILE", Cells() }))) return;   // already carried
        var built = Seq(Ev("ast:File", Ev("store:state", Cells())));
        foreach (var cell in built) CELLS.Insert(0, cell);
        MemoClear();
    }

    // canon says WHICH meta-types are reflected: reflect:cells answers
    // <name, population> pairs computed from the schema, so adding one is a
    // canon edit and never a host edit. This function names nothing.
    static int LoadReflected()
    {
        int added = 0;
        foreach (var entry in Seq(Ev("reflect:cells", Cells())))
        {
            var e = Seq(entry);
            string name = Name(e[0]);
            var pop = e[1] as object[];
            if (pop == null || pop.Length == 0) continue;
            if (CELLS.Any(c => IsCellNamed(c, name))) continue;
            CELLS.Insert(0, new object[] { "CELL", name, e[1] });
            added++;
        }
        if (added > 0) MemoClear();
        return added;
    }

    // CARRIED MEANS HOLDING ROWS, AND CARRIED IS NOT COMPLETE. A derived head
    // is also a declared fact type, so "already declared" would skip every one
    // of them; and a SEMI-derived head may carry asserted rows that are a
    // PREFIX of what the rules derive, so presence is not enough either.
    // Compare lengths, and never carry an empty derived population: closing
    // under the whole program derives heads whose inputs are empty, and a cell
    // nothing can read is a name in the way.
    static int LoadDerived()
    {
        var carried = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var p in Seq(Ev("derive:store_pairs", Cells())))
        {
            var a = Seq(p);
            var rows = a[1] as object[];
            carried[Name(a[0])] = rows == null ? 0 : rows.Length;
        }
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var c in CELLS)
        {
            var a = c as object[];
            if (a != null && a.Length >= 2 && "CELL".Equals(a[0] as string)) seen.Add(Name(a[1]));
        }
        int added = 0;
        foreach (var entry in Seq(Ev("derive:closed", Cells())))
        {
            var e = Seq(entry);
            string name = Name(e[0]);
            if (seen.Contains(name)) continue;                  // already its own cell
            var rows = e[1] as object[];
            int have;
            carried.TryGetValue(name, out have);
            if (have >= (rows == null ? 0 : rows.Length)) continue;
            if (rows == null || rows.Length == 0) continue;
            CELLS.Insert(0, new object[] { "CELL", name, e[1] });
            added++;
        }
        if (added > 0) MemoClear();
        return added;
    }

    // NO JOURNAL FOLD. The journal is gone (Samuel, 2026-09-11): boot is FILE,
    // the reflected meta-types and the closure, and durability is the write into
    // the tables. ui:replay and the journal: cell prefix this recognised are not
    // in canon any more, so LoadJournal and IsJournalCell went with them.

    static void AdoptStore(object next)
    {
        var arr = next as object[];
        if (arr == null || arr.Length == 0) return;
        var copy = (object[])arr.Clone();
        CELLS.Clear();
        CELLS.AddRange(copy);
        MemoClear();
    }
}
