# A sum delivers when its over-column is typed as a number, and declines by name when it is not

Four of the rules share one body -- Bin holds Item, that Item has the column --
so nothing but the COLUMN and the FOLD separates them. Three of those emit
(`S4(A("sum"), ...)`, and the ternary with a `CONS` key under a `flat` and a
`proj` to put the total back where the head wants it); two decline, one for the
column's type and one for the fold. The fifth carries a THRESHOLD leg, which
pairs its literal on as a trailing column before the fold reads one: the key and
the summed column must still be the columns the join gave them, and a sum of the
wrong one is a wrong number rather than a missing one. INSERT(+) takes host
numbers, so an UNTYPED column is refused rather than emitted as a fold that
throws `+ on non-number` in the closure or, on a group of one row, silently
answers the text.

THE DECIMAL COLUMN MOVED FROM DECLINED TO DELIVERED on 2026-09-15, and the
reason it used to give is worth keeping visible because it named the right
defect in the wrong place: "a sum over a column typed decimal (Gram Weight): a
number stays an atom in the store and + throws on it". The second half was a
statement about the ORACLE'S OWN WRITING, not about `+` -- only an integer-typed
cell was written as a host number, so a decimal landed as text and any
arithmetic over it threw. Now a number-typed cell of either kind is written as
a number (one function, ICell, writes the fact row and the object type
population together, so the two cannot disagree), and `+` has been exact over
decimal spellings since fb2ff6c2. Nothing is left to refuse: `Bin has Total
Weight` emits the same bare fold `Bin has Total Count` does. An UNTYPED column
is still refused, and that decline is the one this probe keeps.

Bin(.id) is an entity type.
Item(.id) is an entity type.
Depot(.name) is an entity type.
Season is a value type.
Unit Count is a value type.
  The data type of Unit Count is integer.
Gram Weight is a value type.
  The data type of Gram Weight is decimal.
Label Code is a value type.
Priority is a value type.
  The data type of Priority is integer.
Total Count is a value type.
  The data type of Total Count is integer.
Urgent Total is a value type.
  The data type of Urgent Total is integer.
Yearly Total is a value type.
  The data type of Yearly Total is integer.
Total Weight is a value type.
  The data type of Total Weight is decimal.
Code Total is a value type.
Mean Count is a value type.
  The data type of Mean Count is integer.

Depot stocks Bin.
Bin holds Item.
Item has Unit Count.
Item has Gram Weight.
Item has Label Code.
Item has Priority.
Item ships in Season.
Bin has Total Count. *
Bin has Urgent Total. *
Depot has Yearly Total for Season. *
Bin has Total Weight. *
Bin has Code Total. *
Bin has Mean Count. *

* Bin has Total Count iff Total Count is the sum of Unit Count where Bin holds Item and that Item has that Unit Count.
* Bin has Urgent Total iff Urgent Total is the sum of Unit Count where Bin holds Item and that Item has that Unit Count and that Item has Priority of 2 or more.
* Depot has Yearly Total for Season iff Yearly Total is the sum of Unit Count where Depot stocks Bin and that Bin holds Item and that Item has that Unit Count and that Item ships in that Season.
* Bin has Total Weight iff Total Weight is the sum of Gram Weight where Bin holds Item and that Item has that Gram Weight.
* Bin has Code Total iff Code Total is the sum of Label Code where Bin holds Item and that Item has that Label Code.
* Bin has Mean Count iff Mean Count is the mean of Unit Count where Bin holds Item and that Item has that Unit Count.
