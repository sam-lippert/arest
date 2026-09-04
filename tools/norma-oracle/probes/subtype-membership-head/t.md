# A unary head whose only leg is a subtype membership: the recipe must be a form, not the subtype's bare name

Agency Action(.id) is an entity type.
Final Agency Action is an entity type.
Final Agency Action is a subtype of Agency Action.

Agency Action is final. *
Agency Action is reviewable. *
Agency Action is precluded from review by statute.

* Agency Action is final iff Agency Action is a Final Agency Action.
* Agency Action is reviewable iff Agency Action is final and it is not true that that Agency Action is precluded from review by statute.
