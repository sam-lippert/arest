# the wall

The certification harness — scripts that DRIVE, canon that JUDGES.
Nothing here holds law semantics; every verdict printed is a canon
evaluation's own atom.

    npm run build && bun composed.g.js            # base laws (js-runner)
    dotnet run                                    # the same, cs station
    sh continuity.sh [app]                        # the two-boot law

## The standing pieces

- **Law reports** — `bun composed.g.js [app|solve|explain]` per app,
  `dotnet run` / `java Program` on the same carriers: three strict μs,
  byte-identical printed atoms. A byte of drift is a broken wall.
- **The placed battery** (`placed-tail.part.js`, `csprobe/`) — the full
  placed lists for a screen battery plus the journal-entry bytes
  (`ui:jentry`, `ui:st`), evaluated on js and C#, compared byte for
  byte. This is the certification that a storage driver CANNOT drift:
  the bytes it appends are canon output, identical on every station.
- **The continuity law** (`continuity.sh`, `cont-tail.part.js`) — the
  two-boot property the one-boot laws cannot see: fire a transition,
  emit through the registered `store:append`, recompose from the
  carriers, and the status after reboot equals the status before —
  canon's `eq` is the judgment. Then a second fire across a second
  reboot proves the sequence numbering survives resumption. Runs on a
  scratch journal; the store of record is never touched by the wall.
