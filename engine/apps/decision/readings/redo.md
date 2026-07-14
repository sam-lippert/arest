# Redo-vs-continue for the AREST engine, dogfooded THROUGH AREST as a
# Kepner-Tregoe decision. Atomic facts only, no prose. The hard MUSTs are the
# filter: AREST DERIVES which options are eliminated (an option is eliminated
# iff it fails some must) and which survive; weighted WANTs score them. The
# judgment is DERIVED, not asserted. The same fact types model any decision.

## Entity Types

Option(.name) is an entity type.
Must(.name) is an entity type.
Want(.name) is an entity type.

## Value Types

Weight is a value type.
Score is a value type.

## Readings

Option is under consideration.
Option fails Must.

Option is eliminated.
* Option is eliminated iff that Option fails some Must.

Option is viable.
* Option is viable iff that Option is under consideration and that Option is not eliminated.

Want carries Weight.
Option rates Want at Score.

Option totals Score.
Option totals Score2 if Option rates some Want at Score and Score2 is the sum of Score.

## Facts — the options under consideration

Option 'full-redo' is under consideration.
Option 'targeted-rebuild' is under consideration.
Option 'naive-continue' is under consideration.

## Facts — the hard requirements each option fails (Kepner-Tregoe musts)

# M1 preserve-certified-canon: keep the rho-fidelity-certified core (336/353 DEFs pure)
# M2 address-drift-root: fix host-carried meaning + the process false-confidence
# M3 converge-feasibly: no open-ended multi-month rebuild that risks re-drift
Option 'full-redo' fails Must 'preserve-certified-canon'.
Option 'full-redo' fails Must 'converge-feasibly'.
Option 'naive-continue' fails Must 'address-drift-root'.

## Facts — the weighted objectives (Kepner-Tregoe wants)

Want 'time-to-value' carries Weight '8'.
Want 'low-risk' carries Weight '9'.
Want 'doctrine-alignment' carries Weight '7'.
Want 'preserves-verified-work' carries Weight '8'.

Option 'full-redo' rates Want 'time-to-value' at Score '2'.
Option 'full-redo' rates Want 'low-risk' at Score '3'.
Option 'full-redo' rates Want 'doctrine-alignment' at Score '9'.
Option 'full-redo' rates Want 'preserves-verified-work' at Score '2'.

Option 'targeted-rebuild' rates Want 'time-to-value' at Score '7'.
Option 'targeted-rebuild' rates Want 'low-risk' at Score '7'.
Option 'targeted-rebuild' rates Want 'doctrine-alignment' at Score '8'.
Option 'targeted-rebuild' rates Want 'preserves-verified-work' at Score '9'.

Option 'naive-continue' rates Want 'time-to-value' at Score '9'.
Option 'naive-continue' rates Want 'low-risk' at Score '6'.
Option 'naive-continue' rates Want 'doctrine-alignment' at Score '3'.
Option 'naive-continue' rates Want 'preserves-verified-work' at Score '8'.
