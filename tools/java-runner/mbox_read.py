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
def addrs(values):
    return [a.strip().lower() for _, a in getaddresses([str(v) for v in values if v]) if "@" in a]
def text_of(msg):
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    try:
        s = part.get_content()
    except Exception:
        s = (part.get_payload(decode=True) or b"").decode(part.get_content_charset() or "utf-8", "replace")
    if part.get_content_type() == "text/html":
        s = re.sub("(?is)<(script|style).*?</(script|style)>", " ", s)
        s = re.sub("(?i)<br */?>|</p>|</div>", NL, s)
        s = html.unescape(re.sub("<[^>]+>", "", s))
    s = s.replace(CR + NL, NL).replace(CR, NL).strip()
    return s[:20000]
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
    body = text_of(msg)
    if body:
        row["body"] = body
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
