# -*- coding: utf-8 -*-
# The web station's server: static files, and nothing else.
#
# IT USED TO HOLD ONE WRITE. POST /append?d=<designation> appended the request
# body to the app's carrier of that name, and it was the browser station's half
# of the journal: the page evaluated ui:navpe, took the third slot, and posted
# those bytes here. The journal is gone (Samuel, 2026-09-11), so nothing calls
# it -- and an unauthenticated append-to-a-file endpoint with no caller is worse
# than no endpoint, so it goes with its caller rather than waiting for one.
#
# What this station owes instead is what the GUI containers owe: a write into
# the tables, the way the js host's emitToDb does it. Until then the page keeps
# its store for the life of the tab.
#   python serve.py [port] [appdir]        (default 8137, ../../apps/arest)
import os
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
APPDIR = os.path.abspath(sys.argv[2] if len(sys.argv) > 2
                         else os.path.join("..", "..", "apps", "arest"))

if __name__ == "__main__":
    print("serving on %d, files from %s" % (PORT, APPDIR))
    HTTPServer(("127.0.0.1", PORT), SimpleHTTPRequestHandler).serve_forever()
