# cs-runner — the composed checker, C# station

The laws are canon DEFs (the `law:` family in `arest`), never host code.
Two js runners died of accretion; this host is built to make accretion
structurally awkward: the compose step is `copy /b` inside the csproj
(byte concatenation, the linker's job — no compose tool exists), the
canon and the carriers appear AS SOURCE in the generated Composed.g.cs
and are COMPILED, and the exe is then just exec'd — nothing is read,
evaled, or interpreted by host code at runtime. Compilation is the
strictest reader the canon has met: on its first run the C# mu exposed
two latent canon defects the lenient js mu had masked by coercion
(a selector into an atom answering the character "F", and ins_asc
"sorting" stringified arrays) — cross-host parity as a standing
property of having a second, stricter station.

    dotnet run                      # compose+compile+exec; law:report (20 laws), exit 0 iff all T
    dotnet build -p:App=order && dotnet run --no-build -- app
                                    # the app's carriers; law:app_report (10 laws)

The host is exactly what the doctrine allows and will not grow: the
registration vocabulary (DEF — a duplicate name throws by collection
semantics; law:one_name is the law — plus A/N/K/PHI/S1..S9 and CANON,
the varargs wrap that turns the canon's tuple literal into a compiled
call), the mu (atoms through DEFS then the primitives, numbers as
selectors — STRICT: a selector on an atom throws, out-of-domain
application is a defect, never a character — and the seven forms), the
base primitives of Backus 11.2.3 with the registered boundary rows of
resolution.md, and a main that applies the report and prints. No
fallback lists, no guards, no comparison logic; a failure is localized
by a probe you write when you need it and delete when you're done.
