# wpf-runner — the WPF platform (#124)

A platform is a shim that registers its paired controls, hands each event to
lambda and draws what lambda answers, and nothing else (Sam, 2026-09-20).
Sam, 2026-10-01: a registration surface per platform -- Slint in Rust, WPF in
C#, React for the web -- and any host language through the same surface. This
is the C# one, the sibling of ui.do's `src/render` and of
`tools/java-runner/Gui.java`:

- `Registry.cs`: the pairing table, iFactr-WPF's `WpfFactory.OnSetDefinitions`
  over lambda's names -- `render:<kind>` for the nineteen iFactr interfaces
  lambda places, and the layout engine `render:wpf` (Render Target 'wpf') --
  and the platform's IPlatformDefaults, iFactr-WPF's own margins, cell height
  and Segoe UI fonts.
- `Controls.cs`: one WPF element per interface, each drawing the members its
  interface names and the Font and colors of its row, and `Screen`, the layout
  engine: the view's chrome around a Canvas holding every other row at the
  rectangle lambda placed it.
- `Navigate.cs`: the one call, `POST /navigate` on the serving host, the
  request `<stacks, address, widths, registered, defaults, from>` and the
  answer `<stacks, style, panes, unpaired, alert>`. A write is a request of
  the same interface: a form's Submit sends its values with its link
  (IListView.Submit) and main:api commits or refuses it, the refusal drawn
  as the IAlert.

The pairing is lambda's: each request carries the names registered here and
`ui:unpaired` answers over them, so a frame naming one is a refusal to draw.
Nothing here reads lambda, boots a store, validates or persists.

    dotnet build -c Release
    AREST_PORT=8787 bin/Release/net10.0-windows/arest-wpf.exe
    AREST_PORT=8787 bin/Release/net10.0-windows/arest-wpf.exe snapshot <dir>

`snapshot` drives the same container with no window and writes each frame it
draws to a PNG (RenderTargetBitmap), the form's Submit clicked through its own
button.

This directory held a 15,311-line `Gui.cs` until 2026-09-20 (37d356d5, Sam:
"delete the UI hosts too. They're probably all wrong."); this starts from
navigate, not from that.
