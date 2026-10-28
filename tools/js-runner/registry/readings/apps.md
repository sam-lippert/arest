# The MCP Router's Registry

## Description

<!-- Sam, 2026-09-21: "Is there a way for the mcp to have its own db for app
     listing and config?" It is this. The router's app list was AREST_APPS, a
     semicolon-separated string in ~/.claude.json -- `claude=C:/...;support=C:/...`
     -- parsed by parseApps (mcp-router.js) into <name, dir> pairs. A string in a
     client's launch configuration is the one part of AREST that was not a fact:
     nothing could constrain it, nothing could say two apps shared a directory,
     and adding an app meant editing JSON that no check ever reads.

     So the list is READINGS, this file, and the daemon reads the App table of
     the store they compile to. Sam writes sentences; apps_check on `registry`
     compiles them with the arest function compile-store, the way every app's
     check compiles its own (2026-10-12: no package script runs); the daemon
     reads the table with bun:sqlite at start and reconciles its residents when
     apps_compile is called on `registry`. -->

<!-- AND THE CHECK REPLACES THE STORE RATHER THAN CARRYING IT (mcp-router.js
     sets the old store aside before compile-store and puts it back only when
     the check fails). compile.js carried a prior
     store's rows into the new build on one rule -- "the build beside us is
     exactly what the readings assert, so anything the prior store holds that
     the build does not is, by construction, what the runtime wrote" -- which
     is right for every app and wrong for exactly this one, because NOTHING
     writes this store at runtime: the daemon opens it readonly and selects.
     So a row the readings no longer assert is a deletion, not a runtime write.
     Measured 2026-09-22: with the carry, deleting an App sentence and running
     the check left the app in the table and the router went on serving it --
     an app could be added and never removed. Removing the file first makes
     the readings the whole truth, and loses nothing, because there is nothing
     here that the readings did not put there. -->

<!-- WHY THIS IS NOT the organizations library's App (apps/organizations, once arest/readings/templates/organizations.md). That App
     is the DEPLOYED application: it has an Organization, navigable Domains, a
     Generator, an authorization Fact Type, and `Each App has some navigable
     Domain` is mandatory -- a registry row would have to invent a Domain per
     app to satisfy it, and composing templates would pull agent-chat, vercel
     and sql-dialects vocabulary into a store whose only reader wants a name and
     a path. This is the RESIDENT: what the router runs, where its package is,
     and whether to start it.

     The reference scheme is the same on purpose -- App(.Slug), the spelling
     organizations.md uses -- so that `App 'support'` denotes the same app in
     both closures and the two never disagree about what identifies one. -->

## Entity Types

App(.Slug) is an entity type.

Library(.Slug) is an entity type.

## Value Types

Slug is a value type.

Package Directory is a value type.

Serving Status is a value type.
  The possible values of Serving Status are 'serving', 'suspended'.

## Fact Types

### App

<!-- THE PACKAGE, NOT THE CARRIERS DIRECTORY. AREST_APPS named each app's
     `.check` directory and the router derived the package from it with
     dirname(); the package is the thing a person names (it is where
     package.json and the readings are) and `.check` is where the build puts
     its output, so the fact is the package and the router appends `/.check`.
     Mandatory because a resident with no package is nothing the router can
     start, and unique because two residents over one directory is exactly what
     mcp-router's reap() exists to kill: one server per app directory. -->
App has Package Directory.
  Each App has exactly one Package Directory.
  For each Package Directory, at most one App has that Package Directory.

<!-- AND WHETHER TO START IT. Absence reads as 'serving': the smallest row Sam
     can write is a package directory, and it serves. 'suspended' is the
     opt-out -- the app stays in the registry, keeps its directory, is listed by
     `apps`, and no server is spawned for it. A value type rather than a unary
     because the absent case must be the common one and `App 'qa' is not
     suspended` is not a sentence anybody wants to have to write. -->
App has Serving Status.
  Each App has at most one Serving Status.

<!-- AND WHAT ITS CHECK READS IS ITS PACKAGE'S (Sam, 2026-10-20: "This is already in the
     package.json as the dependencies. No custom fields"; "The apps should compose any
     readings included"). An app's check is lambda's apps_check over its Package Directory:
     the metamodel, then each package its package.json's dependencies reach, each after the
     packages it depends on, a package's readings being its own directory and then its
     readings directory. No list of readings directories, nor of the libraries an App
     composes, is kept here: it would say again by hand what the dependencies say. -->

### Library

<!-- A LIBRARY IS TESTED ON ITS OWN AND INSIDE EACH APP THAT COMPOSES IT (Sam,
     2026-10-12: "Libraries should be able to be unit tested independently and
     as part of an app's functional tests"). A library is readings with no
     server and no store anything serves from, so it is no App (the note on
     apps/claude below). Its UNIT test is its package compiled alone, so it answers
     for its readings and the packages it depends on and nothing an earlier store
     carried. Its FUNCTIONAL tests are the checks of the Apps whose dependencies
     reach it. -->
Library has Package Directory.
  Each Library has exactly one Package Directory.
  For each Package Directory, at most one Library has that Package Directory.

## Instance Facts

<!-- The six residents AREST_APPS named on 2026-09-22, in the order it named
     them. apps/claude IS a composition: the libraries it composes, memory
     among them, have no App of their own; each is a Library, after the Apps.
     On 2026-09-23 arest-dev went to apps/archive with paper and engine, the two
     libraries only it composed: no session but one had asked it anything since
     the router began, and its store held nothing the runtime wrote. The one live
     thing it served was the punchlist, so tasks takes its place as an App of its
     own, parallel to claude rather than inside it: a punchlist edit then checks
     28 tasks in 32 s instead of claude's whole corpus, and a bad sentence in it
     cannot stop the memory store from building. -->

App 'claude' has Package Directory 'C:/Users/lippe/Repos/apps/claude'.

App 'tasks' has Package Directory 'C:/Users/lippe/Repos/apps/tasks'.

App 'support' has Package Directory 'C:/Users/lippe/Repos/apps/support.auto.dev'.

App 'qa' has Package Directory 'C:/Users/lippe/Repos/apps/qa.auto.dev'.

App 'pm' has Package Directory 'C:/Users/lippe/Repos/apps/pm.auto.dev'.

App 'engineering' has Package Directory 'C:/Users/lippe/Repos/apps/engineering.auto.dev'.

<!-- SPD-1 runs by itself (Sam, 2026-10-28): an App that claude also composes as a library. -->
App 'spd-1' has Package Directory 'C:/Users/lippe/Repos/apps/spd-1'.

<!-- The libraries the residents compose, and decidex and infosci, whose checks
     already called compile-store. Which compose which is each package.json's
     dependencies. -->

Library 'memory' has Package Directory 'C:/Users/lippe/Repos/apps/memory'.

Library 'connectors' has Package Directory 'C:/Users/lippe/Repos/apps/connectors'.

Library 'sherlock' has Package Directory 'C:/Users/lippe/Repos/apps/sherlock'.

Library 'auto.dev' has Package Directory 'C:/Users/lippe/Repos/apps/auto.dev'.

Library 'decidex' has Package Directory 'C:/Users/lippe/Repos/apps/decidex'.

Library 'infosci' has Package Directory 'C:/Users/lippe/Repos/apps/infosci'.

<!-- 2026-10-13, Sam: "I don't like 'templates,' and I don't want that in the arest repo. They
     should be moved into libraries and connectors", "in the apps folder", and Agent "in its own
     separate library, anything that uses agents should reference it". arest/readings/templates
     became agents (agents, agent-chat, agent-ethics), organizations, and two connectors under
     apps/connectors, sql-dialects and vercel-ai (vercel-ai, vercel-chat); arest/readings/ui became
     ui, and arest/readings/os became os. Every app that read templates composes all four, in the
     order the templates directory gave its files, so a check over the moved files rebuilds the
     store it had. Which app needs which is the next step. -->

<!-- 2026-10-13, Sam: "messages as an app is good, but it would just contain things pertaining to
     messaging, even between two people. Anything related to the universe of discourse pertaining
     to an agent goes with agents". A Chat Message is a Message, so agents composes messages, and
     every app that composes agents reads messages first. support declares Message itself until
     its own readings drop that declaration, so it does not compose messages yet. -->

Library 'messages' has Package Directory 'C:/Users/lippe/Repos/apps/messages'.

Library 'agents' has Package Directory 'C:/Users/lippe/Repos/apps/agents'.

Library 'organizations' has Package Directory 'C:/Users/lippe/Repos/apps/organizations'.

Library 'sql-dialects' has Package Directory 'C:/Users/lippe/Repos/apps/connectors/sql-dialects'.

Library 'vercel-ai' has Package Directory 'C:/Users/lippe/Repos/apps/connectors/vercel-ai'.

Library 'ui' has Package Directory 'C:/Users/lippe/Repos/apps/ui'.

Library 'os' has Package Directory 'C:/Users/lippe/Repos/apps/os'.

Domain 'registry' has Description 'The MCP router''s residents and the libraries they compose: which apps it serves, where each app''s or library''s package is, and whether to start an app; what each composes is its package.json''s dependencies.'.
