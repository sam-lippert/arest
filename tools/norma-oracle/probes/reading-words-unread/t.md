# Reading words must be read

# Two fact types over the SAME players whose readings differ by one predicate
# word, and a sentence whose words match neither of them.
#
# MapInstanceFact compared the sentence's collapsed predicate words against
# FactIndexEntry.ReadingWords, which is the reading with its {n} placeholders
# replaced by single spaces -- so "{0} has {1} for {2}" carried a RUN of spaces
# and could never equal a collapsed sentence. For any reading of two or more
# roles that comparison never succeeded, and every sentence was decided by the
# fallback instead: the sole player-signature-compatible entry, whatever it
# said. One candidate therefore accepted anything, and two candidates dropped
# everything -- so 'has Blob' and 'has Spare Blob' swallowed each other and
# both populations came back empty, while a lone fact type accepted the
# nonsense line below as one of its rows.

## Entity Types

Widget(.id) is an entity type.
Gizmo(.id) is an entity type.

## Value Types

Blob is a value type.

## Fact Types

Widget has Blob for Gizmo.
  Each Widget, Gizmo combination occurs at most once in the population of Widget has Blob for Gizmo.

Widget has Spare Blob for Gizmo.
  Each Widget, Gizmo combination occurs at most once in the population of Widget has Spare Blob for Gizmo.

## Instance Facts

Widget 'w1' has Blob '42' for Gizmo 'g1'.
Widget 'w1' has Spare Blob '43' for Gizmo 'g1'.
Widget 'w2' completely unrelated nonsense Blob '44' banana split Gizmo 'g2'.
