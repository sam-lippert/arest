# The MCP Router's Registry

## Description

<!-- THE ROUTER'S APP LIST IS FACTS, NOT A CONFIGURATION STRING. A list of
     name=directory pairs in a client's launch configuration is the one part of
     AREST that would not be a fact: nothing could constrain it, nothing could
     say two apps shared a directory, and adding an app would mean editing JSON
     that no check ever reads.

     So the list is readings, and the router reads the App table of the store
     they compile to. This file is the SCHEMA: what an App and a Library are and
     what the router needs to know of each. The residents themselves, which apps
     and libraries a machine has and where their packages are, are stated by a
     package of that machine's own, outside this repository, that names this one
     among its dependencies; its check compiles into the registry's store
     directory, the way every app's check compiles its own. -->

<!-- AND THE CHECK REPLACES THE STORE RATHER THAN CARRYING IT. A check carries a
     prior store's rows into the new build on one rule: what the prior store
     holds that the build does not is what the runtime wrote. That is right for
     every app and wrong for this one, because nothing writes this store at
     runtime: the router opens it read-only and selects. So a row the readings no
     longer assert is a deletion, not a runtime write. Measured: with the carry,
     deleting an App sentence and running the check left the app in the table
     and the router went on serving it, so an app could be added and never
     removed. The readings are the whole truth here, and nothing is lost,
     because there is nothing in this store that the readings did not put there. -->

<!-- WHY THIS IS NOT the organizations library's App. That App is the DEPLOYED
     application: it has an Organization, navigable Domains, a Generator, an
     authorization Fact Type, and `Each App has some navigable Domain` is
     mandatory, so a registry row would have to invent a Domain per app to
     satisfy it, and composing that library would pull unrelated vocabulary
     into a store whose only reader wants a name and a path. This is the
     RESIDENT: what the router runs, where its package is, and whether to start
     it.

     The reference scheme is the same on purpose, App(.Slug), so that one slug
     denotes the same app in both closures and the two never disagree about
     what identifies one. -->

## Entity Types

App(.Slug) is an entity type.

Library(.Slug) is an entity type.

## Value Types

Slug is a value type.

Package Directory is a value type.

Store Directory is a value type.

Serving Status is a value type.
  The possible values of Serving Status are 'serving', 'suspended'.

## Fact Types

### App

<!-- THE PACKAGE, NOT A DIRECTORY INSIDE IT. The package is the thing a person
     names (it is where package.json and the readings are), so the fact is the
     package. Where the build puts its output is the Store Directory below.
     Mandatory because a resident with no package is nothing the router can
     start, and unique because two residents over one directory are one server
     started twice. -->
App has Package Directory.
  Each App has exactly one Package Directory.
  For each Package Directory, at most one App has that Package Directory.

<!-- AND WHETHER TO START IT. Absence reads as 'serving': the smallest row is a
     package directory, and it serves. 'suspended' is the opt-out: the app stays
     in the registry, keeps its directory, is listed by `apps`, and no server is
     started for it. A value type rather than a unary because the absent case
     must be the common one. -->
App has Serving Status.
  Each App has at most one Serving Status.

<!-- AND WHERE ITS STORE IS. The store and the carriers its check writes live in
     this directory, outside the package, so a repository holds the readings and
     nothing a check or a server writes. The router hands it to apps_check and
     serves the App from it; unique because one store is one App's. -->
App has Store Directory.
  Each App has exactly one Store Directory.
  For each Store Directory, at most one App has that Store Directory.

<!-- AND WHAT ITS CHECK READS IS ITS PACKAGE'S. A check reads the metamodel, then
     each package its package.json's dependencies reach, each after the packages
     it depends on, a package's readings being its own directory and then its
     readings directory. No list of readings directories, nor of the libraries
     an App composes, is kept here: it would say again by hand what the
     dependencies say. -->

### Library

<!-- A LIBRARY IS TESTED ON ITS OWN AND INSIDE EACH APP THAT COMPOSES IT. A
     library is readings with no server and no store anything serves from, so it
     is no App. Its UNIT test is its package compiled alone, so it answers for
     its readings and the packages it depends on and nothing an earlier store
     carried. Its FUNCTIONAL tests are the checks of the Apps whose dependencies
     reach it. -->
Library has Package Directory.
  Each Library has exactly one Package Directory.
  For each Package Directory, at most one Library has that Package Directory.

## Instance Facts

<!-- NO RESIDENT IS NAMED HERE. A machine's package of residents states them,
     one App with its Package Directory and its Store Directory, one Library
     with its Package Directory, for instance:

       App 'example' has Package Directory '/home/me/apps/example'.
       App 'example' has Store Directory '/home/me/.arest/example'.
       Library 'shared' has Package Directory '/home/me/apps/shared'.

     With none stated the router serves no app and answers `apps` with nothing. -->

Domain 'registry' has Description 'The MCP router''s residents and the libraries they compose: which apps it serves, where each app''s or library''s package is, and whether to start an app; what each composes is its package.json''s dependencies.'.
