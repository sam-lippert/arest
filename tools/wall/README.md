# tools/wall

Scripts that DRIVE, canon that JUDGES. Nothing here holds law semantics;
every verdict printed is a canon evaluation's own atom.

"the wall" was a name for `stations.sh` that grew here and nowhere else --
it does not appear in AREST.tex. The script is gone; the gate is a test.

    python -m pytest engine/tests/test_stations.py    # THE GATE: cases + laws,
                                                      # four stations, delta-selected
    AREST_STATIONS_FULL=1 python -m pytest engine/tests/test_stations.py   # merges
    npm run build && bun composed.g.js            # base laws (js-runner)
    dotnet run                                    # the same, cs station
    sh continuity.sh [app]                        # the two-boot law

## The standing pieces

- **The stations gate** (`engine/tests/test_stations.py`) — compose the
  same canon and carriers per station, evaluate every case and `law:report`
  on each, and hold the printed atoms byte-identical. Still a canon
  evaluation rather than host test code: a law is a canon DEF and pytest
  only drives and compares. Selected by `stationdelta.py` so an edit runs
  only the cases whose reachable DEFs changed -- 3.5s when nothing did.
  All three stations are green and agree to the byte (2026-08-06): 53
  laws each, md5 `1219ce08…`, 1664 bytes, exit 0 — js 49.7s, java 29.7s,
  cs 80.1s. They were not: java and cs each ran past 20 minutes without
  finishing, because their heads lacked BOTH of the js head's evaluator
  optimizations (the pure-application memo and FASTPRIMS' 14 compiled
  `theta:` cells). Controls on the js station showed each is necessary
  and neither sufficient — memo off, zero laws in 120s; FASTPRIMS off,
  zero laws in 300s. Both are now ported to `Arest.java` and `Mu.cs`, and
  byte-identity is exactly what certifies them as extensional equals of
  the DEFs rather than as semantics. `AREST_STATIONS` narrows the set; a
  station that is missing prints SKIPPED, never a pass.
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
