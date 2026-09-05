# A computed head role: the chain emits a calc step, so the closure can derive an arithmetic head

Request(.id) is an entity type.
Day Count is a value type.
  The data type of Day Count is numeric.

Request has submission- Day Count.
Request has response- Day Count.
Request has deadline- Day Count. *

* Request has deadline- Day Count iff Request has some submission- Day Count and Request has some response- Day Count and deadline- Day Count is submission- Day Count plus response- Day Count.
