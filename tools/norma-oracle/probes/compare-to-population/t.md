# A comparison against a bare value type's own population, in a chain and under a value-restricted head

Log Entry(.id) is an entity type.
External System(.name) is an entity type.
HTTP Status is a value type.
Retry Count is a value type.
Retry Limit is a value type.
Error Rate is a value type.
Interval is a value type.
Down Threshold is a value type.
Service Health Status is a value type.

Log Entry has HTTP Status.
Log Entry has Retry Count.
Log Entry is retried. *
External System has Error Rate for Interval.
External System has Service Health Status. +

Retry Limit is 3.
Down Threshold is 50.

* Log Entry is retried iff Log Entry has HTTP Status of 500 or more and Log Entry has Retry Count and that Retry Count is less than Retry Limit.
+ External System has Service Health Status 'down' if External System has Error Rate for Interval and that Error Rate exceeds Down Threshold.
