// The wasm host's loader: the six-line contract over linear memory, no
// wasm-bindgen. `load(bytes)` instantiates the module built by
//   cargo rustc --lib --target wasm32-unknown-unknown --crate-type cdylib
// and `ask(argv)` hands canon `main` an address exactly as the CLI does:
// the arguments go in joined by 0x1F, canon's flag and text come back.
// Run directly, it is the CLI over the module:
//   bun tools/rust-host/wasm.js <address...>
// AREST_TIMING=1 reports the load, the boot and the ask on stderr.
const SEP = String.fromCharCode(31);
const timing = !!process.env.AREST_TIMING;
let t0 = performance.now();
const mark = (what) => {
  if (!timing) return;
  const t = performance.now();
  console.error(`timing: ${what} ${Math.round(t - t0)} ms`);
  t0 = t;
};

export async function load(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  mark("instantiate");
  const { memory, arest_alloc, arest_free, arest_ask, arest_boot } = instance.exports;
  const enc = new TextEncoder(), dec = new TextDecoder();
  return {
    // load canon and the carriers; answers the cell count, the boot receipt
    boot() {
      const n = arest_boot();
      mark("boot");
      return n;
    },
    ask(argv) {
      const inb = enc.encode(argv.join(SEP));
      const ip = arest_alloc(inb.length);
      new Uint8Array(memory.buffer, ip, inb.length).set(inb);
      const op = arest_ask(ip, inb.length);
      arest_free(ip, inb.length);
      // memory.buffer is re-read after the call: the module may have grown
      const len = new DataView(memory.buffer).getUint32(op, true);
      const body = new Uint8Array(memory.buffer, op + 4, len);
      const ok = body[0] === 0x54;
      const text = dec.decode(body.subarray(1));
      arest_free(op, 4 + len);
      mark("ask");
      return [text, ok];
    },
  };
}

if (import.meta.main) {
  const { readFileSync } = await import("node:fs");
  const here = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const path = process.env.AREST_WASM || here + "target/wasm32-unknown-unknown/debug/arest_host.wasm";
  const bytes = readFileSync(path);
  mark("read " + bytes.length + " bytes");
  const host = await load(bytes);
  if (timing) console.error("timing: cells " + host.boot());
  const [text, ok] = host.ask(process.argv.slice(2));
  console.log(text);
  process.exit(ok ? 0 : 1);
}
