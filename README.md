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

Requires PHP 8.4. On Toolforge, start the webservice with `toolforge webservice php8.4`. The default `toolforge webservice start` image is still PHP 7.4.

### Routes @ Toolforge

* Home:
  https://bsaut.toolforge.org/

* Search:
  https://bsaut.toolforge.org/search/rish%C3%B8i

* Display a single record and related info:
  https://bsaut.toolforge.org/show/7031632

### Development environment

[devenv](https://devenv.sh/) provides PHP 8.4 and Composer.

```bash
devenv shell
composer install
devenv up
```

Open http://127.0.0.1:8080/. `devenv up` serves `public_html` and sends routes such as `/search` and `/show/7031632` to `index.html`, the same way `.lighttpd.conf` does on Toolforge. `composer install` is only needed when `vendor/` is missing.


### Deployment notes

```bash
# Login and update code
ssh tools-login.wmflabs.org
become bsaut
git pull   # uses read-only deployment key in ~/.ssh/deploy_key_github

# Install/update dependencies
toolforge webservice php8.4 shell
composer install
exit

# Restart service
toolforge webservice restart

# Switch php version
toolforge webservice stop
toolforge webservice php8.4 start
toolforge webservice status
Your webservice of type php8.4 is running on backend kubernetes
```
