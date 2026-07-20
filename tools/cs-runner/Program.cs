using System;
using System.Linq;

// THE HOST CONTRACT, FINAL: convert argv to atoms, evaluate canon main,
// print the one text atom plus LF (never WriteLine, whose platform
// separator would break byte parity), exit by the flag. Six lines, no
// branches, forever. All dispatch and ALL rendering live in canon main:.
public static class Program
{
    public static int Main(string[] args)
    {
        Arest.Load();
        Arest.LoadCarriers();
        var outp = (object[])Arest.Ev("main", new object[] { Arest.CELLS.ToArray(), args.Cast<object>().ToArray() });
        Console.Out.Write((string)outp[0]);
        Console.Out.Write((char)10);
        return "T".Equals(outp[1]) ? 0 : 1;
    }
}
