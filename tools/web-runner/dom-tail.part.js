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
  const inputs = {};
  PRIMS.set("render:textbox", r => {
    const p = el("div", {});
    const l = label(r[5], "subtextSize", "sectionTextColor", false);
    Object.assign(l.style, { position: "absolute", left: "0", top: "0",
      width: "100%", height: "22px" });
    p.appendChild(l);
    const i = el("input", { position: "absolute", left: "0", top: "24px",
      width: "95%", fontFamily: sv("fontFamily"),
      fontSize: px(+sv("textSize")), color: sv("textColor") });
    p.appendChild(i);
    inputs[r[6]] = i;
    return p;
  });
  PRIMS.set("render:button", r => {
    const b = el("button", { fontFamily: sv("fontFamily"),
      fontSize: px(+sv("textSize")), cursor: "pointer" });
    b.textContent = r[5];
    b.onclick = () => {
      const i = inputs[r[6]];
      if (i && i.value) navigate(["submit", r[6], i.value]);
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

  function navigate(addr) {
    // ui:navpe answers <store'', stacks', bytes>; this container has no
    // durable medium (a static server), so the bytes go unappended and
    // the browser browses the composed journal's world - the one honest
    // limitation, until a one-line POST endpoint gives the page its write
    const od = Ev("ui:navpe", [store, stacks, addr]);
    store = od[0];
    stacks = od[1];
    renderPane("master");
    renderPane("detail");
  }

  if (typeof window === "undefined") {
    // worker context: the same composed bytes serve as the derivation
    // worker - same mu, same store; answer the fixed store on request
    self.onmessage = () => { self.postMessage(Ev("ui:boot", CELLS.slice())); };
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
    document.title = Ev("ui:screen", [store, [], []])[1];
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
