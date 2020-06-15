## bsaut

Frontend for searching and displaying records from the
[Bibsys authority records API](https://authority.bibsys.no/authority/),
together with mappings from Wikidata.

### Notes on the name of the authority file

* The authority records, published by Unit for the National Library of Norway and the
  Bibsys Library System Consortium, form the vocabulary
  "[Felles autoritetsregister for personer og korporasjoner](https://bibliotekutvikling.no/kunnskapsorganisering/kunnskapsorganisering/felles-autoritetsregister-for-personer-og-korporasjoner/)",
  formerly known as "Bibsys autoritetsregister" (BARE).
  There is no official abbreviation nor English name for the vocabulary, but it uses the
  [MARC source code](https://www.loc.gov/standards/sourcelist/subject.html) "noraf",
  which is registered as "Norwegian Authority File" with Library of Congress.
  The LOC record refers to the National Library of Norway as the publisher though,
  which is not really correct,
  so it's possible that the code has been repurposed without updating its description.
  The complete vocabulary is published to VIAF using the [BIBSYS](viaf.org/viaf/partnerpages/BIBSYS.html) organization code.

* A subset of the vocabulary is known as "Nasjonalt autoritetsregister".
  This subset is published to VIAF for the National Library of Norway using a separate
  organization code ([W2Z](http://viaf.org/viaf/partnerpages/W2Z.html)), but is otherwise not published
  as a separate vocabulary.
  In the authority records, a record can be identified as belonging to "Nasjonalt autoritetsregister"
  if it has "status" set to "kat3".

### Routes @ Toolforge

* Home:
  https://bsaut.toolforge.org/

* Search:
  https://bsaut.toolforge.org/search/rish%C3%B8i

* Display a single record and related info:
  https://bsaut.toolforge.org/show/7031632
