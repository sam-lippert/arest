# A citation of an undeclared fact type is refused, not minted; one that names an object type is filed by that kind

### `Fact Type 'AI System is High Risk' cites Citation 'EU-AI-Act-Art-6'`
### named a sentence eu-law never declares; the value left as written became
### a Fact Type instance with no role and no reading, and the metamodel's
### has-a-role / has-a-reading mandatories fired on it -- 88 such phantoms,
### 176 of eu-law's 254 alethic violations (2026-09-09). An instance does not
### declare a type: a Fact Type filler that resolves to no declared fact type
### by reading, by subtype reading, or by id is refused with its sentence.
### The declared reading, the declared subtype, and the id all still resolve;
### an Event Type's own name, which is not a fact type, stays as written.

### AND A SUBJECT THAT NAMES A DECLARED OBJECT TYPE IS NOT UNDECLARED, it is
### a defined term citing its authority: `Fact Type 'Buyer' cites Citation
### 'UCC-2-103'`, 134 sentences over 93 subjects in us-law (2026-09-10). The
### citation door is one fact type on the supertype (`Function cites Citation`,
### instances.md), so the row needs no re-filing; what the sentence got wrong is
### the kind, and the row records the kind the value really is. A subject that
### is neither a declared fact type nor a declared object type is refused as
### before.

Function(.name) is an entity type.
Fact Type(.name) is an entity type.
Object Type(.name) is an entity type.
  Object Type is a subtype of Function.
  Fact Type is a subtype of Function.
Event Type(.name) is an entity type.
Citation(.id) is an entity type.
Person(.name) is an entity type.
Party(.name) is an entity type.
Webhook(.name) is an entity type.

Function cites Citation.
Webhook raises Event Type.
Person smokes.
Person is a subtype of Party.

Fact Type 'Person smokes' cites Citation 'C-1'.
Fact Type 'PersonSmokes' cites Citation 'C-2'.
Fact Type 'Person is a subtype of Party' cites Citation 'C-3'.
Fact Type 'Person drinks' cites Citation 'C-4'.
Fact Type 'Party' cites Citation 'C-5'.
Webhook 'stripe' raises Event Type 'customer.subscription.created'.
