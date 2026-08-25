"""#18: the entity-type reading handler, canonized (the first CONDITIONAL class). Stage-1
now delivers two groups g0=name, g1=refmode ('' when absent); host _h_entity rides refMode
only when g1 is present. system:h_entity is the certified-equal twin over ⟨groups, known,
mod⟩ -> ⟨rows, phi⟩ with COND(eq(g1,''), single-row, two-rows)."""
import pyarest.prims  # noqa: F401
from pyarest import canon, compiler
from pyarest.lam import from_lam, to_lam, atom as A
from pyarest.reduce import apply as R

canon.load_all()

# (name, refmode) pairs — '' is Stage-1's absent-refmode, the polyglot form the canon tests
SAMPLES = [("User", "Email"), ("Country", "Country Code"), ("Object Type", ""), ("A", "")]


def _canon(groups):
    r = from_lam(R(A("system:h_entity"), to_lam((tuple(groups), (), ""))))
    return [(x[0], tuple(x[1])) for x in r[0]], (list(r[1]) if len(r) > 1 else [])


def _host(groups):
    a, o = compiler._h_entity(groups, None, None)
    return [(c, tuple(row)) for c, row in a], list(o)


def test_entity_twins_host():
    """Rows exactly; objects by CID only.

    _canon_h resolves obj terms to callables at the boundary and says so in its
    own docstring -- "the objs do NOT come back in the same FORM, and that is
    the contract rather than a mismatch". Comparing the whole pair passed only
    while h_entity emitted no objects at all; now that a reference mode carries
    its identity constraints, the forms differ by design and the cids are what
    a divergence would show up in."""
    for g in SAMPLES:
        crows, cobjs = _canon(g)
        hrows, hobjs = _host(g)
        assert crows == hrows, g
        assert [o[0] for o in cobjs] == [o[0] for o in hobjs], g


def test_entity_shape():
    """User(.Email) is an IDENTITY, not a mode word.

    The value type is User_Email and not a shared 'Email': the id of a User and
    the id of a Commit are not values of the same kind, and NORMA's own models
    expand per entity for that reason. _pid is the preferred identifier -- the
    uniqueness on the identifying role is what makes a value an identifier
    rather than an attribute."""
    rows, objs = _canon(("User", "Email"))
    assert rows == [
        ("instanceOf", ("User", "ObjectType")),
        ("refMode", ("User", "Email")),
        ("instanceOf", ("User_Email", "ValueType")),
        ("factType", ("User_has_User_Email", "{0} has {1}")),
        ("role", ("User_has_User_Email.1", "User_has_User_Email", 1, "User")),
        ("role", ("User_has_User_Email.2", "User_has_User_Email", 2, "User_Email")),
        ("constraint", ("User_has_User_Email_uc", "uniqueness",
                        "User_has_User_Email", "alethic")),
        ("spans", ("User_has_User_Email_uc", 1)),
        ("constraint", ("User_has_User_Email_pid", "uniqueness",
                        "User_has_User_Email", "alethic")),
        ("spans", ("User_has_User_Email_pid", 2)),
        ("constraint", ("User_has_User_Email_mand", "mandatory",
                        "User_has_User_Email", "User", "alethic")),
        ("spans", ("User_has_User_Email_mand", 1)),
    ]
    assert [o[0] for o in objs] == [
        "User_has_User_Email_uc", "User_has_User_Email_pid",
        "User_has_User_Email_mand", "User_has_User_Email_mand_e"]
    # no reference mode, no identity to define
    assert _canon(("Thing", "")) == ([("instanceOf", ("Thing", "ObjectType"))], [])
