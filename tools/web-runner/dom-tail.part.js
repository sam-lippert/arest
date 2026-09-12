;
// THE WEB CONTAINER: the js mu (the fastest station) plus registered
// DOM realizations of the eight abstract controls - a render factory
// and nothing else. The container holds <store, stacks>, evaluates
// ui:navp once per navigation, renders each registered pane, and
// decides nothing. Registration is INTO the mu's own surface (PRIMS,
// where lex and implode live), so drawing is rho-application.
(function () {
  const STYLE = {};
  for (const row of Ev(["COMP", "theta:flatten", "ui:style"], []))
    STYLE[row[0]] = "" + row[1];
  const sv = p => STYLE[p];
  const px = n => n + "px";

  let store = CELLS.slice();
  let stacks = [["master", []], ["detail", []]];
  let paneEls = {};

  function el(tag, css) {
    const e = document.createElement(tag);
    Object.assign(e.style, css || {});
    return e;
  }
  function place(e, x, y, w, h) {
    Object.assign(e.style, { position: "absolute", left: px(x), top: px(y),
      width: px(w), height: px(h) });
    return e;
  }
  function label(text, sizeProp, colorProp, bold) {
    const d = el("div", {
      fontFamily: sv("fontFamily"), fontSize: px(+sv(sizeProp)),
      color: sv(colorProp), fontWeight: bold ? "bold" : "normal",
      overflow: "hidden", whiteSpace: "nowrap", lineHeight: "normal",
      display: "flex", alignItems: "center" });
    d.textContent = text;
    return d;
  }

  // the render factory: eight registered realizations, nothing more
  PRIMS.set("render:canvas", r => {
    const c = paneEls.current;
    c.style.background = sv("layerBg");
    c.style.width = px(r[3]); c.style.height = px(r[4]);
    return null;
  });
  PRIMS.set("render:headerbar", r =>
    el("div", { background: sv("headerColor"),
      borderBottom: "1px solid " + sv("headerSepColor") }));
  PRIMS.set("render:titletext", r => label(r[5], "titleSize", "titleColor", true));
  PRIMS.set("render:backbtn", r => {
    const b = label(sv("backLabel"), "textSize", "linkColor", false);
    b.style.cursor = "pointer";
    b.onclick = () => navigate(r[5]);
    return b;
  });
  PRIMS.set("render:sectionheader", r => {
    const d = label(r[5], "sectionSize", "sectionTextColor", false);
    d.style.alignItems = "flex-end";
    return d;
  });
  PRIMS.set("render:sep", r => el("div", { background: sv("sepColor") }));
  PRIMS.set("render:itemrow", r => {
    const linked = !(Array.isArray(r[7]) && r[7].length === 0);
    const sub = !(Array.isArray(r[6]) && r[6].length === 0);
    const p = el("div", { background: sv("itemBg") });
    const inner = Ev("ui:iteminner", [r[3], r[4], sub ? "T" : "F"]);
    const t = label(r[5], "textSize", linked ? "linkColor" : "textColor", false);
    p.appendChild(place(t, inner[0][0], inner[0][1], inner[0][2], inner[0][3]));
    if (sub) {
      const s = label(r[6], "subtextSize", "subtextColor", false);
      p.appendChild(place(s, inner[1][0], inner[1][1], inner[1][2], inner[1][3]));
    }
    if (linked) {
      const ch = label(sv("chevGlyph"), "titleSize", "chevronColor", false);
      p.appendChild(place(ch, inner[2][0], inner[2][1], inner[2][2], inner[2][3]));
      p.style.cursor = "pointer";
      p.onmouseenter = () => p.style.background = sv("selectionColor");
      p.onmouseleave = () => p.style.background = sv("itemBg");
      p.onclick = () => navigate(r[7]);
    }
    return p;
  });
  // the typed entry controls: the placed row is <control, x, y, w, h,
  // label, fact type, options>, and the control's name is what the
  // column's conceptual data type chose in canon (ui:control_for over
  // ui:field_type); each registration realizes one of them as the one
  // DOM element it is, and reads back through the same `inputs` map
  const inputs = {};
  function field(r, input) {
    const p = el("div", {});
    const l = label(r[5], "subtextSize", "sectionTextColor", false);
    Object.assign(l.style, { position: "absolute", left: "0", top: "0",
      width: "100%", height: "22px" });
    p.appendChild(l);
    Object.assign(input.style, { position: "absolute", left: "0", top: "24px",
      width: "95%", fontFamily: sv("fontFamily"),
      fontSize: px(+sv("textSize")), color: sv("textColor") });
    p.appendChild(input);
    inputs[r[6]] = input;
    return p;
  }
  const typed = type => r => { const i = el("input", {}); i.type = type; return field(r, i); };
  PRIMS.set("render:textbox", typed("text"));
  PRIMS.set("render:numericfield", typed("number"));
  PRIMS.set("render:datepicker", typed("date"));
  PRIMS.set("render:timepicker", typed("time"));
  PRIMS.set("render:imagepicker", typed("url"));
  PRIMS.set("render:textarea", r => field(r, el("textarea", {})));
  PRIMS.set("render:label", r => { const i = el("input", {}); i.readOnly = true; return field(r, i); });
  PRIMS.set("render:switch", r => {
    const i = el("input", {}); i.type = "checkbox";
    const p = field(r, i);
    inputs[r[6]] = { get value() { return i.checked ? "true" : ""; } };
    return p;
  });
  const select = r => {
    const s = el("select", {});
    s.appendChild(el("option", {}));
    for (const o of (Array.isArray(r[7]) ? r[7] : [])) {
      const e = el("option", {}); e.textContent = o; s.appendChild(e);
    }
    return field(r, s);
  };
  PRIMS.set("render:selectlist", select);
  PRIMS.set("render:navigationfield", select);
  PRIMS.set("render:button", r => {
    const b = el("button", { fontFamily: sv("fontFamily"),
      fontSize: px(+sv("textSize")), cursor: "pointer" });
    b.textContent = r[5];
    b.onclick = () => {
      // the submit carries the id plus every filled field as <ft, v>
      // pairs - the I-construction: entity and fact instances in one
      // command (Def 6's resolve takes both)
      const group = r[6];
      const idf = inputs[group];
      if (!idf || !idf.value) return;
      const addr = ["submit", group, idf.value];
      for (const ft in inputs)
        if (ft !== group && inputs[ft].value) addr.push(ft, inputs[ft].value);
      for (const ft in inputs) delete inputs[ft];
      navigate(addr);
    };
    return b;
  });
  PRIMS.set("render:blocktext", r => {
    const t = el("pre", { background: sv("itemBg"), color: sv("textColor"),
      fontSize: px(+sv("blockSize")), margin: "0", overflow: "auto",
      padding: px(+sv("pad")) });
    t.textContent = r[5];
    return t;
  });

  function renderPane(pane) {
    const host = paneEls[pane];
    paneEls.current = host;
    const tree = Ev("ui:pane_view", [store, stacks, pane]);
    const placed = Ev("ui:arrange", [tree, host.clientWidth || 320]);
    host.innerHTML = "";
    const widgets = Ev("ui:render", placed);
    for (let i = 0; i < widgets.length; i++) {
      const c = widgets[i];
      if (c) {
        const r = placed[i];
        host.appendChild(place(c, r[1], r[2], r[3], r[4]));
      }
    }
  }

  // NO store:append. The journal is gone (Samuel, 2026-09-11), so this page
  // POSTs nothing to serve.py and keeps its store for the life of the tab.
  // Durability here is the same debt the GUI containers carry: a write into
  // the tables, which this station does not do yet.
  // the clock: command addresses stamp their tau (Fact < Event, and
  // each Event occurred at exactly one Timestamp); ISO 8601 UTC to the
  // millisecond, the same bytes every host stamps for the same instant
  PRIMS.set("clock", () => new Date().toISOString());

  function navigate(addr) {
    const od = Ev("ui:navpe", [store, stacks, addr]);
    store = od[0];
    stacks = od[1];
    renderPane("master");
    renderPane("detail");
  }

  if (typeof window === "undefined") {
    // worker context: the same composed bytes serve as the derivation
    // worker - same mu, same store; answer the fixed store on request
    self.onmessage = () => { self.postMessage(Ev("solve:fix", CELLS.slice())[0]); };
    return;
  }
  window.addEventListener("load", () => {
    const root = el("div", { display: "flex", height: "100vh",
      fontFamily: sv("fontFamily") });
    paneEls.master = el("div", { position: "relative", width: "320px",
      flexShrink: "0", overflowY: "auto", overflowX: "hidden" });
    paneEls.detail = el("div", { position: "relative", flexGrow: "1",
      overflowY: "auto", overflowX: "hidden" });
    root.appendChild(paneEls.master);
    root.appendChild(paneEls.detail);
    document.body.style.margin = "0";
    document.body.appendChild(root);
    document.title = Ev("ui:screen", [store, [], [], []])[1];
    navigate([]);
    // browse the FIXED store: derive on a WORKER (the mu is synchronous;
    // 104s of solve:fix must not block the UI thread), swap, re-render
    try {
      const w = new Worker("composed.page.g.js");
      w.onmessage = e => { store = e.data; navigate([]); w.terminate(); };
      w.postMessage(1);
    } catch (err) {
      console.log("no worker (file://?) - browsing the pristine store", err);
    }
    window.addEventListener("resize", () => navigate([]));
  });
})();
