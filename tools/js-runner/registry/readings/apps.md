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
     the store they compile to. Sam writes sentences; `bun run check` here
     compiles them the way every app's check compiles its own; the daemon reads
     the table with bun:sqlite at start and reconciles its residents when
     apps_compile is called on `registry`. -->

<!-- AND THE CHECK REPLACES THE STORE RATHER THAN CARRYING IT (package.json:
     `rm -f .check/store.db` before compile.js). compile.js carries a prior
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

## Instance Facts

<!-- The six residents AREST_APPS named on 2026-09-22, in the order it named
     them. claude, memory and spd-1: apps/claude IS the composition; memory and
     spd-1 are libraries with no App of their own, so neither appears here. -->

App 'claude' has Package Directory 'C:/Users/lippe/Repos/apps/claude'.

App 'arest-dev' has Package Directory 'C:/Users/lippe/Repos/apps/arest-dev'.

App 'support' has Package Directory 'C:/Users/lippe/Repos/apps/support.auto.dev'.

App 'qa' has Package Directory 'C:/Users/lippe/Repos/apps/qa.auto.dev'.

App 'pm' has Package Directory 'C:/Users/lippe/Repos/apps/pm.auto.dev'.

App 'engineering' has Package Directory 'C:/Users/lippe/Repos/apps/engineering.auto.dev'.
