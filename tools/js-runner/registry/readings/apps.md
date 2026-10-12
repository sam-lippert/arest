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

<!-- WHY THIS IS NOT arest/readings/templates/organizations.md's App. That App
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

Readings Directory is a value type.

Readings Position is a value type.
  The data type of Readings Position is integer.

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

<!-- AND WHAT ITS CHECK READS (Sam, 2026-10-12: compile and build are arest
     functions, not package scripts). An app's check is the arest function
     compile-store over the readings directories it composes, in order, each
     relative to its Package Directory. They were the tail of a `check` string
     in each package.json, which the router ran blind and apps_evaluate parsed
     back out with a regular expression; as facts the router reads them and calls
     the function itself. -->
App reads Readings Directory at Readings Position.
  Each App, Readings Position combination occurs at most once in the population of App reads Readings Directory at Readings Position.

### Library

<!-- A LIBRARY IS TESTED ON ITS OWN AND INSIDE EACH APP THAT COMPOSES IT (Sam,
     2026-10-12: "Libraries should be able to be unit tested independently and
     as part of an app's functional tests"). A library is readings with no
     server and no store anything serves from, so it is no App (the note on
     apps/claude below). Its UNIT test is compile-store over the directories it
     reads, into an empty .check/unit, so it answers for those readings and
     nothing an earlier store carried. Its FUNCTIONAL tests are the checks of the
     Apps that compose it, whose readings directories include its own; apps_check
     on a library names them. Each library's directories were the tail of its
     package.json `check`, as the apps' were. -->
Library has Package Directory.
  Each Library has exactly one Package Directory.
  For each Package Directory, at most one Library has that Package Directory.

Library reads Readings Directory at Readings Position.
  Each Library, Readings Position combination occurs at most once in the population of Library reads Readings Directory at Readings Position.

App composes Library.
  It is possible that the same App composes more than one Library.
  It is possible that more than one App composes the same Library.

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
App 'claude' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
App 'claude' reads Readings Directory '../../arest/readings/templates' at Readings Position '2'.
App 'claude' reads Readings Directory '../memory/readings' at Readings Position '3'.
App 'claude' reads Readings Directory '../spd-1/readings' at Readings Position '4'.
App 'claude' reads Readings Directory 'readings' at Readings Position '5'.

App 'tasks' has Package Directory 'C:/Users/lippe/Repos/apps/tasks'.
App 'tasks' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
App 'tasks' reads Readings Directory '../../arest/readings/templates' at Readings Position '2'.
App 'tasks' reads Readings Directory 'readings' at Readings Position '3'.

App 'support' has Package Directory 'C:/Users/lippe/Repos/apps/support.auto.dev'.
App 'support' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
App 'support' reads Readings Directory '../../arest/readings/templates' at Readings Position '2'.
App 'support' reads Readings Directory '../../arest/readings/ui' at Readings Position '3'.
App 'support' reads Readings Directory '../connectors/readings' at Readings Position '4'.
App 'support' reads Readings Directory '../sherlock' at Readings Position '5'.
App 'support' reads Readings Directory '../auto.dev' at Readings Position '6'.
App 'support' reads Readings Directory '.' at Readings Position '7'.
App 'support' reads Readings Directory 'readings' at Readings Position '8'.

App 'qa' has Package Directory 'C:/Users/lippe/Repos/apps/qa.auto.dev'.
App 'qa' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
App 'qa' reads Readings Directory '../../arest/readings/templates' at Readings Position '2'.
App 'qa' reads Readings Directory '.' at Readings Position '3'.
App 'qa' reads Readings Directory 'readings' at Readings Position '4'.

App 'pm' has Package Directory 'C:/Users/lippe/Repos/apps/pm.auto.dev'.
App 'pm' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
App 'pm' reads Readings Directory '../../arest/readings/templates' at Readings Position '2'.
App 'pm' reads Readings Directory '.' at Readings Position '3'.
App 'pm' reads Readings Directory 'readings' at Readings Position '4'.

App 'engineering' has Package Directory 'C:/Users/lippe/Repos/apps/engineering.auto.dev'.
App 'engineering' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
App 'engineering' reads Readings Directory '../../arest/readings/templates' at Readings Position '2'.
App 'engineering' reads Readings Directory '.' at Readings Position '3'.
App 'engineering' reads Readings Directory 'readings' at Readings Position '4'.

<!-- The libraries the residents compose (memory and spd-1 in claude; connectors,
     sherlock and auto.dev in support), and decidex and infosci, whose checks
     already called compile-store. auto.dev composes connectors and sherlock in
     turn; support reads all three itself, so it composes each. -->

Library 'memory' has Package Directory 'C:/Users/lippe/Repos/apps/memory'.
Library 'memory' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
Library 'memory' reads Readings Directory 'readings' at Readings Position '2'.

Library 'spd-1' has Package Directory 'C:/Users/lippe/Repos/apps/spd-1'.
Library 'spd-1' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
Library 'spd-1' reads Readings Directory 'readings' at Readings Position '2'.

Library 'connectors' has Package Directory 'C:/Users/lippe/Repos/apps/connectors'.
Library 'connectors' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
Library 'connectors' reads Readings Directory 'readings' at Readings Position '2'.

Library 'sherlock' has Package Directory 'C:/Users/lippe/Repos/apps/sherlock'.
Library 'sherlock' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
Library 'sherlock' reads Readings Directory '.' at Readings Position '2'.
Library 'sherlock' reads Readings Directory 'readings' at Readings Position '3'.

Library 'auto.dev' has Package Directory 'C:/Users/lippe/Repos/apps/auto.dev'.
Library 'auto.dev' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
Library 'auto.dev' reads Readings Directory '../connectors/readings' at Readings Position '2'.
Library 'auto.dev' reads Readings Directory '../sherlock' at Readings Position '3'.
Library 'auto.dev' reads Readings Directory '.' at Readings Position '4'.
Library 'auto.dev' reads Readings Directory 'readings' at Readings Position '5'.

Library 'decidex' has Package Directory 'C:/Users/lippe/Repos/apps/decidex'.
Library 'decidex' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
Library 'decidex' reads Readings Directory '.' at Readings Position '2'.

Library 'infosci' has Package Directory 'C:/Users/lippe/Repos/apps/infosci'.
Library 'infosci' reads Readings Directory '../../arest/metamodel' at Readings Position '1'.
Library 'infosci' reads Readings Directory 'readings' at Readings Position '2'.

App 'claude' composes Library 'memory'.
App 'claude' composes Library 'spd-1'.
App 'support' composes Library 'connectors'.
App 'support' composes Library 'sherlock'.
App 'support' composes Library 'auto.dev'.

Domain 'registry' has Description 'The MCP router''s residents and the libraries they compose: which apps it serves, where each app''s or library''s package is, which readings directories its check compiles and in what order, which libraries each app composes, and whether to start an app.'.
