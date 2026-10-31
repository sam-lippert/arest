# 9j0: alethic violations of claude, engineering and support, and how AREST.tex:335 would stage them

Lane C, 2026-10-31. Read-only. Method: cp to scratch only; lambda's validate (arest:12344) via Serve --call validate on Java at -Xmx800m, lambda 5279b7a7. Each store ran as copied, then on a second copy compiled in place by today's lambda (Program compile-package <copy> <package>). Live md5s unchanged: claude 4045ab42, engineering b4e58ce4, support 77e12d29. Support's live file cmp-equals $T/ipS-before.db after the run (checked again by the coordinator). Nothing sent, nothing synced. Per-store outputs: $T/lc/9j0/<app>[-rc]/validate.out, groups.json, <app>.out, run.sh, group.py.

**Why recompile:** a store compiled before 78eb74ad gives false positives. Today's validate reads the + fact type Object Type has World Assumption as empty over such a store, so it reports that mandatory for every object type. On claude, recompiling took those 311 to 0.

| store | as copied | recompiled by today's lambda |
|---|---|---|
| claude (10-21) | 314 (311 are the World Assumption artefact) | 2 (compile 368 s, 742 MB peak) |
| engineering (10-14) | validate throws: no schema in _defs | 21 in 8 groups (compile 1,086 s) |
| support (10-22) | 1,112, all the artefact (validate 750 s) | not obtained: "REFUSED: 8 value(s) of 'Secret Reference' … no AREST_MASTER_KEY … Nothing was written." The key is Sam's. |

**Staging rule (AREST.tex:335):** a migration stages as derivations or deontic rules until P complies. A derivation where the missing facts can be computed from facts P holds; a deontic otherwise. Everything below is a proposal; readings changes go through CSDP with Sam.

## claude (recompiled), 2

1. Each Object Type is of exactly one Object Kind (core.md:415), ×1 'Arity'.
   - Neither staging fits; a stale instance fact. apps/claude/readings/conceptual-types.md:19 `Value Type 'Arity' has Conceptual Data Type 'unsigned'` mints Arity, and nothing has declared Arity since 78eb74ad removed Fact Type has Arity.
   - Fix: remove the line, or redeclare Arity. Interim deontic if needed.
2. Each User has exactly one Email (instances.md:262), ×1 'claude-code'.
   - Deontic: "It is obligatory that each User has some Email."
   - claude-code is an Automation. organizations.md:58 says "at most one", so the two readings disagree.

## engineering (recompiled), 21 in 8 groups

1. Each Source has exactly one Fetcher Type (auto.dev/data-pipeline.md:33), ×6: honda, nhtsa, hyundai, stellantis, kia, …. Derivation where its Connector/Fetcher names the type; else deontic.
2. Each Notification is for exactly one Customer (auto.dev/website.md:34), ×3: notify-1700 and two slack-engineering-* posts. Deontic; runtime Slack notifications.
3. Notification is via Notification Channel (website.md:38), ×3, the same three. Derivation: the channel follows from how it was sent.
4. Notification occurred at Timestamp (website.md:40), ×3. Deontic, or a derivation where the id carries the time.
5. Notification uses Email Template (website.md:36), ×3. Deontic; the mandatory belongs on email notifications only.
6. Each Object Type has exactly one World Assumption (core.md:478, uniqueness), ×1 '1'. Neither fits: a rule conflict on a stray numeral read as an Object Type. Fix the rules or the stray declaration.
7. Each Federation is established in exactly one Country Code (auto.dev/eu-compliance.md:175), ×1 'lambda' (the reflection federation, federation.md:228). Derivation for Kind 'lambda', or deontic for internal federations.
8. Each Fetcher has exactly one Fetcher Implementation (auto.dev/source-routing.md:102), ×1 'reflect:schema'. Derivation from its compiled Definition Origin and Implementation (federation.md:232; Function rows since 8h1).

## support

No honest set yet. Next step, Sam's call: the same compile-package on a scratch copy with AREST_MASTER_KEY set for that one process, then validate.

## Compile diagnostics that are not violations

- COLLISIONS. claude has 5: apply (Transition in evolution, Operation and Function in resolution); 1, 2, 3 (Law in ethics, Hexagram in i-ching); Water (Element in elements, Need in maslow). Engineering has 46. By #199 each is two things; propose qualifying the references; no staging. Engineering's '1' in group 6 looks like the same family.
- UNDECLARED DERIVED FACT TYPE, `Webhook Event yields Fact` (claude 1; engineering 23 heads of this kind). Propose declaring the head; not a constraint over P, so no deontic.
