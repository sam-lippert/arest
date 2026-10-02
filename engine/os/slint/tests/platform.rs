// THE SLINT PLATFORM, MEASURED (#124, 2026-10-02): the registration, the
// engine's refusal of an unpaired kind, every interface drawn into pixels by
// Slint's software renderer, and -- with AREST_PORT naming a serving host --
// the container navigated, typed into and clicked as a person would, each
// frame it draws written to a PNG.
//
//   cargo test -- --nocapture
//   AREST_PORT=8787 AREST_SNAPSHOT_DIR=<dir> cargo test -- --nocapture

use std::rc::Rc;

use arest_slint::*;
use slint::platform::software_renderer::{MinimalSoftwareWindow, RepaintBufferType};
use slint::platform::{PointerEventButton, WindowEvent};
use slint::{ComponentHandle, LogicalPosition};

fn s(x: &str) -> Value { Value::Str(x.into()) }
fn n(x: f64) -> Value { Value::Num(x) }
fn a(xs: Vec<Value>) -> Value { Value::Arr(xs) }
fn m(name: &str, v: Value) -> Value { a(vec![s(name), v]) }
fn row(kind: &str, x: f64, y: f64, w: f64, h: f64, props: Vec<Value>) -> Value {
    a(vec![s(kind), n(x), n(y), n(w), n(h), a(props)])
}
fn font() -> Value { a(vec![s("Segoe UI"), n(14.0), s("normal")]) }

#[test]
fn the_registration_is_every_interface_and_the_engine() {
    let names = registered_names();
    assert_eq!(names.len(), 20);
    for k in CONTROL_KINDS { assert!(element_of(k).is_some(), "{k} has no element"); }
    assert_eq!(names.last().map(String::as_str), Some(LAYOUT_ENGINE));
    assert_eq!(&names[..19], &CONTROL_KINDS.iter().map(|k| format!("render:{k}")).collect::<Vec<_>>()[..]);
}

#[test]
fn a_kind_no_element_draws_is_refused_by_name() {
    let rows = a(vec![row("listview", 0.0, 0.0, 300.0, 100.0, vec![]), row("canvas", 0.0, 0.0, 10.0, 10.0, vec![])]);
    let err = screen("master", &rows, 0.0, 300.0).err().expect("an unpaired kind must refuse");
    assert!(err.contains("render:canvas"), "{err}");
}

#[test]
fn json_reads_back_what_it_wrote() {
    let v = a(vec![s("a \"q\" \\ b"), n(3.0), n(-1.5), a(vec![]), Value::Bool(true), Value::Null, s("\u{2039}")]);
    assert_eq!(parse(&write(&v)).unwrap(), v);
    assert_eq!(parse("[\"\\u2039\", 1e2]").unwrap(), a(vec![s("\u{2039}"), n(100.0)]));
}

/// A transport that answers one fixed frame, for drawing without a server.
struct Fixed(String);
impl Transport for Fixed {
    fn navigate(&self, _body: &str) -> Result<(u16, String), String> { Ok((200, self.0.clone())) }
}

fn save_png(path: &std::path::Path, rgba: &[u8], w: u32, h: u32) {
    let f = std::fs::File::create(path).unwrap();
    let mut e = png::Encoder::new(std::io::BufWriter::new(f), w, h);
    e.set_color(png::ColorType::Rgba);
    e.set_depth(png::BitDepth::Eight);
    e.write_header().unwrap().write_image_data(rgba).unwrap();
}

/// Pixels in a rectangle that differ from a color.
fn differing(rgba: &[u8], stride: u32, x: u32, y: u32, w: u32, h: u32, bg: [u8; 3]) -> usize {
    let mut k = 0;
    for yy in y..y + h {
        for xx in x..x + w {
            let i = ((yy * stride + xx) * 4) as usize;
            if rgba[i] != bg[0] || rgba[i + 1] != bg[1] || rgba[i + 2] != bg[2] { k += 1; }
        }
    }
    k
}

fn click(frame: &FrameWindow, x: f32, y: f32) {
    let w = frame.window();
    let position = LogicalPosition::new(x, y);
    w.dispatch_event(WindowEvent::PointerMoved { position });
    w.dispatch_event(WindowEvent::PointerPressed { position, button: PointerEventButton::Left });
    w.dispatch_event(WindowEvent::PointerReleased { position, button: PointerEventButton::Left });
}

fn type_text(frame: &FrameWindow, text: &str) {
    for ch in text.chars() {
        let t: slint::SharedString = ch.to_string().into();
        frame.window().dispatch_event(WindowEvent::KeyPressed { text: t.clone() });
        frame.window().dispatch_event(WindowEvent::KeyReleased { text: t });
    }
}

// ONE TEST OWNS THE WINDOW: Slint's platform is set once for the process, and
// the window and its components live on the thread that made them.
#[test]
fn the_platform_draws_every_interface_and_navigates() {
    let window = MinimalSoftwareWindow::new(RepaintBufferType::NewBuffer);
    slint::platform::set_platform(Box::new(Headless(window.clone()))).unwrap();
    let out = std::path::PathBuf::from(std::env::var("AREST_SNAPSHOT_DIR").unwrap_or_else(|_| "target/snapshots".into()));
    std::fs::create_dir_all(&out).unwrap();

    // ---- every interface, from rows as lambda places them ----
    let picture = out.join("picture.png");
    let red: Vec<u8> = (0..16 * 16).flat_map(|_| [200u8, 30, 30, 255]).collect();
    save_png(&picture, &red, 16, 16);
    let kinds = vec![
        row("sectionheader", 14.0, 10.0, 300.0, 24.0, vec![m("Text", s("section")), m("Font", font()),
            m("ForegroundColor", s("#6D6D72")), m("BackgroundColor", s("#F2F2F7"))]),
        row("gridcell", 14.0, 40.0, 300.0, 40.0, vec![m("NavigationLink", a(vec![s("Thing"), s("a")])),
            m("BackgroundColor", s("#FFFFFF")), m("SelectionColor", s("#E5E5EA")),
            m("Children", a(vec![row("label", 14.0, 10.0, 260.0, 20.0, vec![m("Text", s("a cell")), m("Font", font()),
                m("ForegroundColor", s("#1C1C1E"))])]))]),
        row("label", 14.0, 90.0, 300.0, 20.0, vec![m("Text", s("a label")), m("Font", font()), m("ForegroundColor", s("#1C1C1E"))]),
        row("richcontentcell", 14.0, 120.0, 300.0, 60.0, vec![m("Text", s("a block of text that wraps across the width of its cell")),
            m("Font", font()), m("ForegroundColor", s("#1C1C1E")), m("BackgroundColor", s("#FFFFFF"))]),
        row("textbox", 14.0, 190.0, 300.0, 30.0, vec![m("SubmitKey", s("ThingHasName")), m("Text", s("typed")), m("Font", font()),
            m("KeyboardType", s("AlphaNumeric"))]),
        row("passwordbox", 14.0, 230.0, 300.0, 30.0, vec![m("SubmitKey", s("ThingHasSecret")), m("Password", s("hidden")), m("Font", font())]),
        row("textarea", 14.0, 270.0, 300.0, 60.0, vec![m("SubmitKey", s("ThingHasNote")), m("Text", s("a note")), m("Font", font())]),
        row("datepicker", 14.0, 340.0, 300.0, 30.0, vec![m("SubmitKey", s("ThingHasDate")), m("Date", s("2026-10-02")), m("Font", font())]),
        row("timepicker", 14.0, 380.0, 300.0, 30.0, vec![m("SubmitKey", s("ThingHasTime")), m("Time", s("09:30")), m("Font", font())]),
        row("selectlist", 14.0, 420.0, 300.0, 30.0, vec![m("SubmitKey", s("ThingIsOfKind")), m("SelectedItem", s("value")),
            m("Items", a(vec![s("entity"), s("value")])), m("Font", font())]),
        row("switch", 14.0, 460.0, 300.0, 30.0, vec![m("SubmitKey", s("ThingIsOn")), m("Value", s("true"))]),
        row("slider", 14.0, 500.0, 300.0, 30.0, vec![m("SubmitKey", s("ThingHasLevel")), m("Value", s("7")),
            m("MinValue", n(0.0)), m("MaxValue", n(10.0))]),
        row("button", 14.0, 540.0, 300.0, 30.0, vec![m("Title", s("Go")), m("NavigationLink", a(vec![s("fire"), s("Go")])), m("Font", font())]),
        row("image", 14.0, 580.0, 40.0, 40.0, vec![m("FilePath", s(&picture.to_string_lossy()))]),
    ];
    let mut rows = vec![row("listview", 0.0, 0.0, 330.0, 630.0, vec![m("Title", s("every interface")),
        m("BackLink", a(vec![s("back"), s("master")])), m("HeaderColor", s("#FFFFFF")), m("TitleColor", s("#1C1C1E")),
        m("BackgroundColor", s("#F2F2F7")), m("SeparatorColor", s("#E3E3E8")),
        m("Menu", a(vec![s("menu"), a(vec![m("Title", s("")), m("Buttons", a(vec![
            a(vec![s("menubutton"), a(vec![m("Title", s("save")), m("NavigationLink", a(vec![s("submit"), s("Thing")])), m("Action", s("Submit"))])])]))])])),
        m("SearchBox", a(vec![s("searchbox"), a(vec![m("Placeholder", s("Search")), m("Text", s("")),
            m("NavigationLink", a(vec![s("Thing"), s("search")]))])]))])];
    rows.extend(kinds.clone());
    let answer = a(vec![a(vec![a(vec![s("master"), a(vec![])])]), a(vec![]), a(vec![a(vec![s("master"), a(rows)])]), a(vec![]),
        a(vec![s("alert"), a(vec![m("Title", s("refused")), m("Message", s("an alert over the screen"))])])]);
    let c = Container::new(Platform::new(340, registered_names(), Fixed(write(&answer)))).unwrap();
    c.frame.show().unwrap();
    c.go(a(vec![]), None).unwrap();
    let (w, h) = (340u32, 760u32);
    let rgba = render_rgba(&window, w, h);
    save_png(&out.join("0-every-interface.png"), &rgba, w, h);
    // the alert band, the header and the search box sit above the content
    let top = 36.0 + 80.0;
    let bg = [0xF2, 0xF2, 0xF7];
    let mut drawn = Vec::new();
    for k in &kinds {
        let r = k.arr();
        let (x, y, ww, hh) = (r[1].num() as u32, (r[2].num() + top) as u32, r[3].num() as u32, r[4].num() as u32);
        let px = differing(&rgba, w, x, y, ww, hh, bg);
        drawn.push(format!("{}={}", kind_of(k), px));
        assert!(px > 20, "render:{} drew {} pixels", kind_of(k), px);
    }
    println!("every interface drawn (pixels off the layer background): {}", drawn.join(", "));
    assert!(differing(&rgba, w, 0, 0, w, 36, [255, 255, 255]) > 100, "the alert band is drawn");
    // the controls a Submit sends, as the person left them
    let sent = c.state.borrow().drawn[0].submission_values();
    println!("submission values: {}", write(&a(sent.clone())));
    assert_eq!(sent.len(), 8);

    // ---- the container against a serving host ----
    if std::env::var("AREST_PORT").is_err() && std::env::var("AREST_SERVE").is_err() {
        println!("AREST_PORT is not set: the serving host's navigation is not exercised");
        return;
    }
    // one window adapter, one component on it at a time
    drop(c);
    let live = Container::new(Platform::new(980, registered_names(), Http::from_env())).unwrap();
    live.frame.show().unwrap();
    let (fw, fh) = (980u32, 1400u32);
    let step = |name: &str, address: Value, from: Option<&str>| {
        let t0 = std::time::Instant::now();
        let f = live.go(address, from).unwrap();
        let ms = t0.elapsed().as_millis();
        let st = live.state.borrow();
        println!("{name}: status {}, {ms} ms, unpaired {:?}, stacks {}", f.status, f.unpaired, write(&st.platform.stacks));
        for (pane, rows) in &f.panes { println!("  pane {pane}: {} rows", rows.arr().len()); }
        if let Some(al) = &st.platform.alert { println!("  alert {}", write(al)); }
        if let Some(e) = &st.error { println!("  error {e}"); }
        drop(st);
        let rgba = render_rgba(&window, fw, fh);
        save_png(&out.join(format!("{name}.png")), &rgba, fw, fh);
        f
    };
    step("1-root", a(vec![]), None);
    step("2-collection", a(vec![s("Function")]), Some("master"));
    step("3-entity", a(vec![s("Function"), s("render:listview")]), Some("master"));
    step("4-form", a(vec![s("new"), s("Function")]), Some("master"));

    // type into the form's Function field and click its save, as a person does
    let (fx, fy) = {
        let st = live.state.borrow();
        let d = st.drawn.iter().find(|d| d.name == "detail").unwrap();
        let (i, _) = d.submits.iter().find(|(_, k)| k == "Function").unwrap();
        let cell = slint::Model::row_data(d.cells.as_ref(), *i).unwrap();
        let top = if d.data.has_search { 80.0 } else { 40.0 };
        (d.data.x + cell.x + cell.width / 2.0, top + cell.y + cell.height / 2.0)
    };
    click(&live.frame, fx, fy);
    type_text(&live.frame, "f-slint");
    let detail = live.state.borrow().drawn.iter().position(|d| d.name == "detail").unwrap();
    println!("typed: {}", write(&a(live.state.borrow().drawn[detail].submission_values())));
    let save_x = live.state.borrow().drawn[detail].data.x + live.state.borrow().drawn[detail].data.width - 14.0 - 40.0;
    click(&live.frame, save_x, 20.0);
    {
        let st = live.state.borrow();
        println!("5-submitted: status {}, stacks {}", st.platform.status, write(&st.platform.stacks));
        if let Some(al) = &st.platform.alert { println!("  alert {}", write(al)); }
        assert_eq!(st.platform.status, 201, "the save committed");
    }
    save_png(&out.join("5-submitted.png"), &render_rgba(&window, fw, fh), fw, fh);
    step("6-form-again", a(vec![s("new"), s("Function")]), Some("master"));
    let save_x = live.state.borrow().drawn[detail].data.x + live.state.borrow().drawn[detail].data.width - 14.0 - 40.0;
    click(&live.frame, save_x, 20.0);
    {
        let st = live.state.borrow();
        println!("7-refused: status {}, alert {}", st.platform.status, st.platform.alert.as_ref().map(write).unwrap_or_default());
        assert_eq!(st.platform.status, 400, "a save with no identifier is refused");
    }
    save_png(&out.join("7-refused.png"), &render_rgba(&window, fw, fh), fw, fh);

    // THE PAIRING IS LAMBDA'S: the same names short of one control, and short of the engine
    for drop in ["render:gridcell", LAYOUT_ENGINE] {
        let names: Vec<String> = registered_names().into_iter().filter(|x| x != drop).collect();
        let mut p = Platform::new(980, names, Http::from_env());
        let f = p.go(a(vec![]), None).unwrap();
        println!("without {drop}: unpaired {:?}, panes drawn {}", f.unpaired, p.placed.len());
        assert!(f.unpaired.contains(&drop.to_string()));
        assert!(p.placed.is_empty());
    }
    let _ = Rc::strong_count(&window);
}
