using System;
using System.Linq;

// THE HOST CONTRACT, a peer of tools/java-runner/Program.java and tools/js-runner/program.js: read lambda,
// the case table and the base, register the platform, and print what lambda's `main` answers over the cells
// and the command line, then LF (never WriteLine, whose platform separator would break byte parity), exiting
// by the flag. All dispatch, the boot included, and all text live in lambda; a new operation is a lambda edit,
// never a host edit.
//
//   dotnet run -- <address...>
public static class Program
{
    public static int Main(string[] args)
    {
        var lambda = Reader.Path("AREST_LAMBDA", "../../arest");
        Reader.Load(lambda);
        Reader.Load(Reader.Path("AREST_TESTS", "../../arest.tests"));
        Reader.Load(Reader.Path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon"));
        Reader.LoadBase(Reader.Path("AREST_CARRIERS", "../base"));
        Registrations.Register(lambda);
        var outp = Arest.Deep(() => Arest.Seq(Arest.Ev("main", new object[] { Arest.CELLS.ToArray(), args.Cast<object>().ToArray() })));
        Console.Out.Write(Arest.Show(outp[0]));
        Console.Out.Write((char)10);
        Console.Out.Flush();
        return "T".Equals(outp[1] as string) ? 0 : 1;
    }
}
