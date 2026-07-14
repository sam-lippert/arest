# The operational ledger — claude app, rebuilt 2026-07-14 as pure atomic facts
# (Samuel's 2026-07-13 ruling: no old data, no hardcoded lessons, no prose
# fields). Operating rules are DEONTIC FORML2 readings; engineering facts are
# instances over a small schema (Decision constrains Operation, Finding
# concerns Code Site). Seed content is TODAY's rulings only, and satisfies
# every deontic rule — a clean Python validate is the well-formedness proof.
# (Native validate is an incomplete override that fuel-caps on the base
# state-machine shape, task 15; the Python reference is the validator of record.)

## Entity Types

Commit(.sha) is an entity type.
Automation(.name) is an entity type.
Pinentry(.name) is an entity type.
Push(.id) is an entity type.
Host Build(.name) is an entity type.
Operation(.name) is an entity type.
Decision(.key) is an entity type.
Code Site(.path) is an entity type.
Finding(.key) is an entity type.

## Readings

Commit is unsigned.
Automation touches Pinentry.
Host Build is zero-dependency.
Operation is delegating.
Operation is registered.
Push is to main.
Push has Human Approval.

Decision constrains Operation.
Finding concerns Code Site.

## Constraints

It is obligatory that each Commit is unsigned.
It is forbidden that Automation touches Pinentry.
It is obligatory that each Host Build is zero-dependency.
It is obligatory that each Operation is registered if that Operation is delegating.
It is obligatory that each Push has Human Approval if that Push is to main.

## Seed facts

Commit '17f2f10e' is unsigned.

Host Build 'rust-host' is zero-dependency.

Operation 'synthesize' is delegating.
Operation 'synthesize' is registered.
Operation 'validate' is delegating.
Operation 'validate' is registered.

Decision 'sg-1' constrains Operation 'commit'.
Decision 'zero-dep' constrains Operation 'host-build'.
Decision 'registered-class' constrains Operation 'synthesize'.
Decision 'registered-class' constrains Operation 'validate'.
Decision 'push-discipline' constrains Operation 'push'.

Finding 'task12-not-built-before-today' concerns Code Site 'engine/apps/claude'.
Finding 'tromp-litmus-336-of-353-pure' concerns Code Site 'engine/python/tromp.py'.
Finding 'subset-validator-fixed-task25' concerns Code Site 'engine/python/compiler.py'.
