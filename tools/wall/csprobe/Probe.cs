using System;
using System.Linq;
using System.Text;

public static class Probe
{
    static string Show(object x)
    {
        var a = x as object[];
        if (a == null) return "" + x;
        return "[" + string.Join(",", a.Select(Show)) + "]";
    }
    public static void Main()
    {
        Arest.Load();
        Arest.LoadCarriers();
        var store = Arest.CELLS.ToArray();
        object phi = new object[0];
        object wback = new object[] { new object[] { "back" } };
        object[][] battery = {
            new object[] { phi, phi },
            new object[] { new object[] { "Case" }, wback },
            new object[] { new object[] { "Case", "The Speckled Band" }, wback },
            new object[] { new object[] { "HypothesisContradictsHypothesis" }, wback },
        };
        var sb = new StringBuilder();
        foreach (var b in battery)
        {
            object tree = Arest.Ev("ui:screen", new object[] { store, b[0], b[1] });
            object placed = Arest.Ev("ui:arrange", new object[] { tree, 960 });
            sb.Append(Show(placed)).Append((char)10);
        }
        // the storage bytes join the battery: same fires, same journal bytes
        sb.Append(Arest.Ev("ui:jentry", new object[] { 1,
            new object[] { "fire", "Case is observed", "Case", "The Speckled Band" } })).Append((char)10);
        sb.Append(Arest.Ev("ui:jentry", new object[] { 42,
            new object[] { "submit", "Case", "va\"l\\ue" } })).Append((char)10);
        sb.Append(Arest.Ev("ui:jentry", new object[] { 3,
            new object[] { "retract", "journal:1" } })).Append((char)10);
        sb.Append(Arest.Ev("ui:st", new object[] {
            new object[] { "nested", "row" }, "atom" })).Append((char)10);
        sb.Append(Show(Arest.Ev("ui:removefirst", new object[] {
            new object[] { new object[] { "a" }, new object[] { "b" }, new object[] { "a" } },
            new object[] { "a" } }))).Append((char)10);
        // the grid engine's star weights ride the battery
        sb.Append(Show(Arest.Ev("ui:colw", new object[] {
            new object[] { new object[] { "abs", 100 }, new object[] { "star", 1 }, new object[] { "star", 3 } },
            500 }))).Append((char)10);
        sb.Append(Show(Arest.Ev("ui:colw", new object[] {
            new object[] { new object[] { "abs", 100 }, new object[] { "star", 1 }, new object[] { "star", 3 } },
            502 }))).Append((char)10);
        sb.Append(Show(Arest.Ev("ui:colw", new object[] {
            new object[] { new object[] { "abs", 60 }, new object[] { "abs", 40 } },
            500 }))).Append((char)10);
        sb.Append(Show(new object[] {
            Arest.Ev("/", new object[] { 7, 2 }),
            Arest.Ev("/", new object[] { -7, 2 }),
            Arest.Ev("*", new object[] { 6, 7 }) })).Append((char)10);
        Console.Out.Write(sb.ToString());
    }
}
