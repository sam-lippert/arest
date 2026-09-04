# Aggregates over a where-clause chain: a sum of a bound value, a sum of a role-qualified value, a count with a threshold leg, a mean

Invoice(.id) is an entity type.
Invoice Line Item(.id) is an entity type.
Provider Resource(.name) is an entity type.
Service(.name) is an entity type.
Log Entry(.id) is an entity type.
External System(.name) is an entity type.
Billing Period is a value type.
Amount is a value type.
Cost is a value type.
HTTP Status is a value type.
Interval is a value type.
Error Rate is a value type.
Response Time is a value type.

Invoice has Billing Period.
Invoice Line Item has Invoice.
Invoice Line Item has Amount.
Invoice Line Item belongs to Provider Resource.
Provider Resource supports Service.
Provider Resource has monthly- Cost for Billing Period. *
Service has monthly- Cost for Billing Period. *
Log Entry has External System.
Log Entry has HTTP Status.
Log Entry has Response Time.
Log Entry is in Interval.
External System has Error Rate for Interval. *
External System has average- Response Time for Interval. *

* Provider Resource has monthly- Cost for Billing Period iff monthly- Cost is the sum of Amount where some Invoice Line Item has that Amount and that Invoice Line Item belongs to that Provider Resource and that Invoice Line Item has some Invoice and that Invoice has that Billing Period.
* Service has monthly- Cost for Billing Period iff monthly- Cost is the sum of monthly- Cost1 where some Provider Resource supports that Service and that Provider Resource has monthly- Cost1 for that Billing Period.
* External System has Error Rate for Interval iff Error Rate is the count of Log Entry where Log Entry has that External System and Log Entry has HTTP Status of 400 or more and Log Entry is in that Interval.
* External System has average- Response Time for Interval iff average- Response Time is the mean of Response Time where Log Entry has that External System and Log Entry has that Response Time and Log Entry is in that Interval.
