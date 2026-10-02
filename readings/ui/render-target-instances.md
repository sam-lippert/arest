# AREST UI: Render Target instances — the installed render-function registry

<!-- This reading carries the Render Target INSTANCE population — the rows
     `render_via_targets` (`command.rs`) walks to dispatch a rendering. It was
     split out of the always-loaded schema reading `render-target.md` for
     view-tree-shaking (2026-06): the Render Target NOUN + its fact types stay
     in the base (every app can SEE the schema), but the instances ride this
     per-app OVERLAY (`UI_VIEW_READINGS` in lib.rs) so they land ONLY for an
     app that declares `App 'slug' uses Render Surface 'surface'`. -->

A UI-less agent (tasks / claude / arc-agi-3) never loads this file, so
`Render_Target_has_Platform_Function_Name` is empty and
`render_via_targets` returns no representations — the pure-CRM no-op the
engine already implements. Adding a target platform is still one new
Render Target instance here plus one installed function; no per-app glue.

The schema this populates lives in `render-target.md` (the Render Target
noun, `Render Target has Platform Function Name`, `… emits MimeType`,
`… has display- Title`, `… has Description`).

## Instance Facts

<!-- This file's part of the domain: The installed Render Target instance population that render_via_targets dispatches against -- split out of render-target.md as a per-app overlay.
     The sentence below is readings/ui/ui.md:403 repeated verbatim.
     core.md:220 makes Description functional, so a domain carries ONE
     text and an identical sentence is the identical fact. -->
Domain 'ui' has Description 'Platform-agnostic view hierarchy, navigation, and controls. Custom renderers registered per platform via the factory pattern.'.

### Render Target: the reference HTML renderer

Render Target 'html' has Platform Function Name 'render:html'.
Render Target 'html' emits MimeType 'text/html'.
Render Target 'html' has display- Title 'Reference HTML renderer'.
Render Target 'html' has Description 'Engine-installed reference render function: walks the ViewProjection elements in Order, emits one labeled widget per Component Role (text-input, date-picker, checkbox, combo-box) and one rel=transition anchor per HATEOAS affordance. Pure function of its input; knows nouns and widgets, never apps.'.

<!-- ONE RENDER TARGET PER PLATFORM (2026-10-02, #124). A platform is its
     paired controls plus its own layout engine, the function from a
     screen's placed rows to what the platform shows; the engine is the
     Platform Function Name below, declared registered in
     metamodel/resolution.md, and a container registers it beside the
     nineteen controls. None of these three emits a MimeType: each hands its
     widgets straight to its toolkit. -->

### Render Target: the Swing container

Render Target 'swing' has Platform Function Name 'render:swing'.
Render Target 'swing' has display- Title 'Swing container'.
Render Target 'swing' has Description 'The Java container (tools/java-runner): draws the placed rows lambda answers for a screen as Swing components at their rectangles, with the Swing fonts and metrics it registers as its platform defaults.'.

### Render Target: the WPF container

Render Target 'wpf' has Platform Function Name 'render:wpf'.
Render Target 'wpf' has display- Title 'WPF container'.
Render Target 'wpf' has Description 'The C# container: draws the placed rows lambda answers for a screen as WPF elements on a Canvas at their rectangles, as the iFactr WPF binding registers one element per interface.'.

### Render Target: the Slint surface

Render Target 'slint' has Platform Function Name 'render:slint'.
Render Target 'slint' has display- Title 'Slint surface'.
Render Target 'slint' has Description 'The Rust container (engine/os): draws the placed rows lambda answers for a screen as Slint elements at their rectangles, through the software renderer into a pixel buffer, which is what the UEFI framebuffer shows.'.
