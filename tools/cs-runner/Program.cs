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
        // READ, not compiled in. The csproj concatenated the canon, the case
        // table and the carriers into Composed.g.cs and the C# compiler took
        // the lot on every canon edit; js, java and rust-station read the same
        // bytes at runtime and this is the fourth. Order is unchanged: canon,
        // carriers, then the case table, exactly as the copy /b had it.
        Reader.Load(Reader.Path("AREST_CANON", "../../arest"));
        Reader.Load(Reader.Path("AREST_DESIGN_STATE", "../norma-oracle/design-state"));
        Reader.Load(Reader.Path("AREST_NORMA_ANSWER", "../norma-oracle/norma-answer"));
        Reader.Load(Reader.Path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon"));
        // THE CARRIERS THE OTHER HOST READS. js-runner/build.js splices the
        // compiled relational map when its stamp matches the design-state it
        // was compiled from, the outcome carrier when the oracle wrote one, and
        // the journal; this host read none of the three, so the two hosts held
        // different stores before either evaluated a thing.
        Reader.LoadCompiled(Reader.Path("AREST_COMPILED", "../norma-oracle/compiled"),
                            Reader.Path("AREST_DESIGN_STATE", "../norma-oracle/design-state"));
        Reader.LoadOptional(Reader.Path("AREST_OUTCOME", "../norma-oracle/outcome"));
        // AND THE STORE IS BOOTED, not merely read: FILE projected, the
        // meta-types reflected, the closure taken. No journal is folded.
        Arest.Boot();
        var outp = (object[])Arest.Ev("main", new object[] { Arest.CELLS.ToArray(), args.Cast<object>().ToArray() });
        Console.Out.Write((string)outp[0]);
        Console.Out.Write((char)10);
        return "T".Equals(outp[1]) ? 0 : 1;
    }
}
