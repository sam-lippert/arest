// Same-bytes native execution for the C# host. The spec: the compiler must
// tokenize the SAME raw shared/*.canon bytes CPython execs, rustc includes,
// and javac compiles -- no bespoke reader, no generation artifact on disk.
// So the raw canon bytes are wrapped IN MEMORY in a Canon-referencing CanonGen
// body and compiled by Roslyn; DEF's registration side effect populates
// Canon.Defs. This replaces the retired MSBuild WrapCanon target (whose
// Canon.g.cs was a generated artifact) and the StoreCanon JSON reader.
//
// Chunked into <=CHUNK-element T(...) calls: mirrors the Java host and keeps
// each method well under any IL-size ceiling. DEF's side effect makes the
// split invisible, exactly as the element bytes stay verbatim across hosts.
namespace Arestlam;

using System.Reflection;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

static class RoslynLoader
{
    const int CHUNK = 100;

    static string SharedPath(string name)
    {
        var env = Environment.GetEnvironmentVariable("AREST_SHARED");
        if (env != null) return Path.Combine(env, name);
        var dir = AppContext.BaseDirectory;
        for (var i = 0; i < 8 && dir != null; i++)
        {
            // The canonical name "arest.canon" is the REPO-ROOT canon, matching
            // python/canon.py and java/CanonLoader. engine/shared/arest.canon
            // was the abandoned 360-def predecessor of the root canon's 1155;
            // loading it meant this host ran a different canon under one name.
            // UNVERIFIED: no build run.
            if (name == "arest.canon")
            {
                var rootCanon = Path.Combine(dir, "arest");
                if (File.Exists(rootCanon)) return rootCanon;
            }
            var probe = Path.Combine(dir, "shared", name);
            if (File.Exists(probe)) return probe;
            dir = Path.GetDirectoryName(dir.TrimEnd(Path.DirectorySeparatorChar));
        }
        return Path.Combine("..", "shared", name);
    }

    // Top-level element substrings of ONE canon tuple literal, split only at
    // depth-0 commas outside double-quoted strings (\-escapes honoured). No
    // element's bytes are altered; the outer parens become the T(...) call's.
    // Mirrors gen_canon.py.top_level_elements and CanonLoader.topLevelElements.
    static List<string> TopLevelElements(string text)
    {
        var s = text.Trim();
        if (s.Length < 2 || s[0] != '(' || s[^1] != ')')
            throw new Exception("not a tuple literal");
        var inner = s.Substring(1, s.Length - 2);
        var elems = new List<string>();
        int depth = 0, start = 0;
        bool instr = false, esc = false;
        for (int i = 0; i < inner.Length; i++)
        {
            char ch = inner[i];
            if (instr)
            {
                if (esc) esc = false;
                else if (ch == '\\') esc = true;
                else if (ch == '"') instr = false;
                continue;
            }
            if (ch == '"') instr = true;
            else if (ch == '(') depth++;
            else if (ch == ')') depth--;
            else if (ch == ',' && depth == 0)
            {
                elems.Add(inner.Substring(start, i - start));
                start = i + 1;
            }
        }
        elems.Add(inner.Substring(start));
        return elems;
    }

    static void EmitChunked(StringBuilder b, string name, List<string> elems)
    {
        int n = elems.Count, chunks = (n + CHUNK - 1) / CHUNK;
        b.Append("  public static void ").Append(name).Append("() {\n");
        for (int k = 0; k < chunks; k++)
            b.Append("    ").Append(name).Append('_').Append(k).Append("();\n");
        b.Append("  }\n");
        for (int k = 0; k < chunks; k++)
        {
            b.Append("  static void ").Append(name).Append('_').Append(k).Append("() { T(");
            int lo = k * CHUNK, hi = Math.Min(n, lo + CHUNK);
            for (int i = lo; i < hi; i++)
            {
                if (i > lo) b.Append(',');
                b.Append(elems[i]);
            }
            b.Append("); }\n");
        }
    }

    static string GenSource()
    {
        var b = new StringBuilder();
        b.Append("using static Arestlam.Canon;\n");
        b.Append("namespace Arestlam { static class CanonGen {\n");
        EmitChunked(b, "LoadArest", TopLevelElements(File.ReadAllText(SharedPath("arest.canon"))));
        EmitChunked(b, "LoadScenarios", TopLevelElements(File.ReadAllText(SharedPath("scenarios.canon"))));
        b.Append("} }\n");
        return b.ToString();
    }

    static Type _gen;

    static Type Gen()
    {
        if (_gen != null) return _gen;
        var tree = CSharpSyntaxTree.ParseText(GenSource());
        // the trusted platform assemblies carry System.Runtime et al; arest.dll
        // itself carries Arestlam.Canon (the vocabulary CanonGen calls)
        var refs = ((string)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES"))
            .Split(Path.PathSeparator)
            .Where(p => p.Length > 0)
            .Select(p => (MetadataReference)MetadataReference.CreateFromFile(p))
            .ToList();
        refs.Add(MetadataReference.CreateFromFile(typeof(Canon).Assembly.Location));
        var comp = CSharpCompilation.Create(
            "CanonGen_" + Guid.NewGuid().ToString("N"),
            new[] { tree }, refs,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        using var ms = new MemoryStream();
        var res = comp.Emit(ms);
        if (!res.Success)
        {
            var errs = string.Join("\n", res.Diagnostics
                .Where(d => d.Severity == DiagnosticSeverity.Error));
            throw new Exception("canon in-memory compile failed:\n" + errs);
        }
        _gen = Assembly.Load(ms.ToArray()).GetType("Arestlam.CanonGen");
        return _gen;
    }

    static List<KeyValuePair<string, object>> LoadVia(string method)
    {
        Canon.Defs.Clear();
        Gen().GetMethod(method).Invoke(null, null);
        return new List<KeyValuePair<string, object>>(Canon.Defs);
    }

    internal static List<KeyValuePair<string, object>> LoadAll() => LoadVia("LoadArest");

    internal static List<KeyValuePair<string, object>> LoadScenarioDefs()
        => LoadVia("LoadScenarios");
}
