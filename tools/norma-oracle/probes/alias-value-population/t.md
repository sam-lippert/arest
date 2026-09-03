## Entity Types
Request(.id) is an entity type.
Submission(.id) is an entity type.
## Value Types
Category is a value type.
Issue Type is a value type.
## Fact Types
Submission has Issue Type.
  Each Submission has at most one Issue Type.
Request is Submission.
  Each Request is at most one Submission.
Request has Category. +
  Each Request has at most one Category.
## Derivation Rules
+ Request has Category if that Submission has Issue Type and Request is Submission and Category is Issue Type.
