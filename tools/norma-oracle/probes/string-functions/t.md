# String comparisons and a concatenation: begins with an attribute of a bound variable, contains, and a concatenated head value

Source Declaration(.id) is an entity type.
Source Service(.name) is an entity type.
Source Request(.id) is an entity type.
Resource Declaration(.id) is an entity type.
Style Candidate(.id) is an entity type.
Listing(.id) is an entity type.
Base Path is a value type.
URL is a value type.
Resource Path is a value type.
Trim is a value type.

Source Declaration has Base Path.
Source Service has URL.
Source Declaration targets Source Service. *
Source Request is for Source Declaration.
Source Request is for Resource Declaration.
Resource Declaration has Resource Path.
Source Request resolves to target- URL. *
Style Candidate has candidate- Trim.
Listing has listing- Trim.
Style Candidate matches Listing. *

* Source Declaration targets Source Service iff Source Declaration has Base Path and that Base Path begins with the URL of that Source Service.
* Source Request resolves to target- URL iff Source Request is for Source Declaration and that Source Declaration has Base Path and Source Request is for Resource Declaration and that Resource Declaration has Resource Path and target- URL is the concatenation of that Base Path and that Resource Path.
* Style Candidate matches Listing iff Style Candidate has candidate- Trim and Listing has listing- Trim and that candidate- Trim contains that listing- Trim.
