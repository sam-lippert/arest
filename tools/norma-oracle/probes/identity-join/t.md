# A bridge reading between two entity types (`Support Request is Contact Submission`, a declared fact type) with a value alias onto the head

Request(.id) is an entity type.
Support Request(.id) is an entity type.
Support Request is a subtype of Request.
Contact Submission(.id) is an entity type.
Date is a value type.
Timestamp is a value type.
Message Body is a value type.
Description is a value type.

Contact Submission has Date.
Contact Submission has Message Body.
Support Request is Contact Submission.
Support Request occurred at Timestamp. +
Support Request has Description. +

+ Support Request occurred at Timestamp iff that Contact Submission has Date and Support Request is Contact Submission and Timestamp is Date.
+ Support Request has Description iff that Contact Submission has Message Body and Support Request is Contact Submission and Description is Message Body.
