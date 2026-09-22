# AREST UI: Component Registry

This reading defines UI widgets across every supported toolkit as
FORML 2 fact types and instances. The user's framing: **why couldn't
QT or GTK components be registered like anything else?** Every widget,
in every toolkit, becomes a `Component` cell. Apps compose components
without caring about which toolkit provides them. AI agents query
"I need a date picker for compact density on touch" and the metamodel
scores `Component` cells against `MonoView` constraints (#457a) and
the design tokens (#432) to return the best toolkit-side
implementation.

This reading lands the registry shape and the seeded population. The
adapter implementations sequence after as separate slices: #486
(Slint adapter), #487 (Qt adapter via the linuxkpi shim from #460),
#488 (GTK adapter), #489-#490 (composition + event-loop runtime),
#491 (property/signal binding), #492 (selection-rule library
expansion), #493 (MCP `select_component` verb), #494 (web tier via
ui.do). End state: AREST is the first OS where the widget toolkit is
a runtime fact, queryable + AI-selectable per render context.

This reading is additive over `readings/ui/design.md` (the design-
token layer), `readings/ui/monoview.md` (the per-app surface), and
`readings/ui/ui.md` (the platform-agnostic view hierarchy). The
selection rules at the end consume `Density Scale`, `Interaction
Mode`, and `A11y Profile` from the MonoView reading without
restating their value-type populations.

## Entity Types

Component(.Name) is an entity type.
  <!-- Abstract widget type, identified by a stable slug like
       'button' or 'date-picker'. The Role role pins the canonical
       widget category — buttons vs date pickers vs lists — so apps
       and selection rules query by what the widget is for, not by
       which toolkit happens to provide it. -->

Toolkit(.Name) is an entity type.
  <!-- Toolkit-as-a-noun: Slint, Qt 6, GTK 4, Web Components. Each
       is a peer; Slint's only privilege is that it ships in the
       kernel by default. The .Name reference mode is the toolkit
       slug; .Version lifts onto the toolkit through a separate fact
       below so the same Toolkit row can carry per-instance version
       metadata. -->

ImplementationBinding(.Name) is an entity type.
  <!-- Anchor for a (Component, Toolkit, Symbol) triple. The Symbol
       value is the toolkit-side identifier the adapter should
       resolve at instantiation time — Slint type name, Qt class
       name, GTK type name, web tag. The anchor noun lets selection
       rules attach traits and per-binding metadata to a specific
       implementation rather than to the abstract Component or to
       the Toolkit alone. -->

Notice(.Slug) is an entity type.
  <!-- Reused from readings/compat/wine.md (#463). A short user-
       facing advisory the runtime surfaces when a selection
       constraint cannot be satisfied (e.g. 'no implementation for
       role X on this toolkit'). -->

## Value Types

Component Role is a value type.
  The possible values of Component Role are
    'button', 'text-input', 'list', 'date-picker', 'dialog',
    'image', 'slider', 'combo-box', 'progress-bar', 'checkbox',
    'tab', 'menu', 'card',
    'canvas', 'header-bar', 'title-text', 'section-header',
    'separator', 'list-item', 'block-text', 'navigation-field',
    'number-input', 'time-picker', 'text-area', 'image-picker',
    'label'.
  <!-- Closed enumeration of the canonical widget categories this
       slice seeds. New roles are added by extending the enumeration
       and seeding at least one ImplementationBinding for the role.
       The selection rules below treat Role as an opaque key — they
       never branch on the literal value, so the enumeration grows
       without rule edits. -->

Toolkit Slug is a value type.
  The possible values of Toolkit Slug are
    'slint', 'qt6', 'gtk4', 'web-components', 'react'.
  <!-- Closed enumeration of the toolkits this slice supports. The
       linuxkpi shim (#460) is the substrate for 'qt6' and 'gtk4';
       'web-components' attaches via the ui.do tier (#494). 'slint'
       is the kernel-native default. -->

Toolkit Version is a value type.
  <!-- Free-form version string — '1.7' for Slint, '6.6' for Qt,
       '4.14' for GTK, 'living-standard' for web. The runtime
       (#489) treats the string as opaque; the adapter slices
       (#486-#488, #494) parse it per-toolkit. -->

Toolkit Symbol is a value type.
  <!-- The toolkit-side identifier the adapter resolves. Examples:
       'Button' for Slint (the .slint type name), 'QPushButton' for
       Qt (the C++ class name), 'GtkButton' for GTK (the GObject
       type name), '<button>' for web (the HTML tag). The string is
       opaque to the readings checker; each adapter validates it
       against its own surface. -->

Property Name is a value type.
  <!-- Property identifier on a Component, e.g. 'text', 'enabled',
       'value'. Conventionally lowercase; the readings checker does
       not enforce case. -->

Property Type is a value type.
  The possible values of Property Type are
    'string', 'int', 'bool', 'enum', 'color', 'length', 'image',
    'callback'.
  <!-- The value-shape categories a Component property can take.
       'color' resolves to a ColorToken (#432); 'length' to a
       Pixels-typed measurement; 'image' to an asset handle;
       'callback' to a closure with no payload (events carry the
       payload via ComponentEvent below). -->

Property Default is a value type.
  <!-- Free-form string, opaque to the readings checker. The
       binding runtime (#491) parses the literal per Property Type
       — '0' as int, 'false' as bool, '#000000' as color, etc. -->

Event Name is a value type.
  <!-- Event identifier on a Component, e.g. 'clicked', 'changed',
       'submitted'. -->

Event Payload Type is a value type.
  The possible values of Event Payload Type are
    'none', 'string', 'int', 'bool', 'point', 'key'.
  <!-- 'none' for fire-and-forget signals like 'clicked'; 'point'
       for pointer events; 'key' for keyboard events; the rest
       follow Property Type semantics. -->

Slot Name is a value type.
  The possible values of Slot Name are
    'children', 'leading', 'trailing', 'header', 'footer'.
  <!-- Content-projection points. 'children' is the default
       container slot; 'leading' / 'trailing' are flanking slots
       (icon-before-text, icon-after-text); 'header' / 'footer' are
       the per-component chrome slots. The runtime (#489) maps
       these onto each toolkit's native slot mechanism (Slint
       `@children`, Qt layouts, GTK boxes, web `<slot>`). -->

Component Trait is a value type.
  The possible values of Component Trait are
    'touch_optimized', 'keyboard_navigable', 'screen_reader_aware',
    'hidpi_native', 'theming_consumer', 'dark_mode_native',
    'compact_native', 'kernel_native'.
  <!-- Selection-relevant traits. 'touch_optimized' = the
       implementation has touch-first hit targets and gestures;
       'keyboard_navigable' = full keyboard access including focus
       ring; 'screen_reader_aware' = native AT-SPI / UIA exposure;
       'hidpi_native' = vector-clean at any DPR; 'theming_consumer'
       = honours design-token (#432) substitution; 'dark_mode_native'
       = follows the host theme without an app-side bridge;
       'compact_native' = degrades cleanly to compact density
       without a separate variant; 'kernel_native' = ships in the
       AREST kernel image (Slint only, today). The selection rules
       below score Component implementations against MonoView
       constraints by counting Trait matches. -->

Notice Text is a value type.
  <!-- Short human-readable string, the body of a Notice instance.
       Mirrors the value type from readings/compat/wine.md (#463). -->

## Fact Types

### Component

Component has Component Role.
  Each Component has exactly one Component Role.

Component has display- Title.
  Each Component has at most one display- Title.

Component has Description.
  Each Component has at most one Description.

### Toolkit

Toolkit has Toolkit Slug.
  Each Toolkit has exactly one Toolkit Slug.

Toolkit has Toolkit Version.
  Each Toolkit has at most one Toolkit Version.

Toolkit has display- Title.
  Each Toolkit has at most one display- Title.

### ImplementationBinding (Component × Toolkit × Symbol)

Component is implemented by Toolkit at Toolkit Symbol.
  Each Component, Toolkit combination occurs at most once in the
    population of Component is implemented by Toolkit at Toolkit Symbol.
  <!-- Ternary fact type with composite-role uniqueness over
       (Component, Toolkit). The Symbol role pins the toolkit-side
       identifier the adapter resolves. The (Component, Toolkit)
       uniqueness keeps each toolkit's mapping injective per
       Component — a single Component cannot have two Slint
       Symbols, but it absolutely can have one Slint, one Qt, one
       GTK, and one web Symbol in parallel. This is the same
       composite-role trick BBBB uses for `Wine App requires DLL
       Override of DLL Name with DLL Behavior` in
       readings/compat/wine.md (#463). -->

ImplementationBinding pivots Component is implemented by Toolkit at Toolkit Symbol.
  <!-- Lifts the (Component, Toolkit, Symbol) triple into the
       entity space so traits attach somewhere. Each
       ImplementationBinding instance corresponds to exactly one
       row in the ternary population. The .Name reference mode is
       a derived slug of the form '<component>.<toolkit>'. -->

### Component properties (ternary with composite role)

Component has Property of Property Type with Property Default.
  Each Component, Property Name combination occurs at most once in the
    population of Component has Property of Property Type with Property Default.
  <!-- Ternary fact type with composite-role uniqueness over
       (Component, Property Name). The Type role pins the value-
       shape category; the Default role carries the as-declared
       literal. The (Component, Property) uniqueness mirrors how
       widget toolkits actually behave — a single property name
       has exactly one declared type and at most one default per
       widget. Toolkit-specific divergence (e.g. a Qt `text`
       property that takes an HTML-formatted string vs Slint's
       plain text) is handled at the adapter layer (#491), not
       in the registry. -->

Component property has Property Name.
  <!-- Compact projection accessor for the Property Name role of
       the ternary above. The readings checker treats this as the
       canonical handle the selection rules and adapters use to
       refer to a single property within a Component. -->

### Component events (ternary with composite role)

Component emits Event Name with Event Payload Type.
  Each Component, Event Name combination occurs at most once in the
    population of Component emits Event Name with Event Payload Type.
  <!-- Ternary fact type with composite-role uniqueness over
       (Component, Event Name). The Payload role pins the value
       carried with the signal. The (Component, Event) uniqueness
       matches widget signal semantics — 'clicked' on a Button
       fires one payload shape, not two. Cross-toolkit event-name
       harmonisation (Qt's `clicked()` vs GTK's `clicked` vs the
       web `click` event vs Slint's `clicked` callback) is handled
       at the adapter layer; the registry name is the canonical
       cross-toolkit identifier. -->

### Component slots

Component has Slot Name.
  Each Component, Slot Name combination occurs at most once in the population of Component has Slot Name.
  <!-- Many-per-Component, M:N over Slot Name (a single Component
       can expose `children` + `leading` + `trailing` + ...). The
       runtime (#489) projects content into each slot through the
       toolkit-native mechanism. -->

### Component traits (binary, M:N)

Component has Component Trait.
  Each Component, Component Trait combination occurs at most once in the population of Component has Component Trait.
  <!-- Many-per-Component over Component Trait. Selection rules
       score implementations by counting trait matches against the
       MonoView constraints. Traits are declared on the abstract
       Component when the trait is universal across all toolkit
       implementations of that role; toolkit-specific trait
       overrides attach to the ImplementationBinding instead via
       the next fact type. -->

ImplementationBinding has Component Trait.
  Each ImplementationBinding, Component Trait combination occurs at most once in the population of ImplementationBinding has Component Trait.
  <!-- Per-binding trait override. When a single toolkit's
       implementation diverges from the abstract Component's trait
       set (e.g. GtkButton has `screen_reader_aware` but the
       Slint Button does not — yet), the binding-scoped trait
       wins. The selection rule unions the abstract Component
       traits with the binding-scoped traits before scoring. -->

### Notices

Notice has Notice Text.
  Each Notice has exactly one Notice Text.

Component Role requires Notice.
  <!-- Many-per-Role: the gap-detection rule below contributes a
       Notice when a role has no ImplementationBinding for some
       Toolkit. The runtime (#493) surfaces these via the MCP
       `select_component` verb so AI agents see the gap and route
       around it. -->

## Constraints

Each Component has exactly one Component Role.
Each Toolkit has exactly one Toolkit Slug.

No two Components share the same Name.
No two Toolkits share the same Toolkit Slug.

Each Component, Toolkit combination occurs at most once in the
  population of Component is implemented by Toolkit at Toolkit Symbol.

Each Component, Property Name combination occurs at most once in the
  population of Component has Property of Property Type with Property Default.

Each Component, Event Name combination occurs at most once in the
  population of Component emits Event Name with Event Payload Type.

## Deontic Constraints

It is obligatory that each Component has some Component Role.
It is obligatory that each Component has some ImplementationBinding
  for some Toolkit.
It is obligatory that each Toolkit has some Toolkit Version.

## Derivation Rules

### Touch density preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default Interaction Mode 'touch'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Component has Component Trait 'touch_optimized'.
  <!-- Touch-first MonoViews score implementations whose Component
       declares the touch_optimized trait above un-tagged peers.
       The MMM #457a reading already derives `default Density Scale
       'spacious'` from `default Interaction Mode 'touch'`, so this
       rule composes — a touch MonoView gets spacious density AND
       the touch-optimized component variant. -->

### Screen-reader / GTK preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default A11y Profile 'screen-reader-aware'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Toolkit has Toolkit Slug 'gtk4'
    and ImplementationBinding has Component Trait 'screen_reader_aware'.
  <!-- GTK 4's AT-SPI integration is the most mature in the
       supported set; Qt's accessibility bridge works but requires
       the QAccessible plumbing to be wired per-widget; Slint's
       AT-SPI exposure is in-progress. Until the Slint side
       catches up, screen-reader-aware MonoViews route to GTK when
       a GTK binding exists for the requested role. The rule is
       Toolkit-conditional rather than role-conditional so it
       fires uniformly across Button, TextInput, Dialog, etc. -->

### Gap detection

+ Component Role (R) requires Notice 'no-implementation-for-role'
    if Component has Component Role (R)
    and no Component is implemented by Toolkit at Toolkit Symbol.
  <!-- Captures Components defined in the registry that have no
       toolkit binding at all. The runtime (#493) raises this as a
       loud warning at MCP-query time so AI agents see the gap
       instead of silently selecting a non-existent
       implementation. The follow-up adapter slices (#486-#488,
       #494) close gaps surfaced this way. -->

### Pointer-interaction preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default Interaction Mode 'pointer'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Component has Component Trait 'keyboard_navigable'.
  <!-- Pointer-driven MonoViews still benefit from keyboard-navigable
       widgets — mouse + keyboard share enough surface that focus
       rings and tab-order matter for any non-touch user. Keyboard-
       navigable bindings score above un-tagged peers. The rule does
       not exclude touch_optimized peers; the touch rule above is
       gated by Interaction Mode 'touch' so the two cannot fire on
       the same MonoView. -->

### Keyboard-interaction preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default Interaction Mode 'keyboard'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Component has Component Trait 'keyboard_navigable'.
  <!-- Keyboard-only MonoViews (REPLs, terminal-host surfaces) require
       full keyboard navigation. The trait is mandatory for the
       binding to be considered, not just preferred — but FORML 2
       derivation rules express preference, not exclusion, so the
       scoring layer in #493 treats this as the strongest signal. -->

+ ImplementationBinding is preferred for MonoView
    if MonoView has default Interaction Mode 'keyboard'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and ImplementationBinding has Component Trait 'compact_native'.
  <!-- Keyboard MonoViews additionally favour compact_native bindings:
       keyboard-driven workflows pack more surface per pixel than
       touch and rarely need 44px hit targets. The two rules compose
       additively — a Qt LineEdit with both keyboard_navigable
       (inherited from the abstract Component) and compact_native
       (per-binding override) scores 2 on a keyboard MonoView. -->

### Compact density preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default Density Scale 'compact'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and ImplementationBinding has Component Trait 'compact_native'.
  <!-- Compact density requests bindings whose declared trait set
       confirms a compact native variant (Qt's desktop defaults, GTK's
       legacy widget classes). Bindings without compact_native may
       still be selected — they just degrade through the runtime's
       density-substitution layer (#491) rather than rendering at
       their declared compact metric. -->

### Spacious density preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default Density Scale 'spacious'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Component has Component Trait 'touch_optimized'.
  <!-- Spacious density and touch optimisation correlate per the
       MonoView reading (#457a) — `default Density Scale 'spacious'`
       is itself derived from `default Interaction Mode 'touch'`.
       Restating the touch_optimized preference here lets MonoViews
       with explicit spacious density (without touch interaction)
       still pick up touch-optimised bindings. The two preference
       paths converge on the same scoring boost for touch MonoViews. -->

### High-contrast a11y preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default A11y Profile 'high-contrast'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Component has Component Trait 'theming_consumer'.
  <!-- High-contrast MonoViews require bindings that honour the
       active theme's design tokens (#432) — a hardcoded-color binding
       cannot react to a contrast-boosted ColorToken substitution.
       The theming_consumer trait is declared on the abstract
       Component when it applies uniformly across all toolkit
       implementations of that role; the rule fires through the
       Component side of the union. -->

### Reduced-motion / Slint preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default A11y Profile 'reduced-motion'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Toolkit has Toolkit Slug 'slint'.
  <!-- Reduced-motion MonoViews route away from Qt's QtQuick-based
       widgets (where animations are baked into the rendering path
       and difficult to suppress per-instance). Slint and GTK 4 both
       degrade gracefully under reduced-motion: Slint exposes
       per-animation toggles in the .slint surface, GTK 4 honours the
       desktop reduce-animations setting natively. The rule is
       expressed as two parallel preferences rather than as a single
       "Toolkit not in {Qt 6}" exclusion because FORML 2 derivation
       antecedents do not admit set-difference idioms — see CCCC's
       #483 wine.md note on regex / set-membership replacement with
       enumerated `belongs to` joins. -->

### Reduced-motion / GTK 4 preference

+ ImplementationBinding is preferred for MonoView
    if MonoView has default A11y Profile 'reduced-motion'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Toolkit has Toolkit Slug 'gtk4'.
  <!-- Companion to the Slint reduced-motion rule above. GTK 4's
       reduce-animations preference is wired through GtkSettings
       and propagates to every widget; a reduced-motion MonoView
       gets GTK widgets without an app-side bridge. -->

### Kernel-resident Slint preference

+ ImplementationBinding is preferred for MonoView
    if ImplementationBinding pivots Component is implemented by Toolkit
    and Toolkit has Toolkit Slug 'slint'
    and ImplementationBinding has Component Trait 'kernel_native'.
  <!-- The kernel ships Slint in-image (#486 wired the adapter at
       boot — commit 28e1961). Every other toolkit pays a heap +
       process + IPC cost the Slint binding does not. When a Component
       has any Slint binding at all, prefer it over the heavier
       toolkits absent a stronger signal pulling the other way (a11y,
       density, interaction). The kernel_native trait is the gate —
       a hypothetical Slint binding that did NOT ship in the kernel
       image (e.g. a downloadable Slint plugin) would not collect
       this preference. -->

### Single-toolkit role wins by default

+ ImplementationBinding is preferred for MonoView
    if ImplementationBinding pivots Component is implemented by Toolkit (T1)
    and Component has Component Role (R)
    and no other Toolkit (T2) is such that some Component has Component Role (R)
        and that Component is implemented by Toolkit (T2).
  <!-- Makes the gap-detection rule's complement explicit for the
       chainer: when only one toolkit has a binding for a role, that
       binding wins regardless of MonoView constraints. The form
       mirrors the gap-detection rule's `no Component is implemented
       by Toolkit` negation idiom — FORML 2 antecedents support
       `no <other Object Type> is such that ...` set-emptiness checks but
       not numeric cardinality. The runtime (#493) still surfaces a
       soft-warning Notice if the resulting toolkit conflicts with
       the MonoView's preferred toolkit family — the user gets the
       working widget plus a "this is the only option for this role
       on this surface" advisory. -->

### Surface Tier overlay -> Web Components

+ ImplementationBinding is preferred for MonoView
    if Region belongs to MonoView
    and Region has Surface Tier 'overlay'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Toolkit has Toolkit Slug 'web-components'.
  <!-- Hypothetical, scoped to the ui.do tier (#494) where the host
       is the browser DOM. Overlay-tier surfaces (popovers, command
       palettes, tooltips) ride on the platform's z-index + stacking-
       context machinery; CSS overlay handling is the most mature
       implementation surface across the supported toolkits. On the
       kernel-host side this rule contributes nothing because no
       Region routes to web-components without an explicit ui.do
       crossover (#494) — the runtime simply ignores the preference
       when the toolkit is not loaded. -->

### Surface Tier panel preference

+ ImplementationBinding is preferred for MonoView
    if Region belongs to MonoView
    and Region has Surface Tier 'panel'
    and ImplementationBinding pivots Component is implemented by Toolkit
    and Component has Component Trait 'theming_consumer'.
  <!-- Panel-tier surfaces (sidebars, footers, command bars) carry
       the bulk of the design-token surface area; theming-consumer
       bindings let token edits propagate without per-binding adapter
       work. Backdrop and drop-shadow tiers do not get the same
       boost because their visual contribution is closer to "fill
       region with surface color" — token discipline matters less. -->

### Dark theme preference

+ ImplementationBinding is preferred for MonoView
    if Theme has Theme Mode 'dark'
    and Theme is the default Theme
    and ImplementationBinding pivots Component is implemented by Toolkit
    and ImplementationBinding has Component Trait 'dark_mode_native'.
  <!-- Honours the design system's default Theme (#432, currently the
       dark Theme). Dark-mode-native bindings follow the host's color
       scheme without an app-side bridge — GTK 4's whole-application
       Adwaita dark, Slint's per-style theme, web's
       prefers-color-scheme. Bindings without the trait can still be
       selected; the runtime layer (#491) then routes design-token
       Hex Color values into them via the binding adapter. The
       Theme-conditional rule joins through the design.md reading
       (#432) without restating the Theme Mode population. -->

### Tie-breaker: deterministic Slint default

+ ImplementationBinding is preferred for MonoView
    if ImplementationBinding pivots Component is implemented by Toolkit
    and Toolkit has Toolkit Slug 'slint'.
  <!-- Final disambiguator. After all the above preferences score the
       candidate set, ties (multiple bindings with the same score)
       resolve to Slint deterministically. This is intentionally the
       weakest preference — every prior rule that names a non-Slint
       trait or toolkit overrides it — but it guarantees the chainer
       always picks one binding without consulting external state.
       The runtime (#493) leans on this for property-test
       reproducibility: the same (Component Role, MonoView,
       A11yProfile, Theme) tuple resolves to the same binding across
       runs, regardless of fact-population insertion order. -->

## Instance Facts

Domain 'ui' has Description 'Component registry — UI widgets across Slint, Qt 6, GTK 4, and Web Components as FORML 2 facts. Apps compose by Component Role; the metamodel selects per-toolkit implementations against MonoView constraints (#457a) and design tokens (#432). Substrate for #486-#494.'.

### Toolkits

Toolkit 'slint' has Toolkit Slug 'slint'.
Toolkit 'slint' has Toolkit Version '1.7'.
Toolkit 'slint' has display- Title 'Slint'.

Toolkit 'qt6' has Toolkit Slug 'qt6'.
Toolkit 'qt6' has Toolkit Version '6.6'.
Toolkit 'qt6' has display- Title 'Qt 6'.

Toolkit 'gtk4' has Toolkit Slug 'gtk4'.
Toolkit 'gtk4' has Toolkit Version '4.14'.
Toolkit 'gtk4' has display- Title 'GTK 4'.

Toolkit 'react' has Toolkit Slug 'react'.
Toolkit 'react' has Toolkit Version '19'.
Toolkit 'react' has display- Title 'React'.
  <!-- The Cloudflare-site toolkit (Samuel, 2026-07-08: support deploys
       as a react site; binding is bidirectional — facts render through
       the element trees, events apply through the transition routes).
       Its render target is the JSON view emitter: a react component
       consumes the TREE plus the apply endpoint and nothing else. -->

Toolkit 'web-components' has Toolkit Slug 'web-components'.
Toolkit 'web-components' has Toolkit Version 'living-standard'.
Toolkit 'web-components' has display- Title 'Web Components'.

### Notice anchors

Notice 'no-implementation-for-role' has Notice Text 'No toolkit implementation registered for the requested Component Role; the gap-detection rule fired. Adapter slices #486-#488 and #494 close gaps surfaced this way.'.

### Component: Button

Component 'button' has Component Role 'button'.
Component 'button' has display- Title 'Button'.
Component 'button' has Description 'Plain push button — primary control for triggering an action.'.

Component 'button' has Property 'text' of Property Type 'string' with Property Default ''.
Component 'button' has Property 'enabled' of Property Type 'bool' with Property Default 'true'.
Component 'button' has Property 'primary' of Property Type 'bool' with Property Default 'false'.

Component 'button' emits Event Name 'clicked' with Event Payload Type 'none'.

Component 'button' has Slot Name 'leading'.
Component 'button' has Slot Name 'trailing'.

Component 'button' has Component Trait 'keyboard_navigable'.
Component 'button' has Component Trait 'theming_consumer'.

Component 'button' is implemented by Toolkit 'slint' at Toolkit Symbol 'Button'.
ImplementationBinding 'button.slint' pivots Component 'button' is implemented by Toolkit 'slint'.
ImplementationBinding 'button.slint' has Component Trait 'kernel_native'.
ImplementationBinding 'button.slint' has Component Trait 'hidpi_native'.
ImplementationBinding 'button.slint' has Component Trait 'dark_mode_native'.

Component 'button' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QPushButton'.
ImplementationBinding 'button.qt6' pivots Component 'button' is implemented by Toolkit 'qt6'.
ImplementationBinding 'button.qt6' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'button.qt6' has Component Trait 'hidpi_native'.
ImplementationBinding 'button.qt6' has Component Trait 'compact_native'.

Component 'button' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkButton'.
ImplementationBinding 'button.gtk4' pivots Component 'button' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'button.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'button.gtk4' has Component Trait 'hidpi_native'.
ImplementationBinding 'button.gtk4' has Component Trait 'dark_mode_native'.

Component 'button' is implemented by Toolkit 'web-components' at Toolkit Symbol '<button>'.
ImplementationBinding 'button.web' pivots Component 'button' is implemented by Toolkit 'web-components'.
ImplementationBinding 'button.web' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'button.web' has Component Trait 'hidpi_native'.
ImplementationBinding 'button.web' has Component Trait 'touch_optimized'.

### Component: TextInput

Component 'text-input' has Component Role 'text-input'.
Component 'text-input' has display- Title 'Text Input'.
Component 'text-input' has Description 'Single-line text entry field.'.

Component 'text-input' has Property 'text' of Property Type 'string' with Property Default ''.
Component 'text-input' has Property 'placeholder' of Property Type 'string' with Property Default ''.
Component 'text-input' has Property 'enabled' of Property Type 'bool' with Property Default 'true'.
Component 'text-input' has Property 'maxlength' of Property Type 'int' with Property Default '0'.

Component 'text-input' emits Event Name 'changed' with Event Payload Type 'string'.
Component 'text-input' emits Event Name 'submitted' with Event Payload Type 'string'.

Component 'text-input' has Slot Name 'leading'.
Component 'text-input' has Slot Name 'trailing'.

Component 'text-input' has Component Trait 'keyboard_navigable'.
Component 'text-input' has Component Trait 'theming_consumer'.

Component 'text-input' is implemented by Toolkit 'slint' at Toolkit Symbol 'Input'.
ImplementationBinding 'text-input.slint' pivots Component 'text-input' is implemented by Toolkit 'slint'.
ImplementationBinding 'text-input.slint' has Component Trait 'kernel_native'.
ImplementationBinding 'text-input.slint' has Component Trait 'dark_mode_native'.

Component 'text-input' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QLineEdit'.
ImplementationBinding 'text-input.qt6' pivots Component 'text-input' is implemented by Toolkit 'qt6'.
ImplementationBinding 'text-input.qt6' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'text-input.qt6' has Component Trait 'compact_native'.

Component 'text-input' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkEntry'.
ImplementationBinding 'text-input.gtk4' pivots Component 'text-input' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'text-input.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'text-input.gtk4' has Component Trait 'dark_mode_native'.

Component 'text-input' is implemented by Toolkit 'web-components' at Toolkit Symbol '<input type=text>'.
ImplementationBinding 'text-input.web' pivots Component 'text-input' is implemented by Toolkit 'web-components'.
ImplementationBinding 'text-input.web' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'text-input.web' has Component Trait 'touch_optimized'.

### Component: ListView

Component 'list' has Component Role 'list'.
Component 'list' has display- Title 'List View'.
Component 'list' has Description 'Vertically-scrolling list of homogeneous items.'.

Component 'list' has Property 'items' of Property Type 'string' with Property Default ''.
Component 'list' has Property 'selected' of Property Type 'int' with Property Default '-1'.

Component 'list' emits Event Name 'selection-changed' with Event Payload Type 'int'.

Component 'list' has Slot Name 'children'.
Component 'list' has Slot Name 'header'.
Component 'list' has Slot Name 'footer'.

Component 'list' has Component Trait 'keyboard_navigable'.
Component 'list' has Component Trait 'theming_consumer'.

Component 'list' is implemented by Toolkit 'slint' at Toolkit Symbol 'List'.
ImplementationBinding 'list.slint' pivots Component 'list' is implemented by Toolkit 'slint'.
ImplementationBinding 'list.slint' has Component Trait 'kernel_native'.
ImplementationBinding 'list.slint' has Component Trait 'dark_mode_native'.

Component 'list' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QListView'.
ImplementationBinding 'list.qt6' pivots Component 'list' is implemented by Toolkit 'qt6'.
ImplementationBinding 'list.qt6' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'list.qt6' has Component Trait 'compact_native'.

Component 'list' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkListView'.
ImplementationBinding 'list.gtk4' pivots Component 'list' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'list.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'list.gtk4' has Component Trait 'dark_mode_native'.

### Component: DatePicker

Component 'date-picker' has Component Role 'date-picker'.
Component 'date-picker' has display- Title 'Date Picker'.
Component 'date-picker' has Description 'Calendar-driven date selection. No Slint binding in this slice — #486 will surface the gap as a TODO once it scans MMM\'s actual surface (#436).'.

Component 'date-picker' has Property 'value' of Property Type 'string' with Property Default ''.
Component 'date-picker' has Property 'enabled' of Property Type 'bool' with Property Default 'true'.

Component 'date-picker' emits Event Name 'changed' with Event Payload Type 'string'.

Component 'date-picker' has Component Trait 'keyboard_navigable'.

Component 'date-picker' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QDateEdit'.
ImplementationBinding 'date-picker.qt6' pivots Component 'date-picker' is implemented by Toolkit 'qt6'.
ImplementationBinding 'date-picker.qt6' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'date-picker.qt6' has Component Trait 'compact_native'.

Component 'date-picker' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkCalendar'.
ImplementationBinding 'date-picker.gtk4' pivots Component 'date-picker' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'date-picker.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'date-picker.gtk4' has Component Trait 'dark_mode_native'.

Component 'date-picker' is implemented by Toolkit 'web-components' at Toolkit Symbol '<input type=date>'.
ImplementationBinding 'date-picker.web' pivots Component 'date-picker' is implemented by Toolkit 'web-components'.
ImplementationBinding 'date-picker.web' has Component Trait 'touch_optimized'.
ImplementationBinding 'date-picker.web' has Component Trait 'screen_reader_aware'.

### Component: Card

Component 'card' has Component Role 'card'.
Component 'card' has display- Title 'Card'.
Component 'card' has Description 'Surfaced container with optional header / footer chrome. The Slint binding is the MMM #436 stock card.'.

Component 'card' has Property 'elevation' of Property Type 'int' with Property Default '1'.
Component 'card' has Property 'padding' of Property Type 'length' with Property Default '16'.

Component 'card' has Slot Name 'children'.
Component 'card' has Slot Name 'header'.
Component 'card' has Slot Name 'footer'.

Component 'card' has Component Trait 'theming_consumer'.

Component 'card' is implemented by Toolkit 'slint' at Toolkit Symbol 'Card'.
ImplementationBinding 'card.slint' pivots Component 'card' is implemented by Toolkit 'slint'.
ImplementationBinding 'card.slint' has Component Trait 'kernel_native'.
ImplementationBinding 'card.slint' has Component Trait 'hidpi_native'.

Component 'card' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkBox'.
ImplementationBinding 'card.gtk4' pivots Component 'card' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'card.gtk4' has Component Trait 'dark_mode_native'.

### Component: Dialog

Component 'dialog' has Component Role 'dialog'.
Component 'dialog' has display- Title 'Dialog'.
Component 'dialog' has Description 'Modal overlay window for transient interaction (confirm, alert, form-on-overlay).'.

Component 'dialog' has Property 'title' of Property Type 'string' with Property Default ''.
Component 'dialog' has Property 'open' of Property Type 'bool' with Property Default 'false'.

Component 'dialog' emits Event Name 'closed' with Event Payload Type 'none'.
Component 'dialog' emits Event Name 'confirmed' with Event Payload Type 'none'.

Component 'dialog' has Slot Name 'children'.
Component 'dialog' has Slot Name 'footer'.

Component 'dialog' has Component Trait 'keyboard_navigable'.
Component 'dialog' has Component Trait 'theming_consumer'.

Component 'dialog' is implemented by Toolkit 'slint' at Toolkit Symbol 'Dialog'.
ImplementationBinding 'dialog.slint' pivots Component 'dialog' is implemented by Toolkit 'slint'.
ImplementationBinding 'dialog.slint' has Component Trait 'kernel_native'.

Component 'dialog' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QDialog'.
ImplementationBinding 'dialog.qt6' pivots Component 'dialog' is implemented by Toolkit 'qt6'.
ImplementationBinding 'dialog.qt6' has Component Trait 'screen_reader_aware'.

Component 'dialog' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkDialog'.
ImplementationBinding 'dialog.gtk4' pivots Component 'dialog' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'dialog.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'dialog.gtk4' has Component Trait 'dark_mode_native'.

Component 'dialog' is implemented by Toolkit 'web-components' at Toolkit Symbol '<dialog>'.
ImplementationBinding 'dialog.web' pivots Component 'dialog' is implemented by Toolkit 'web-components'.
ImplementationBinding 'dialog.web' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'dialog.web' has Component Trait 'hidpi_native'.

### Component: Image

Component 'image' has Component Role 'image'.
Component 'image' has display- Title 'Image'.
Component 'image' has Description 'Static raster or vector image. Qt 6 reuses QLabel + pixmap because QImage is the data type, not the widget.'.

Component 'image' has Property 'source' of Property Type 'image' with Property Default ''.
Component 'image' has Property 'fit' of Property Type 'enum' with Property Default 'contain'.

Component 'image' has Component Trait 'theming_consumer'.

Component 'image' is implemented by Toolkit 'slint' at Toolkit Symbol 'Image'.
ImplementationBinding 'image.slint' pivots Component 'image' is implemented by Toolkit 'slint'.
ImplementationBinding 'image.slint' has Component Trait 'kernel_native'.
ImplementationBinding 'image.slint' has Component Trait 'hidpi_native'.

Component 'image' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QLabel'.
ImplementationBinding 'image.qt6' pivots Component 'image' is implemented by Toolkit 'qt6'.

Component 'image' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkPicture'.
ImplementationBinding 'image.gtk4' pivots Component 'image' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'image.gtk4' has Component Trait 'hidpi_native'.

Component 'image' is implemented by Toolkit 'web-components' at Toolkit Symbol '<img>'.
ImplementationBinding 'image.web' pivots Component 'image' is implemented by Toolkit 'web-components'.
ImplementationBinding 'image.web' has Component Trait 'hidpi_native'.

### Component: Slider

Component 'slider' has Component Role 'slider'.
Component 'slider' has display- Title 'Slider'.
Component 'slider' has Description 'Continuous numeric value selection along a track. Slint binding name is the expected MMM #436 surface; #486 will TODO if missing.'.

Component 'slider' has Property 'value' of Property Type 'int' with Property Default '0'.
Component 'slider' has Property 'minimum' of Property Type 'int' with Property Default '0'.
Component 'slider' has Property 'maximum' of Property Type 'int' with Property Default '100'.

Component 'slider' emits Event Name 'changed' with Event Payload Type 'int'.

Component 'slider' has Component Trait 'keyboard_navigable'.
Component 'slider' has Component Trait 'theming_consumer'.

Component 'slider' is implemented by Toolkit 'slint' at Toolkit Symbol 'Slider'.
ImplementationBinding 'slider.slint' pivots Component 'slider' is implemented by Toolkit 'slint'.
ImplementationBinding 'slider.slint' has Component Trait 'kernel_native'.

Component 'slider' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QSlider'.
ImplementationBinding 'slider.qt6' pivots Component 'slider' is implemented by Toolkit 'qt6'.
ImplementationBinding 'slider.qt6' has Component Trait 'screen_reader_aware'.

Component 'slider' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkScale'.
ImplementationBinding 'slider.gtk4' pivots Component 'slider' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'slider.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'slider.gtk4' has Component Trait 'dark_mode_native'.

Component 'slider' is implemented by Toolkit 'web-components' at Toolkit Symbol '<input type=range>'.
ImplementationBinding 'slider.web' pivots Component 'slider' is implemented by Toolkit 'web-components'.
ImplementationBinding 'slider.web' has Component Trait 'touch_optimized'.

### Component: ComboBox

Component 'combo-box' has Component Role 'combo-box'.
Component 'combo-box' has display- Title 'Combo Box'.
Component 'combo-box' has Description 'Dropdown selection from a closed list. No Slint binding in this slice — #486 will surface the gap.'.

Component 'combo-box' has Property 'items' of Property Type 'string' with Property Default ''.
Component 'combo-box' has Property 'selected' of Property Type 'int' with Property Default '-1'.

Component 'combo-box' emits Event Name 'selection-changed' with Event Payload Type 'int'.

Component 'combo-box' has Component Trait 'keyboard_navigable'.
Component 'combo-box' has Component Trait 'theming_consumer'.

Component 'combo-box' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QComboBox'.
ImplementationBinding 'combo-box.qt6' pivots Component 'combo-box' is implemented by Toolkit 'qt6'.
ImplementationBinding 'combo-box.qt6' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'combo-box.qt6' has Component Trait 'compact_native'.

Component 'combo-box' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkDropDown'.
ImplementationBinding 'combo-box.gtk4' pivots Component 'combo-box' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'combo-box.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'combo-box.gtk4' has Component Trait 'dark_mode_native'.

Component 'combo-box' is implemented by Toolkit 'web-components' at Toolkit Symbol '<select>'.
ImplementationBinding 'combo-box.web' pivots Component 'combo-box' is implemented by Toolkit 'web-components'.
ImplementationBinding 'combo-box.web' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'combo-box.web' has Component Trait 'touch_optimized'.

### Component: ProgressBar

Component 'progress-bar' has Component Role 'progress-bar'.
Component 'progress-bar' has display- Title 'Progress Bar'.
Component 'progress-bar' has Description 'Linear progress indicator with optional indeterminate mode.'.

Component 'progress-bar' has Property 'value' of Property Type 'int' with Property Default '0'.
Component 'progress-bar' has Property 'maximum' of Property Type 'int' with Property Default '100'.
Component 'progress-bar' has Property 'indeterminate' of Property Type 'bool' with Property Default 'false'.

Component 'progress-bar' has Component Trait 'theming_consumer'.

Component 'progress-bar' is implemented by Toolkit 'slint' at Toolkit Symbol 'ProgressIndicator'.
ImplementationBinding 'progress-bar.slint' pivots Component 'progress-bar' is implemented by Toolkit 'slint'.
ImplementationBinding 'progress-bar.slint' has Component Trait 'kernel_native'.
ImplementationBinding 'progress-bar.slint' has Component Trait 'dark_mode_native'.

Component 'progress-bar' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QProgressBar'.
ImplementationBinding 'progress-bar.qt6' pivots Component 'progress-bar' is implemented by Toolkit 'qt6'.
ImplementationBinding 'progress-bar.qt6' has Component Trait 'compact_native'.

Component 'progress-bar' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkProgressBar'.
ImplementationBinding 'progress-bar.gtk4' pivots Component 'progress-bar' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'progress-bar.gtk4' has Component Trait 'dark_mode_native'.

Component 'progress-bar' is implemented by Toolkit 'web-components' at Toolkit Symbol '<progress>'.
ImplementationBinding 'progress-bar.web' pivots Component 'progress-bar' is implemented by Toolkit 'web-components'.
ImplementationBinding 'progress-bar.web' has Component Trait 'screen_reader_aware'.

### Component: CheckBox

Component 'checkbox' has Component Role 'checkbox'.
Component 'checkbox' has display- Title 'Check Box'.
Component 'checkbox' has Description 'Bistate (or tristate) toggle bound to a label.'.

Component 'checkbox' has Property 'checked' of Property Type 'bool' with Property Default 'false'.
Component 'checkbox' has Property 'label' of Property Type 'string' with Property Default ''.
Component 'checkbox' has Property 'enabled' of Property Type 'bool' with Property Default 'true'.

Component 'checkbox' emits Event Name 'toggled' with Event Payload Type 'bool'.

Component 'checkbox' has Component Trait 'keyboard_navigable'.
Component 'checkbox' has Component Trait 'theming_consumer'.

Component 'checkbox' is implemented by Toolkit 'slint' at Toolkit Symbol 'CheckBox'.
ImplementationBinding 'checkbox.slint' pivots Component 'checkbox' is implemented by Toolkit 'slint'.
ImplementationBinding 'checkbox.slint' has Component Trait 'kernel_native'.
ImplementationBinding 'checkbox.slint' has Component Trait 'dark_mode_native'.

Component 'checkbox' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QCheckBox'.
ImplementationBinding 'checkbox.qt6' pivots Component 'checkbox' is implemented by Toolkit 'qt6'.
ImplementationBinding 'checkbox.qt6' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'checkbox.qt6' has Component Trait 'compact_native'.

Component 'checkbox' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkCheckButton'.
ImplementationBinding 'checkbox.gtk4' pivots Component 'checkbox' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'checkbox.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'checkbox.gtk4' has Component Trait 'dark_mode_native'.

Component 'checkbox' is implemented by Toolkit 'web-components' at Toolkit Symbol '<input type=checkbox>'.
ImplementationBinding 'checkbox.web' pivots Component 'checkbox' is implemented by Toolkit 'web-components'.
ImplementationBinding 'checkbox.web' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'checkbox.web' has Component Trait 'touch_optimized'.

### Component: Tab

Component 'tab' has Component Role 'tab'.
Component 'tab' has display- Title 'Tab Bar'.
Component 'tab' has Description 'Horizontal tab strip selecting one of N child surfaces. No Slint binding — #486 will TODO.'.

Component 'tab' has Property 'selected' of Property Type 'int' with Property Default '0'.
Component 'tab' has Property 'tabs' of Property Type 'string' with Property Default ''.

Component 'tab' emits Event Name 'selection-changed' with Event Payload Type 'int'.

Component 'tab' has Slot Name 'children'.

Component 'tab' has Component Trait 'keyboard_navigable'.
Component 'tab' has Component Trait 'theming_consumer'.

Component 'tab' is implemented by Toolkit 'qt6' at Toolkit Symbol 'QTabBar'.
ImplementationBinding 'tab.qt6' pivots Component 'tab' is implemented by Toolkit 'qt6'.
ImplementationBinding 'tab.qt6' has Component Trait 'screen_reader_aware'.

Component 'tab' is implemented by Toolkit 'gtk4' at Toolkit Symbol 'GtkNotebook'.
ImplementationBinding 'tab.gtk4' pivots Component 'tab' is implemented by Toolkit 'gtk4'.
ImplementationBinding 'tab.gtk4' has Component Trait 'screen_reader_aware'.
ImplementationBinding 'tab.gtk4' has Component Trait 'dark_mode_native'.
### The idealized controls canon emits, paired to React (#124)

<!-- WHICH SET IS THE IDEALIZED ONE, AND WHY. Two vocabularies meet here and
     only one of them is what a renderer is dispatched on.

     This reading's own Component population -- button, card, checkbox,
     combo-box, date-picker, dialog, image, list, progress-bar, slider, tab,
     text-input -- is a CATALOGUE for the selection question: "I need a date
     picker for compact density on touch", scored against MonoView constraints
     and design tokens. Nothing dispatches on it.

     Canon's control kinds are a different set and a different question. ui:place
     answers rows <control, x, y, w, h, payload...>; ui:render applies
     render:<control> to every row; ui:ctl_entry pairs each of the metamodel's
     31 Conceptual Data Types to one of ten typed kinds, and a screen's layout
     places nine more. law:ctl_declared reads the render: names out of the
     Function population and law:paired asks a container whether it registers
     every one of them. So the IDEALIZED SET IS CANON'S NINETEEN: they are the
     names a renderer is actually handed, and a container that pairs anything
     else is never called. Measured on the metamodel store: the address
     `new Function` places 175 rows over canvas, headerbar, titletext, textbox,
     navigationfield and button.

     THE OVERLAP IS REAL AND IS NOT A SYNONYM TABLE. Four of the nineteen name
     a category this reading already has -- textbox is a 'text-input',
     selectlist a 'combo-box', datepicker a 'date-picker', switch a 'checkbox'
     -- so they take that Role rather than a new one, and backbtn takes
     'button'. Thirteen roles are new because the catalogue had no word for a
     canvas, a separator or a list item. Each Component's NAME is canon's own
     control kind, unchanged, because the name is what render:<kind> is built
     from: a Component named 'text-input' could never be found from a row that
     says 'textbox' without a second table to consult, and a renderer that has
     to consult one has leaked the seam this reading exists to close.

     The layout engine is NOT a Component. A platform is its paired controls
     plus the engine that lays them out (iFactr), and that engine is the
     function from a screen's placed rows to a document -- render:html in
     metamodel/resolution.md, bound by the React container. What it draws is
     the canvas Component with the paired widgets inside it, so it needs no
     widget row of its own.

     AND IT REPLACES THE TREE, WHICH IS WHAT THE TOOLKIT ROW ABOVE STILL SAYS.
     Samuel, 2026-07-08, on Toolkit 'react': "Its render target is the JSON
     view emitter: a react component consumes the TREE plus the apply endpoint
     and nothing else." That is the older rendering -- ui:route's layer tree
     through system:render_html, which dispatches on 'menu', 'list' and
     'detail'. The pairing below is over the PLACED ROWS instead, because that
     is what ui:render applies render:<control> to and what law:paired is
     asked about. The tree renderer is not deleted here and nothing in this
     reading names it; which of the two the React tier draws is a decision,
     not a fact, and it is Sam's. -->


Component 'canvas' has Component Role 'canvas'.
Component 'canvas' has display- Title 'Canvas'.
Component 'canvas' has Description 'The screen surface a layer's placed rows are positioned inside. ui:arrange gives it the frame width and the content height; every other widget sits absolutely positioned within it.'.
Component 'canvas' is implemented by Toolkit 'react' at Toolkit Symbol 'Canvas'.
ImplementationBinding 'canvas.react' pivots Component 'canvas' is implemented by Toolkit 'react'.

Component 'headerbar' has Component Role 'header-bar'.
Component 'headerbar' has display- Title 'HeaderBar'.
Component 'headerbar' has Description 'The bar across the top of a screen, behind the title and the back affordance.'.
Component 'headerbar' is implemented by Toolkit 'react' at Toolkit Symbol 'HeaderBar'.
ImplementationBinding 'headerbar.react' pivots Component 'headerbar' is implemented by Toolkit 'react'.

Component 'titletext' has Component Role 'title-text'.
Component 'titletext' has display- Title 'TitleText'.
Component 'titletext' has Description 'The screen's title, drawn in the header bar. Payload: the title text.'.
Component 'titletext' is implemented by Toolkit 'react' at Toolkit Symbol 'TitleText'.
ImplementationBinding 'titletext.react' pivots Component 'titletext' is implemented by Toolkit 'react'.

Component 'backbtn' has Component Role 'button'.
Component 'backbtn' has display- Title 'BackButton'.
Component 'backbtn' has Description 'The affordance back to the previous address. Payload: the address, which the container turns into a link; the label is ui:style's backLabel.'.
Component 'backbtn' is implemented by Toolkit 'react' at Toolkit Symbol 'BackButton'.
ImplementationBinding 'backbtn.react' pivots Component 'backbtn' is implemented by Toolkit 'react'.

Component 'sectionheader' has Component Role 'section-header'.
Component 'sectionheader' has display- Title 'SectionHeader'.
Component 'sectionheader' has Description 'The caption above a run of item rows. Payload: the section's text.'.
Component 'sectionheader' is implemented by Toolkit 'react' at Toolkit Symbol 'SectionHeader'.
ImplementationBinding 'sectionheader.react' pivots Component 'sectionheader' is implemented by Toolkit 'react'.

Component 'sep' has Component Role 'separator'.
Component 'sep' has display- Title 'Separator'.
Component 'sep' has Description 'A one-pixel rule between item rows. No payload.'.
Component 'sep' is implemented by Toolkit 'react' at Toolkit Symbol 'Separator'.
ImplementationBinding 'sep.react' pivots Component 'sep' is implemented by Toolkit 'react'.

Component 'itemrow' has Component Role 'list-item'.
Component 'itemrow' has display- Title 'ItemRow'.
Component 'itemrow' has Description 'One row of a collection: text, optional subtext, and the address it navigates to. Payload: text, subtext, address.'.
Component 'itemrow' is implemented by Toolkit 'react' at Toolkit Symbol 'ItemRow'.
ImplementationBinding 'itemrow.react' pivots Component 'itemrow' is implemented by Toolkit 'react'.

Component 'blocktext' has Component Role 'block-text'.
Component 'blocktext' has display- Title 'BlockText'.
Component 'blocktext' has Description 'A preformatted block of text on a screen, wrapped and scrollable. Payload: the text.'.
Component 'blocktext' is implemented by Toolkit 'react' at Toolkit Symbol 'BlockText'.
ImplementationBinding 'blocktext.react' pivots Component 'blocktext' is implemented by Toolkit 'react'.

Component 'textbox' has Component Role 'text-input'.
Component 'textbox' has display- Title 'TextBox'.
Component 'textbox' has Description 'Single-line text entry. Payload: the field's label and the fact type name the value is posted under.'.
Component 'textbox' is implemented by Toolkit 'react' at Toolkit Symbol 'TextBox'.
ImplementationBinding 'textbox.react' pivots Component 'textbox' is implemented by Toolkit 'react'.

<!-- 'button' is already declared above; this is only its React binding. -->
Component 'button' is implemented by Toolkit 'react' at Toolkit Symbol 'Button'.
ImplementationBinding 'button.react' pivots Component 'button' is implemented by Toolkit 'react'.

Component 'selectlist' has Component Role 'combo-box'.
Component 'selectlist' has display- Title 'SelectList'.
Component 'selectlist' has Description 'A closed choice over the enumeration a value type declares. Payload: label, name, and the options.'.
Component 'selectlist' is implemented by Toolkit 'react' at Toolkit Symbol 'SelectList'.
ImplementationBinding 'selectlist.react' pivots Component 'selectlist' is implemented by Toolkit 'react'.

Component 'navigationfield' has Component Role 'navigation-field'.
Component 'navigationfield' has display- Title 'NavigationField'.
Component 'navigationfield' has Description 'A choice over the population of a referenced entity type -- the same closed choice as a select list, over ids rather than enum values. Payload: label, name, and the ids.'.
Component 'navigationfield' is implemented by Toolkit 'react' at Toolkit Symbol 'NavigationField'.
ImplementationBinding 'navigationfield.react' pivots Component 'navigationfield' is implemented by Toolkit 'react'.

Component 'numericfield' has Component Role 'number-input'.
Component 'numericfield' has display- Title 'NumericField'.
Component 'numericfield' has Description 'Numeric entry, for the integer, float, decimal and money Conceptual Data Types. Payload: label and name.'.
Component 'numericfield' is implemented by Toolkit 'react' at Toolkit Symbol 'NumericField'.
ImplementationBinding 'numericfield.react' pivots Component 'numericfield' is implemented by Toolkit 'react'.

Component 'datepicker' has Component Role 'date-picker'.
Component 'datepicker' has display- Title 'DatePicker'.
Component 'datepicker' has Description 'Date entry, for the date and dateTime Conceptual Data Types. Payload: label and name.'.
Component 'datepicker' is implemented by Toolkit 'react' at Toolkit Symbol 'DatePicker'.
ImplementationBinding 'datepicker.react' pivots Component 'datepicker' is implemented by Toolkit 'react'.

Component 'timepicker' has Component Role 'time-picker'.
Component 'timepicker' has display- Title 'TimePicker'.
Component 'timepicker' has Description 'Time entry, for the time Conceptual Data Type. Payload: label and name.'.
Component 'timepicker' is implemented by Toolkit 'react' at Toolkit Symbol 'TimePicker'.
ImplementationBinding 'timepicker.react' pivots Component 'timepicker' is implemented by Toolkit 'react'.

Component 'switch' has Component Role 'checkbox'.
Component 'switch' has display- Title 'Switch'.
Component 'switch' has Description 'A two-state control, for the boolean and yesNo Conceptual Data Types. Payload: label and name.'.
Component 'switch' is implemented by Toolkit 'react' at Toolkit Symbol 'Switch'.
ImplementationBinding 'switch.react' pivots Component 'switch' is implemented by Toolkit 'react'.

Component 'textarea' has Component Role 'text-area'.
Component 'textarea' has display- Title 'TextArea'.
Component 'textarea' has Description 'Multi-line text entry, for the largeText Conceptual Data Type. Payload: label and name.'.
Component 'textarea' is implemented by Toolkit 'react' at Toolkit Symbol 'TextArea'.
ImplementationBinding 'textarea.react' pivots Component 'textarea' is implemented by Toolkit 'react'.

Component 'imagepicker' has Component Role 'image-picker'.
Component 'imagepicker' has display- Title 'ImagePicker'.
Component 'imagepicker' has Description 'Picture entry, for the picture Conceptual Data Type. Payload: label and name.'.
Component 'imagepicker' is implemented by Toolkit 'react' at Toolkit Symbol 'ImagePicker'.
ImplementationBinding 'imagepicker.react' pivots Component 'imagepicker' is implemented by Toolkit 'react'.

Component 'label' has Component Role 'label'.
Component 'label' has display- Title 'Label'.
Component 'label' has Description 'A read-only value, for the Conceptual Data Types a person does not type: autoCounter, uuid, autoTimestamp, rowId, objectId and the raws. Payload: label and name.'.
Component 'label' is implemented by Toolkit 'react' at Toolkit Symbol 'Label'.
ImplementationBinding 'label.react' pivots Component 'label' is implemented by Toolkit 'react'.

