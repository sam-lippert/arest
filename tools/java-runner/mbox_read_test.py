import json
import mailbox
import os
import subprocess
import sys
from email.message import EmailMessage
# The mbox Fetcher's reader over a synthetic mailbox of seven messages: what it yields as each message's own text, that
# no character a reader does not see is left, that the whole body keeps what the message quotes, and that marked-up
# text reads as the lines its elements stand on. No real mail is read.
#   python mbox_read_test.py <mbox_read.py> <scratch dir>
script, scratch = sys.argv[1], sys.argv[2]
os.makedirs(scratch, exist_ok=True)
path = os.path.join(scratch, 'synthetic-%d.mbox' % os.getpid())
ZW = '‌​﻿͏'


def mail(mid, body, html=None, reply=None):
    m = EmailMessage()
    m['From'] = 'Pat Example <pat@example.com>'
    m['To'] = 'desk@example.org'
    m['Subject'] = 'Re: an alert'
    m['Date'] = 'Mon, 26 Oct 2026 10:35:00 -0700'
    m['Message-ID'] = '<%s>' % mid
    if reply:
        m['In-Reply-To'] = '<%s>' % reply
    if body is not None:
        m.set_content(body)
        if html is not None:
            m.add_alternative(html, subtype='html')
    else:
        m.set_content(html, subtype='html')
    return m


box = mailbox.mbox(path, create=True)
box.add(mail('plain-top@example.com',
             'Thanks, that fixed it.\n\nOne more question: is the key rotated?\n\n'
             'On Mon, Oct 26, 2026 at 10:35 AM Desk Example <desk@example.org>\nwrote:\n\n'
             '> We reset the key.\n>\n> On Sun, Oct 25, 2026 Pat wrote:\n>> it is broken\n', reply='a@example.org'))
box.add(mail('html-only@example.com', None,
             '<div dir="ltr">Still failing for me.</div><br><div class="gmail_quote"><div class="gmail_attr">On Sun, Oct 25, 2026 '
             'Alerts &lt;alerts@example.org&gt; wrote:<br></div><blockquote>Your usage alert' + ZW * 40 + '<p>details</p></blockquote></div>'))
box.add(mail('no-quote@example.com', 'A first message with' + ZW + ' no quote at all.\n\n\n\n\nSigned, Pat\n'))
box.add(mail('inline@example.com', '> is the key rotated?\n\nYes, last night.\n\n> and the old one?\n\nRevoked.\n'))
box.add(mail('outlook@example.com',
             'Please cancel my plan.\n\n________________________________\nFrom: Desk Example <desk@example.org>\n'
             'Sent: Monday, October 26, 2026 10:35 AM\nTo: Pat\nSubject: an alert\n\nYour usage alert\n'))
box.add(mail('html-blocks@example.com', None,
             '<div dir="ltr">Is the key rotated instead of reset ?<div>Also, is there a log?</div><div><br></div>'
             '<div id="sig">Sent from my phone</div></div>'))
box.add(mail('html-cells@example.com', None,
             '<table><tr><td>Plan</td><td>Growth</td></tr><tr><td>Seats</td><td>5</td></tr></table><p>Thanks<br>Pat</p>'))
box.flush()
box.close()
env = dict(os.environ, ARE_MBOX=path, ARE_FROM='pat@example.com')
env.pop('ARE_TO', None)
env.pop('ARE_ID', None)
out = subprocess.run([sys.executable, '-I', script], env=env, capture_output=True, text=True, encoding='utf-8')
if out.returncode != 0:
    print('reader failed:', out.stderr[-600:])
    sys.exit(1)
os.remove(path)
got = json.loads(out.stdout)
rows = dict((r['message_id'], r) for r in got['messages'])
want = {
    'plain-top@example.com': 'Thanks, that fixed it.\n\nOne more question: is the key rotated?',
    'html-only@example.com': 'Still failing for me.',
    'no-quote@example.com': 'A first message with no quote at all.\n\n\nSigned, Pat',
    'inline@example.com': '> is the key rotated?\n\nYes, last night.\n\n> and the old one?\n\nRevoked.',
    'outlook@example.com': 'Please cancel my plan.',
    'html-blocks@example.com': 'Is the key rotated instead of reset ?\nAlso, is there a log?\n\nSent from my phone',
    'html-cells@example.com': 'Plan Growth\nSeats 5\nThanks\nPat',
}
ok = got['matched'] == 7
for mid, text in want.items():
    r = rows.get(mid, {})
    same = r.get('own_text') == text
    hidden = any(ch in r.get('body', '') or ch in r.get('own_text', '') for ch in ZW)
    whole = len(r.get('body', '')) >= len(r.get('own_text', ''))
    print(mid, 'own_text', 'ok' if same else 'DIFFERS ' + repr(r.get('own_text')), '| hidden characters', 'left' if hidden else 'gone',
          '| body', len(r.get('body', '')), 'characters')
    ok = ok and same and not hidden and whole
print('quoted chain kept in the whole body of the first:', 'We reset the key.' in rows['plain-top@example.com'].get('body', ''))
print('ALL OK' if ok else 'FAILED')
