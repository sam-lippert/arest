## Entity Types
User(.User Id) is an entity type.
Admin(.Email Address) is an entity type.
Admin is a subtype of User.
Role(.Name) is an entity type.
## Value Types
User Id is a value type.
Email Address is a value type.
Name is a value type.
Operation is a value type.
  The possible values of Operation are 'create', 'read'.
Protected Resource is a value type.
## Fact Types
User is authorized for Operation on Protected Resource.
Admin has Role.
## Derivation Rules
+ Admin is authorized for Operation 'create' on Protected Resource 'Support Request' if Admin has Role.
