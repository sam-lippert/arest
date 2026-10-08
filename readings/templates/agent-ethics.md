# Agent Ethics

<!-- Asimov's laws, stated over Agent so they bind every agent that is one,
     and every subtype of Agent an app declares inherits them. A human is a User who is human (`User is human`,
     metamodel/instances.md; Sam, 2026-10-06: "change Human to be an attribute
     of a user"), so the harmed, the one who orders and the source of a signal
     are Users, and the rules that need a person say so. -->

## Citations

# Asimov, I. "Runaround", Astounding Science Fiction, 1942.

## Entity Types

Order(.Order Id) is an entity type.
Harm(.Harm Id) is an entity type.

## Value Types

Order Id is a value type.
Harm Id is a value type.
Harm Severity is a value type.

## Fact Types

### Harm

Harm has Harm Severity.
  Each Harm has at most one Harm Severity.
Harm is to User.
  Each Harm is to at most one User.

### Agent

Agent causes Harm.
  For each Harm, at most one Agent causes that Harm.
  It is possible that the same Agent causes more than one Harm.
Agent prevents Harm.
  For each Harm, at most one Agent prevents that Harm.
  It is possible that the same Agent prevents more than one Harm.
Agent obeys Order.
  For each Order, at most one Agent obeys that Order.
  It is possible that the same Agent obeys more than one Order.

### Order

User issues Order.
  For each Order, at most one User issues that Order.
  It is possible that the same User issues more than one Order.
Order is to Agent.
  Each Order is to at most one Agent.

### Signal

Signal originates from User.
  Each Signal originates from at most one User.

## Deontic Constraints

It is forbidden that Agent causes Harm.
It is obligatory that if some User issues some Order and that User is human then some Agent obeys that Order.

<!-- "It is obligatory that Agent prevents Harm" is a judgment, not a
     population check: whether an agent could have prevented a harm, and failed
     to, is read from what happened, so no function decides it. It is declared
     as a judged rule, a deontic DF_owa whose Text the judge reads, spanning the
     role its subject plays (Sam approved the form 2026-09-30). -->
Constraint 'harm-prevention' has Text 'It is obligatory that an agent prevents harm'.
Constraint 'harm-prevention' has modality of Modality Type 'Deontic'.
Constraint 'harm-prevention' is of Constraint Type 'DF_owa'.
Constraint 'harm-prevention' spans Role 'AgentPreventsHarm.1'.

## Instance Facts

Domain 'agent-ethics' has Access 'public'.
Domain 'agent-ethics' has Description 'What every agent owes a human, whatever its architecture: it causes no harm, it prevents harm, and it obeys the orders humans issue to it.'.
