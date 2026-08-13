;
// The shared case table follows as its OWN CANON(...) call. It has to be a
// separate call: two tuple literals written next to each other read as a
// function call in JS, not as two arguments.
//
// The table rides in the SAME binary as the laws rather than a second
// composition, because the case cells do not disturb law:report — the base
// report is byte-identical with and without them (md5 1219ce08..., 53 laws).
// One binary answers both `law:report` (no argv) and `case <name>`, which
// matters most for the stations whose compile is minutes, not seconds.
CANON
