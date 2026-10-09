//! THE SLINT PLATFORM (#124, 2026-10-02). Sam, 2026-10-01: "I want a slint
//! registration surface in Rust the same way there should be a wpf registration
//! in C# and a react registration for web." A platform is a shim that registers
//! its paired controls, hands each event to lambda and draws what lambda
//! answers, and nothing else (Sam, 2026-09-20). This crate is the Rust one, the
//! sibling of ui.do's `src/render`, `tools/java-runner/Gui.java` and
//! `tools/wpf-runner`, and it holds the same four things:
//!
//! - THE REGISTRATION: `render:<kind>` for each iFactr interface lambda places
//!   (metamodel/resolution.md), each drawn by an element of `ui/ifactr.slint`
//!   and bound to Toolkit 'slint' at its symbol (readings/ui/components.md),
//!   and the layout engine `render:slint`, the platform's Render Target.
//! - ITS IPlatformDefaults, so lambda places and measures for this platform.
//! - THE ONE CALL: `navigate`, the request `<stacks, address, widths,
//!   registered, defaults, from>` and the answer `<stacks, style, panes,
//!   unpaired, alert>`, over a [`Transport`]: HTTP to a serving host here, and
//!   lambda in-process where there is no other host to ask (engine/os's UEFI
//!   image, which is the next step and not this crate's yet).
//! - THE STACKS, carried from one answer to the next request.
//!
//! The pairing is lambda's: each request carries the names registered here and
//! `ui:unpaired` answers over them; a frame naming one is a refusal to draw.
//! The screen is drawn by Slint's software renderer into a pixel buffer, which
//! is what the UEFI framebuffer shows and what the tests measure.

use std::cell::RefCell;
use std::rc::Rc;

use slint::{Color, ComponentHandle, Model, ModelRc, SharedString, VecModel};

slint::include_modules!();

// ---- THE REGISTRATION ------------------------------------------------------

pub const TOOLKIT: &str = "slint";
pub const LAYOUT_ENGINE: &str = "render:slint";
pub const CONTROL_KINDS: [&str; 19] = [
    "listview", "sectionheader", "gridcell", "label", "richcontentcell", "textbox",
    "passwordbox", "textarea", "datepicker", "timepicker", "selectlist", "switch",
    "slider", "image", "button", "menu", "menubutton", "searchbox", "alert",
];

/// The Slint element that draws a kind: a branch of `Screen`'s cell, or the
/// part of the chrome a view's property is drawn in. register(control, impl) IS
/// the pairing (iFactr's IPairable), and a kind with no element is unpaired.
pub fn element_of(kind: &str) -> Option<&'static str> {
    Some(match kind {
        "listview" => "Screen",
        "sectionheader" => "Screen cell: Rectangle and Text",
        "gridcell" => "Screen cell: Rectangle and TouchArea",
        "label" => "Screen cell: Text, or a read-only LineEdit",
        "richcontentcell" => "Screen cell: wrapped Text",
        "textbox" | "passwordbox" | "datepicker" | "timepicker" => "Screen cell: LineEdit",
        "textarea" => "Screen cell: TextEdit",
        "selectlist" => "Screen cell: ComboBox",
        "switch" => "Screen cell: CheckBox",
        "slider" => "Screen cell: Slider",
        "image" => "Screen cell: Image",
        "button" => "Screen cell: Button",
        "menu" | "menubutton" => "Screen header: Button",
        "searchbox" => "Screen chrome: LineEdit",
        "alert" => "Frame: the alert band",
        _ => return None,
    })
}

/// Every name this container registers: the widgets, then the layout engine.
pub fn registered_names() -> Vec<String> {
    let mut names: Vec<String> = CONTROL_KINDS
        .iter()
        .filter(|k| element_of(k).is_some())
        .map(|k| format!("render:{k}"))
        .collect();
    names.push(LAYOUT_ENGINE.to_string());
    names
}

fn font(family: &str, size: i64, formatting: &str) -> Value {
    Value::Arr(vec![Value::Str(family.into()), Value::Num(size as f64), Value::Str(formatting.into())])
}

fn member(name: &str, value: Value) -> Value { Value::Arr(vec![Value::Str(name.into()), value]) }

/// IPlatformDefaults, member by member: the iFactr margins and spacings, and
/// the fonts of Slint's std-widgets style, so a row's font is the one its
/// element shows.
pub fn platform_defaults() -> Value {
    Value::Arr(vec![
        member("LeftMargin", Value::Num(8.0)), member("RightMargin", Value::Num(8.0)),
        member("TopMargin", Value::Num(8.0)), member("BottomMargin", Value::Num(8.0)),
        member("LargeHorizontalSpacing", Value::Num(10.0)), member("SmallHorizontalSpacing", Value::Num(4.0)),
        member("LargeVerticalSpacing", Value::Num(10.0)), member("SmallVerticalSpacing", Value::Num(4.0)),
        member("CellHeight", Value::Num(44.0)),
        member("ButtonFont", font("Segoe UI", 14, "normal")),
        member("DateTimePickerFont", font("Segoe UI", 14, "normal")),
        member("HeaderFont", font("Segoe UI", 12, "normal")),
        member("LabelFont", font("Segoe UI", 14, "normal")),
        member("MessageBodyFont", font("Segoe UI", 13, "normal")),
        member("MessageTitleFont", font("Segoe UI", 14, "bold")),
        member("SectionHeaderFont", font("Segoe UI", 12, "normal")),
        member("SectionFooterFont", font("Segoe UI", 12, "normal")),
        member("SelectListFont", font("Segoe UI", 14, "normal")),
        member("SmallFont", font("Segoe UI", 12, "normal")),
        member("TabFont", font("Segoe UI", 12, "normal")),
        member("TextBoxFont", font("Segoe UI", 14, "normal")),
        member("ValueFont", font("Segoe UI", 14, "normal")),
    ])
}

// ---- JSON, the request's and the answer's encoding --------------------------

#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Value>),
    Obj(Vec<(String, Value)>),
}

impl Value {
    pub fn arr(&self) -> &[Value] { if let Value::Arr(a) = self { a } else { &[] } }
    pub fn text(&self) -> String {
        match self {
            Value::Str(s) => s.clone(),
            Value::Num(n) if n.fract() == 0.0 => format!("{}", *n as i64),
            Value::Num(n) => format!("{n}"),
            _ => String::new(),
        }
    }
    pub fn num(&self) -> f64 {
        match self {
            Value::Num(n) => *n,
            Value::Str(s) => s.trim().parse().unwrap_or(0.0),
            _ => 0.0,
        }
    }
    pub fn non_empty(&self) -> bool { matches!(self, Value::Arr(a) if !a.is_empty()) }
}

pub fn parse(text: &str) -> Result<Value, String> {
    let b = text.as_bytes();
    let mut i = 0;
    let v = parse_value(b, &mut i)?;
    skip_ws(b, &mut i);
    if i != b.len() { return Err(format!("json: trailing text at {i}")); }
    Ok(v)
}

fn skip_ws(b: &[u8], i: &mut usize) { while *i < b.len() && (b[*i] as char).is_ascii_whitespace() { *i += 1; } }

fn parse_value(b: &[u8], i: &mut usize) -> Result<Value, String> {
    skip_ws(b, i);
    match b.get(*i) {
        None => Err("json: unexpected end".into()),
        Some(b'[') => {
            *i += 1;
            let mut out = Vec::new();
            skip_ws(b, i);
            if b.get(*i) == Some(&b']') { *i += 1; return Ok(Value::Arr(out)); }
            loop {
                out.push(parse_value(b, i)?);
                skip_ws(b, i);
                match b.get(*i) {
                    Some(b',') => *i += 1,
                    Some(b']') => { *i += 1; return Ok(Value::Arr(out)); }
                    _ => return Err(format!("json: expected , or ] at {i}")),
                }
            }
        }
        Some(b'{') => {
            *i += 1;
            let mut out = Vec::new();
            skip_ws(b, i);
            if b.get(*i) == Some(&b'}') { *i += 1; return Ok(Value::Obj(out)); }
            loop {
                skip_ws(b, i);
                let k = parse_string(b, i)?;
                skip_ws(b, i);
                if b.get(*i) != Some(&b':') { return Err(format!("json: expected : at {i}")); }
                *i += 1;
                out.push((k, parse_value(b, i)?));
                skip_ws(b, i);
                match b.get(*i) {
                    Some(b',') => *i += 1,
                    Some(b'}') => { *i += 1; return Ok(Value::Obj(out)); }
                    _ => return Err(format!("json: expected , or }} at {i}")),
                }
            }
        }
        Some(b'"') => Ok(Value::Str(parse_string(b, i)?)),
        Some(b't') if b[*i..].starts_with(b"true") => { *i += 4; Ok(Value::Bool(true)) }
        Some(b'f') if b[*i..].starts_with(b"false") => { *i += 5; Ok(Value::Bool(false)) }
        Some(b'n') if b[*i..].starts_with(b"null") => { *i += 4; Ok(Value::Null) }
        Some(_) => {
            let start = *i;
            while *i < b.len() && b"+-0123456789.eE".contains(&b[*i]) { *i += 1; }
            let s = std::str::from_utf8(&b[start..*i]).map_err(|e| e.to_string())?;
            s.parse::<f64>().map(Value::Num).map_err(|_| format!("json: unexpected text at {start}"))
        }
    }
}

fn parse_string(b: &[u8], i: &mut usize) -> Result<String, String> {
    if b.get(*i) != Some(&b'"') { return Err(format!("json: expected a string at {i}")); }
    *i += 1;
    let mut out: Vec<u8> = Vec::new();
    loop {
        let c = *b.get(*i).ok_or("json: unterminated string")?;
        *i += 1;
        match c {
            b'"' => return String::from_utf8(out).map_err(|e| e.to_string()),
            b'\\' => {
                let e = *b.get(*i).ok_or("json: bad escape")?;
                *i += 1;
                match e {
                    b'"' => out.push(b'"'),
                    b'\\' => out.push(b'\\'),
                    b'/' => out.push(b'/'),
                    b'b' => out.push(8),
                    b'f' => out.push(12),
                    b'n' => out.push(b'\n'),
                    b'r' => out.push(b'\r'),
                    b't' => out.push(b'\t'),
                    b'u' => {
                        let hex = std::str::from_utf8(b.get(*i..*i + 4).ok_or("json: bad escape")?).map_err(|e| e.to_string())?;
                        let mut code = u32::from_str_radix(hex, 16).map_err(|e| e.to_string())?;
                        *i += 4;
                        if (0xD800..0xDC00).contains(&code) && b.get(*i) == Some(&b'\\') && b.get(*i + 1) == Some(&b'u') {
                            let lo = std::str::from_utf8(&b[*i + 2..*i + 6]).map_err(|e| e.to_string())?;
                            let lo = u32::from_str_radix(lo, 16).map_err(|e| e.to_string())?;
                            code = 0x10000 + ((code - 0xD800) << 10) + (lo - 0xDC00);
                            *i += 6;
                        }
                        let ch = char::from_u32(code).unwrap_or('\u{FFFD}');
                        let mut buf = [0u8; 4];
                        out.extend_from_slice(ch.encode_utf8(&mut buf).as_bytes());
                    }
                    _ => return Err("json: bad escape".into()),
                }
            }
            _ => out.push(c),
        }
    }
}

pub fn write(v: &Value) -> String {
    let mut s = String::new();
    write_into(v, &mut s);
    s
}

fn write_into(v: &Value, s: &mut String) {
    match v {
        Value::Null => s.push_str("null"),
        Value::Bool(b) => s.push_str(if *b { "true" } else { "false" }),
        Value::Num(n) => s.push_str(&Value::Num(*n).text()),
        Value::Str(t) => {
            s.push('"');
            for c in t.chars() {
                match c {
                    '"' => s.push_str("\\\""),
                    '\\' => s.push_str("\\\\"),
                    '\n' => s.push_str("\\n"),
                    '\r' => s.push_str("\\r"),
                    '\t' => s.push_str("\\t"),
                    c if (c as u32) < 0x20 => s.push_str(&format!("\\u{:04x}", c as u32)),
                    c => s.push(c),
                }
            }
            s.push('"');
        }
        Value::Arr(a) => {
            s.push('[');
            for (k, x) in a.iter().enumerate() {
                if k > 0 { s.push(','); }
                write_into(x, s);
            }
            s.push(']');
        }
        Value::Obj(o) => {
            s.push('{');
            for (k, (name, x)) in o.iter().enumerate() {
                if k > 0 { s.push(','); }
                write_into(&Value::Str(name.clone()), s);
                s.push(':');
                write_into(x, s);
            }
            s.push('}');
        }
    }
}

// ---- THE ROWS ---------------------------------------------------------------

pub fn kind_of(row: &Value) -> String { row.arr().first().map(|v| v.text()).unwrap_or_default() }

/// A row's properties by member: sixth on a placed row, second on an unplaced one.
pub fn props(row: &Value) -> Vec<(String, Value)> {
    let r = row.arr();
    let list = if r.len() >= 6 { &r[5] } else if r.len() >= 2 { &r[1] } else { return Vec::new() };
    list.arr()
        .iter()
        .filter_map(|p| match p.arr() {
            [Value::Str(m), v, ..] => Some((m.clone(), v.clone())),
            _ => None,
        })
        .collect()
}

pub fn prop<'a>(p: &'a [(String, Value)], name: &str) -> &'a Value {
    static NULL: Value = Value::Null;
    p.iter().find(|(m, _)| m == name).map(|(_, v)| v).unwrap_or(&NULL)
}

fn color(v: &Value) -> Option<Color> {
    let s = v.text();
    let h = s.strip_prefix('#')?;
    if h.len() != 6 { return None; }
    let n = u32::from_str_radix(h, 16).ok()?;
    Some(Color::from_rgb_u8((n >> 16) as u8, (n >> 8) as u8, n as u8))
}

// ---- THE FRAME AND THE ONE CALL ----------------------------------------------

/// What lambda answers for one navigation, read positionally as ui:frame_out built it.
#[derive(Clone, Debug)]
pub struct Frame {
    pub stacks: Value,
    pub style: Value,
    pub panes: Vec<(String, Value)>,
    pub unpaired: Vec<String>,
    pub alert: Option<Value>,
    pub status: u16,
}

pub fn frame_from(answer: &Value, status: u16) -> Frame {
    let a = answer.arr();
    Frame {
        stacks: a.first().cloned().unwrap_or(Value::Arr(vec![])),
        style: a.get(1).cloned().unwrap_or(Value::Arr(vec![])),
        panes: a.get(2).map(|p| p.arr().iter().filter(|e| e.arr().len() >= 2)
            .map(|e| (e.arr()[0].text(), e.arr()[1].clone())).collect()).unwrap_or_default(),
        unpaired: a.get(3).map(|u| u.arr().iter().map(|x| x.text()).collect()).unwrap_or_default(),
        alert: a.get(4).filter(|x| x.non_empty()).cloned(),
        status,
    }
}

/// How a navigate request reaches lambda.
pub trait Transport {
    fn navigate(&self, body: &str) -> Result<(u16, String), String>;
}

/// The serving host's POST /navigate, over HTTP/1.1 on a TCP socket.
pub struct Http { pub host: String, pub port: u16 }

impl Http {
    /// AREST_SERVE (http://host:port) or AREST_PORT on 127.0.0.1, 8787 when neither is set.
    pub fn from_env() -> Http {
        if let Ok(url) = std::env::var("AREST_SERVE") {
            let rest = url.trim_start_matches("http://").trim_end_matches('/');
            let (host, port) = rest.rsplit_once(':').unwrap_or((rest, "80"));
            return Http { host: host.to_string(), port: port.parse().unwrap_or(80) };
        }
        let port = std::env::var("AREST_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8787);
        Http { host: "127.0.0.1".into(), port }
    }
}

impl Transport for Http {
    fn navigate(&self, body: &str) -> Result<(u16, String), String> {
        use std::io::{Read, Write};
        let mut s = std::net::TcpStream::connect((self.host.as_str(), self.port)).map_err(|e| e.to_string())?;
        s.set_read_timeout(Some(std::time::Duration::from_secs(120))).ok();
        let req = format!(
            "POST /navigate HTTP/1.1\r\nHost: {}:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            self.host, self.port, body.len(), body);
        s.write_all(req.as_bytes()).map_err(|e| e.to_string())?;
        let mut raw = Vec::new();
        s.read_to_end(&mut raw).map_err(|e| e.to_string())?;
        let split = raw.windows(4).position(|w| w == b"\r\n\r\n").ok_or("navigate: no header end")?;
        let head = String::from_utf8_lossy(&raw[..split]).to_string();
        let mut body = raw[split + 4..].to_vec();
        let status = head.split_whitespace().nth(1).and_then(|c| c.parse().ok()).ok_or("navigate: no status")?;
        if head.to_ascii_lowercase().contains("transfer-encoding: chunked") {
            let mut out = Vec::new();
            let mut i = 0;
            loop {
                let line_end = body[i..].windows(2).position(|w| w == b"\r\n").ok_or("navigate: bad chunk")? + i;
                let size = usize::from_str_radix(String::from_utf8_lossy(&body[i..line_end]).trim(), 16).map_err(|e| e.to_string())?;
                if size == 0 { break; }
                out.extend_from_slice(&body[line_end + 2..line_end + 2 + size]);
                i = line_end + 2 + size + 2;
            }
            body = out;
        }
        Ok((status, String::from_utf8(body).map_err(|e| e.to_string())?))
    }
}

/// One platform: what it registered, its stacks (its form factor), its pane
/// widths, and the last frame lambda answered, a pane the answer leaves out
/// keeping what it showed.
pub struct Platform<T: Transport> {
    pub panes: Vec<String>,
    pub width: i32,
    pub registered: Vec<String>,
    pub stacks: Value,
    pub placed: Vec<(String, Value)>,
    pub alert: Option<Value>,
    pub unpaired: Vec<String>,
    pub status: u16,
    pub transport: T,
}

pub const MASTER_WIDTH: i32 = 320;
pub const SPLIT_MIN_WIDTH: i32 = 900;

impl<T: Transport> Platform<T> {
    pub fn new(width: i32, registered: Vec<String>, transport: T) -> Self {
        let panes: Vec<String> = if width >= SPLIT_MIN_WIDTH { vec!["master".into(), "detail".into()] } else { vec!["master".into()] };
        let stacks = Value::Arr(panes.iter().map(|p| Value::Arr(vec![Value::Str(p.clone()), Value::Arr(vec![])])).collect());
        Platform { panes, width, registered, stacks, placed: Vec::new(), alert: None, unpaired: Vec::new(), status: 0, transport }
    }

    pub fn pane_width(&self, i: usize) -> i32 {
        if self.panes.len() <= 1 { return self.width; }
        let rest = (self.width - MASTER_WIDTH * (self.panes.len() as i32 - 1)).max(MASTER_WIDTH);
        if i < self.panes.len() - 1 { MASTER_WIDTH } else { rest }
    }

    /// Hand one navigation to lambda. A refused write answers its frame with the
    /// refusal as its alert; any other non-2xx answer is an error, never an
    /// empty frame. A frame naming an unpaired kind moves nothing.
    pub fn go(&mut self, address: Value, from: Option<&str>) -> Result<Frame, String> {
        let widths = Value::Arr(self.panes.iter().enumerate()
            .map(|(i, p)| Value::Arr(vec![Value::Str(p.clone()), Value::Num(self.pane_width(i) as f64)])).collect());
        let body = Value::Arr(vec![
            self.stacks.clone(), address, widths,
            Value::Arr(self.registered.iter().map(|n| Value::Str(n.clone())).collect()),
            platform_defaults(),
            from.map(|f| Value::Str(f.into())).unwrap_or(Value::Arr(vec![])),
        ]);
        let (status, text) = self.transport.navigate(&write(&body))?;
        let answer = parse(&text).ok();
        if status >= 400 && !matches!(&answer, Some(Value::Arr(a)) if a.len() == 5) {
            return Err(format!("navigate answered {status}: {}", text.chars().take(200).collect::<String>()));
        }
        let f = frame_from(&answer.unwrap_or(Value::Arr(vec![])), status);
        self.unpaired = f.unpaired.clone();
        self.status = status;
        if !f.unpaired.is_empty() { return Ok(f); }
        self.stacks = f.stacks.clone();
        for (name, rows) in &f.panes {
            match self.placed.iter_mut().find(|(n, _)| n == name) {
                Some(slot) => slot.1 = rows.clone(),
                None => self.placed.push((name.clone(), rows.clone())),
            }
        }
        self.alert = f.alert.clone();
        Ok(f)
    }
}

// ---- THE LAYOUT ENGINE: render:slint -----------------------------------------

/// One pane as the engine drew it: the Slint data, and what its indices name.
pub struct Drawn {
    pub name: String,
    pub data: PaneData,
    pub cells: Rc<VecModel<Cell>>,
    pub links: Vec<Value>,
    pub menu: Vec<(Value, bool)>,
    pub search_link: Value,
    /// <cell index, SubmitKey> for each control a Submit sends
    pub submits: Vec<(usize, String)>,
}

/// A screen's placed rows to its Slint pane: the first row, the view, is the
/// chrome, and every other row is a cell at the rectangle lambda placed it, a
/// grid cell's children at its origin above it. A row naming a kind no element
/// draws is a refusal, never a blank.
pub fn screen(name: &str, rows: &Value, x: f32, width: f32) -> Result<Drawn, String> {
    let all = rows.arr();
    let view = all.iter().find(|r| kind_of(r) == "listview").cloned()
        .unwrap_or_else(|| Value::Arr(vec![Value::Str("listview".into())]));
    let vp = props(&view);
    let mut links = Vec::new();
    let link = |v: &Value, links: &mut Vec<Value>| -> i32 {
        if v.non_empty() { links.push(v.clone()); links.len() as i32 - 1 } else { -1 }
    };
    let back = link(prop(&vp, "BackLink"), &mut links);
    let mut menu = Vec::new();
    let mut items = Vec::new();
    if let m @ Value::Arr(_) = prop(&vp, "Menu") {
        if m.non_empty() {
            for b in prop(&props(m), "Buttons").arr() {
                let bp = props(b);
                let submit = prop(&bp, "Action").text() == "Submit";
                let l = link(prop(&bp, "NavigationLink"), &mut links);
                menu.push((prop(&bp, "NavigationLink").clone(), submit));
                items.push(MenuItem { title: prop(&bp, "Title").text().into(), link: l, submit });
            }
        }
    }
    let search = prop(&vp, "SearchBox");
    let sp = props(search);
    let mut cells = Vec::new();
    let mut submits = Vec::new();
    for row in all {
        if kind_of(row) == "listview" { continue; }
        add_cell(row, 0.0, 0.0, &mut cells, &mut links, &mut submits)?;
    }
    let separator = color(prop(&vp, "SeparatorColor")).unwrap_or(Color::from_rgb_u8(0xE3, 0xE3, 0xE8));
    let model = Rc::new(VecModel::from(cells));
    let data = PaneData {
        name: name.into(),
        x, width,
        title: prop(&vp, "Title").text().into(),
        back_link: back,
        menu: ModelRc::new(VecModel::from(items)),
        has_search: search.non_empty(),
        search_placeholder: prop(&sp, "Placeholder").text().into(),
        search_text: prop(&sp, "Text").text().into(),
        header_color: color(prop(&vp, "HeaderColor")).unwrap_or(Color::from_rgb_u8(255, 255, 255)),
        title_color: color(prop(&vp, "TitleColor")).unwrap_or(Color::from_rgb_u8(0x1C, 0x1C, 0x1E)),
        separator,
        background: color(prop(&vp, "BackgroundColor")).unwrap_or(Color::from_rgb_u8(0xF2, 0xF2, 0xF7)),
        cells: ModelRc::from(model.clone()),
    };
    Ok(Drawn { name: name.into(), data, cells: model, links, menu, search_link: prop(&sp, "NavigationLink").clone(), submits })
}

fn add_cell(row: &Value, dx: f32, dy: f32, cells: &mut Vec<Cell>, links: &mut Vec<Value>,
            submits: &mut Vec<(usize, String)>) -> Result<(), String> {
    let kind = kind_of(row);
    if element_of(&kind).is_none() || !CONTROL_KINDS.contains(&kind.as_str()) {
        return Err(format!("no widget paired to render:{kind}; lambda placed a control this container does not have"));
    }
    let r = row.arr();
    let p = props(row);
    let (x, y, w, h) = if r.len() >= 5 { (r[1].num() as f32, r[2].num() as f32, r[3].num() as f32, r[4].num() as f32) } else { (0.0, 0.0, 0.0, 0.0) };
    let f = prop(&p, "Font").arr();
    let link_v = prop(&p, "NavigationLink");
    let link = if link_v.non_empty() { links.push(link_v.clone()); links.len() as i32 - 1 } else { -1 };
    let key = prop(&p, "SubmitKey");
    let member = match kind.as_str() {
        "passwordbox" => "Password",
        "datepicker" => "Date",
        "timepicker" => "Time",
        "button" => "Title",
        _ => "Text",
    };
    let items: Vec<SharedString> = std::iter::once(SharedString::new())
        .chain(prop(&p, "Items").arr().iter().map(|i| SharedString::from(i.text()))).collect();
    let chosen = prop(&p, "SelectedItem").text();
    let selected = items.iter().position(|i| i.as_str() == chosen && !chosen.is_empty()).unwrap_or(0) as i32;
    let keyboard = prop(&p, "KeyboardType").text();
    let path = prop(&p, "FilePath").text();
    // a section header reads in capitals, as every iFactr binding draws ISectionHeader
    let text = if kind == "sectionheader" { prop(&p, member).text().to_uppercase() } else { prop(&p, member).text() };
    let cell = Cell {
        kind: kind.clone().into(),
        x: dx + x, y: dy + y, width: w, height: h,
        text: text.into(),
        placeholder: match kind.as_str() { "datepicker" => "yyyy-MM-dd".into(), "timepicker" => "HH:mm".into(), _ => SharedString::new() },
        foreground: color(prop(&p, "ForegroundColor")).unwrap_or(Color::from_rgb_u8(0x1C, 0x1C, 0x1E)),
        background: color(prop(&p, "BackgroundColor")).unwrap_or(Color::from_argb_u8(0, 0, 0, 0)),
        selection: color(prop(&p, "SelectionColor")).unwrap_or(Color::from_rgb_u8(0xE5, 0xE5, 0xEA)),
        font_family: f.first().map(|v| v.text()).unwrap_or_default().into(),
        font_size: f.get(1).map(|v| v.num() as f32).unwrap_or(14.0),
        bold: f.get(2).map(|v| v.text() == "bold").unwrap_or(false),
        link,
        items: ModelRc::new(VecModel::from(items)),
        selected,
        checked: prop(&p, "Value").text() == "true" || prop(&p, "Value") == &Value::Bool(true),
        minimum: prop(&p, "MinValue").num() as f32,
        maximum: prop(&p, "MaxValue").num() as f32,
        value: prop(&p, "Value").num() as f32,
        read_only: kind == "label" && matches!(key, Value::Str(_)),
        password: kind == "passwordbox",
        numeric: keyboard == "Symbolic" || keyboard == "PIN",
        picture: if !path.is_empty() && std::path::Path::new(&path).is_file() {
            slint::Image::load_from_path(std::path::Path::new(&path)).unwrap_or_default()
        } else { slint::Image::default() },
    };
    cells.push(cell);
    if let Value::Str(k) = key {
        if kind != "label" { submits.push((cells.len() - 1, k.clone())); }
    }
    if kind == "gridcell" {
        for child in prop(&p, "Children").arr() {
            add_cell(child, dx + x, dy + y, cells, links, submits)?;
        }
    }
    Ok(())
}

impl Drawn {
    /// IListView.GetSubmissionValues: each control carrying a SubmitKey as a
    /// <key, value> pair, the value as the control holds it now. An empty value
    /// sends nothing, a read-only label is not among them, and a switch sends
    /// true when it is on.
    pub fn submission_values(&self) -> Vec<Value> {
        let mut pairs = Vec::new();
        for (i, key) in &self.submits {
            let Some(c) = self.cells.row_data(*i) else { continue };
            let v = match c.kind.as_str() {
                "switch" => if c.checked { "true".to_string() } else { continue },
                "selectlist" => c.items.row_data(c.selected as usize).map(|s| s.to_string()).unwrap_or_default(),
                "slider" => format!("{}", c.value.round() as i64),
                _ => c.text.to_string(),
            };
            if v.is_empty() { continue; }
            pairs.push(Value::Arr(vec![Value::Str(key.clone()), Value::Str(v)]));
        }
        pairs
    }
}

pub fn concat(link: &Value, more: Vec<Value>) -> Value {
    let mut all = link.arr().to_vec();
    all.extend(more);
    Value::Arr(all)
}

// ---- THE CONTAINER: the platform, its window, its events --------------------

pub struct State<T: Transport> {
    pub platform: Platform<T>,
    pub drawn: Vec<Drawn>,
    pub error: Option<String>,
}

/// The Slint window over a platform: every event a widget raises goes to lambda
/// as one navigate, and the window is redrawn from the answer.
pub struct Container<T: Transport + 'static> {
    /// the generated window (ui/ifactr.slint's FrameWindow)
    pub frame: FrameWindow,
    pub state: Rc<RefCell<State<T>>>,
}

impl<T: Transport + 'static> Container<T> {
    pub fn new(platform: Platform<T>) -> Result<Self, slint::PlatformError> {
        let frame = FrameWindow::new()?;
        let state = Rc::new(RefCell::new(State { platform, drawn: Vec::new(), error: None }));
        let c = Container { frame, state };
        c.wire();
        Ok(c)
    }

    fn wire(&self) {
        let (st, fw) = (self.state.clone(), self.frame.as_weak());
        self.frame.on_follow(move |p, l| {
            let target = st.borrow().drawn.get(p as usize).and_then(|d| d.links.get(l as usize).cloned().map(|a| (a, d.name.clone())));
            if let (Some((address, from)), Some(f)) = (target, fw.upgrade()) { let _ = go(&st, &f, address, Some(&from)); }
        });
        let st = self.state.clone();
        self.frame.on_edited(move |p, c, t| {
            if let Some(d) = st.borrow().drawn.get(p as usize) {
                if let Some(mut cell) = d.cells.row_data(c as usize) { cell.text = t; d.cells.set_row_data(c as usize, cell); }
            }
        });
        let st = self.state.clone();
        self.frame.on_chosen(move |p, c, x| {
            if let Some(d) = st.borrow().drawn.get(p as usize) {
                if let Some(mut cell) = d.cells.row_data(c as usize) { cell.selected = x; d.cells.set_row_data(c as usize, cell); }
            }
        });
        let st = self.state.clone();
        self.frame.on_toggled(move |p, c, b| {
            if let Some(d) = st.borrow().drawn.get(p as usize) {
                if let Some(mut cell) = d.cells.row_data(c as usize) { cell.checked = b; d.cells.set_row_data(c as usize, cell); }
            }
        });
        let st = self.state.clone();
        self.frame.on_slid(move |p, c, v| {
            if let Some(d) = st.borrow().drawn.get(p as usize) {
                if let Some(mut cell) = d.cells.row_data(c as usize) { cell.value = v; d.cells.set_row_data(c as usize, cell); }
            }
        });
        let (st, fw) = (self.state.clone(), self.frame.as_weak());
        self.frame.on_menu_clicked(move |p, m| {
            // a Submit sends the view's values with its link, as IListView.Submit does
            let target = st.borrow().drawn.get(p as usize).and_then(|d| d.menu.get(m as usize).map(|(link, submit)| {
                (if *submit { concat(link, d.submission_values()) } else { link.clone() }, d.name.clone())
            }));
            if let (Some((address, from)), Some(f)) = (target, fw.upgrade()) { let _ = go(&st, &f, address, Some(&from)); }
        });
        let (st, fw) = (self.state.clone(), self.frame.as_weak());
        self.frame.on_searched(move |p, t| {
            let target = st.borrow().drawn.get(p as usize).map(|d| (concat(&d.search_link, vec![Value::Str(t.to_string())]), d.name.clone()));
            if let (Some((address, from)), Some(f)) = (target, fw.upgrade()) { let _ = go(&st, &f, address, Some(&from)); }
        });
    }

    /// Navigate as the platform would on an event, and redraw from the answer.
    pub fn go(&self, address: Value, from: Option<&str>) -> Result<Frame, String> {
        go(&self.state, &self.frame, address, from)
    }
}

fn go<T: Transport>(state: &Rc<RefCell<State<T>>>, frame: &FrameWindow, address: Value, from: Option<&str>) -> Result<Frame, String> {
    let answer = state.borrow_mut().platform.go(address, from);
    match &answer {
        Ok(_) => redraw(state, frame),
        Err(e) => state.borrow_mut().error = Some(e.clone()),
    }
    answer
}

/// Draw the platform's last frame: the alert, and each pane through render:slint.
/// A frame naming an unpaired kind is drawn as the refusal and nothing else.
pub fn redraw<T: Transport>(state: &Rc<RefCell<State<T>>>, frame: &FrameWindow) {
    let mut st = state.borrow_mut();
    if !st.platform.unpaired.is_empty() {
        frame.set_alert_title("refusing to draw".into());
        frame.set_alert_message(format!("lambda declares control kinds this container does not pair: {}", st.platform.unpaired.join(", ")).into());
        frame.set_panes(ModelRc::new(VecModel::from(Vec::<PaneData>::new())));
        st.drawn.clear();
        return;
    }
    let (title, message) = match &st.platform.alert {
        Some(a) => { let p = props(a); (prop(&p, "Title").text(), prop(&p, "Message").text()) }
        None => (String::new(), String::new()),
    };
    frame.set_alert_title(title.into());
    frame.set_alert_message(message.into());
    let mut drawn = Vec::new();
    let mut refused = None;
    let mut x = 0.0;
    for (i, (name, rows)) in st.platform.placed.iter().enumerate() {
        let w = st.platform.pane_width(i) as f32;
        match screen(name, rows, x, w) {
            Ok(d) => drawn.push(d),
            Err(e) => refused = Some(e),
        }
        x += w;
    }
    if refused.is_some() { st.error = refused; }
    frame.set_panes(ModelRc::new(VecModel::from(drawn.iter().map(|d| d.data.clone()).collect::<Vec<_>>())));
    st.drawn = drawn;
}

// ---- THE PIXELS: what a framebuffer shows ------------------------------------

/// A platform with no windowing system: one software window the renderer draws
/// into, as the UEFI framebuffer is drawn.
pub struct Headless(pub Rc<slint::platform::software_renderer::MinimalSoftwareWindow>);

impl slint::platform::Platform for Headless {
    fn create_window_adapter(&self) -> Result<Rc<dyn slint::platform::WindowAdapter>, slint::PlatformError> {
        Ok(self.0.clone())
    }
}

/// Render the window into an RGBA buffer of the given size.
pub fn render_rgba(window: &slint::platform::software_renderer::MinimalSoftwareWindow, width: u32, height: u32) -> Vec<u8> {
    use slint::platform::software_renderer::PremultipliedRgbaColor;
    window.set_size(slint::PhysicalSize::new(width, height));
    slint::platform::update_timers_and_animations();
    window.request_redraw();
    let mut buf = vec![PremultipliedRgbaColor::default(); (width * height) as usize];
    window.draw_if_needed(|r| { r.render(&mut buf, width as usize); });
    buf.iter().flat_map(|p| [p.red, p.green, p.blue, 255]).collect()
}
