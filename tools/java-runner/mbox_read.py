import email.policy, html, json, mailbox, os, re
from datetime import timezone
from email.parser import BytesHeaderParser, BytesParser
from email.utils import getaddresses, parsedate_to_datetime
NL = chr(10)
CR = chr(13)
want_from = os.environ.get("ARE_FROM", "").strip().lower()
want_to = os.environ.get("ARE_TO", "").strip().lower()
want_id = os.environ.get("ARE_ID", "").strip().strip("<>").strip()
hp = BytesHeaderParser(policy=email.policy.compat32)
bp = BytesParser(policy=email.policy.default)
# The characters a reader does not see and a sender pads a preview with: zero width space and non-joiner, word joiner,
# the byte order mark, soft hyphen, combining grapheme joiner, Mongolian vowel separator.
HIDDEN = [chr(n) for n in (0x200B, 0x200C, 0x2060, 0xFEFF, 0x00AD, 0x034F, 0x180E)]
# Where a reply's own text ends and what it quotes begins: the line that says who wrote what follows (it may wrap),
# a quoted line, a forwarded message's rule, and the header block a mail program puts above what it quotes.
SAID = re.compile("(?m)^On [^" + NL + "]*(?:" + NL + "[^" + NL + "]*){0,2}?wrote:[ ]*$")
QUOTED = re.compile("(?m)^>")
RULED = re.compile("(?m)^-{2,}[ ]*(?:Original|Forwarded) [Mm]essage[ ]*-{2,}")
HEADED = re.compile("(?m)^From:[^" + NL + "]*" + NL + "(?:Sent|Date):")
QUOTE_TAG = re.compile("(?is)<div[^>]*class=[^>]*gmail_quote|<blockquote")
def addrs(values):
    return [a.strip().lower() for _, a in getaddresses([str(v) for v in values if v]) if "@" in a]
def part_of(msg):
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return "", False
    try:
        s = part.get_content()
    except Exception:
        s = (part.get_payload(decode=True) or b"").decode(part.get_content_charset() or "utf-8", "replace")
    return s, part.get_content_type() == "text/html"
def as_text(s, marked):
    if marked:
        s = re.sub("(?is)<(script|style).*?</(script|style)>", " ", s)
        s = re.sub("(?i)<br */?>|</p>|</div>", NL, s)
        s = html.unescape(re.sub("<[^>]+>", "", s))
    return s.replace(CR + NL, NL).replace(CR, NL).strip()
def seen(s):
    for ch in HIDDEN:
        s = s.replace(ch, "")
    out, blank = [], 0
    for line in s.split(NL):
        line = line.rstrip()
        blank = blank + 1 if not line else 0
        if blank <= 2:
            out.append(line)
    return NL.join(out).strip()
def own(s):
    cuts = [m.start() for m in (SAID.search(s), QUOTED.search(s), RULED.search(s), HEADED.search(s)) if m]
    if not cuts:
        return s
    lines = s[:min(cuts)].rstrip().split(NL)
    while lines and len(lines[-1].strip()) >= 5 and not lines[-1].strip().strip("_-"):
        lines.pop()
    return NL.join(lines).rstrip()
def texts_of(msg):
    s, marked = part_of(msg)
    body = seen(as_text(s, marked))
    if marked:
        m = QUOTE_TAG.search(s)
        if m:
            s = s[:m.start()]
    mine = own(seen(as_text(s, marked)))
    return body[:20000], (mine or body)[:20000]
box = mailbox.mbox(os.environ["ARE_MBOX"], create=False)
rows, scanned, matched, unnamed = [], 0, 0, 0
for key in box.iterkeys():
    scanned += 1
    head = []
    for line in box.get_file(key):
        if not line.strip():
            break
        head.append(line)
    h = hp.parsebytes(b"".join(head))
    try:
        if int(h.get("X-Mozilla-Status", "0") or "0", 16) & 8:
            continue
    except ValueError:
        pass
    frm, to, cc = addrs(h.get_all("From", [])), addrs(h.get_all("To", [])), addrs(h.get_all("Cc", []))
    if want_from and want_from not in frm:
        continue
    if want_to and want_to not in to and want_to not in cc:
        continue
    mid = (h.get("Message-ID") or "").strip().strip("<>").strip()
    if not mid:
        unnamed += 1
        continue
    if want_id and mid != want_id:
        continue
    matched += 1
    msg = bp.parsebytes(box.get_bytes(key))
    row = {"message_id": mid}
    if frm:
        row["from"] = frm[0]
    try:
        d = parsedate_to_datetime(h.get("Date"))
        if d.tzinfo is not None:
            d = d.astimezone(timezone.utc)
        row["date"] = d.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        pass
    if msg.get("Subject"):
        row["subject"] = str(msg.get("Subject")).strip()
    body, mine = texts_of(msg)
    if body:
        row["body"] = body
        row["own_text"] = mine
    m = re.search("<([^>]+)>", h.get("In-Reply-To") or "")
    if m:
        row["in_reply_to"] = m.group(1).strip()
    recips = [("to", a) for a in to] + [("cc", a) for a in cc]
    for kind, a in recips or [(None, None)]:
        r = dict(row)
        if kind:
            r[kind] = a
        rows.append(r)
print(json.dumps({"messages": rows, "scanned": scanned, "matched": matched, "unnamed": unnamed}))
