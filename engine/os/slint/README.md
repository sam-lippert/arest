# arest-slint — the Slint platform (#124)

Sam, 2026-10-01: "I want a slint registration surface in Rust the same way
there should be a wpf registration in C# and a react registration for web."
A platform is a shim that registers its paired controls, hands each event to
lambda and draws what lambda answers, and nothing else (Sam, 2026-09-20). This
crate is the Rust one, the sibling of ui.do's `src/render`,
`tools/java-runner/Gui.java` and `tools/wpf-runner`:

- **The registration** (`src/lib.rs`): `render:<kind>` for the nineteen iFactr
  interfaces lambda places, each drawn by an element of `ui/ifactr.slint`, and
  the layout engine `render:slint` (Render Target 'slint'), `screen`: the
  view's chrome above its content, every cell at the rectangle lambda placed
  it, a grid cell's children at its origin above it. A row naming a kind no
  element draws is refused by name.
- **Its IPlatformDefaults**: the iFactr margins and the fonts of Slint's
  std-widgets style.
- **The one call**: `navigate` over a `Transport` -- `Http`, the serving host's
  `POST /navigate`, here. A write is a request of the same interface: a form's
  Submit sends its values with its link (IListView.Submit) and main:api commits
  or refuses it, the refusal drawn as the IAlert.
- **The container** (`Container`): the platform, its Slint window, and every
  event a widget raises sent to lambda as one navigate.

The screen is drawn by Slint's software renderer into a pixel buffer
(`Headless`, `render_rgba`), which is what engine/os's UEFI framebuffer shows
and what the tests measure. The crate is its own cargo root, not a member of
engine/os, whose image compiles the whole of lambda through arest-host: wiring
it into the `full` image needs a transport that asks lambda in-process there,
since the OS has no other host to ask, and a QEMU run to see it.

    cargo test --offline -- --nocapture
    AREST_PORT=8787 AREST_SNAPSHOT_DIR=<dir> cargo test --offline -- --nocapture

The first draws every interface from rows as lambda places them and measures
each one's pixels; with a serving host it also navigates the root, a
collection, an entity and an entry form, clicks into the form's field, types,
clicks save, and writes each frame to a PNG.
