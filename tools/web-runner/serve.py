# -*- coding: utf-8 -*-
# The web station's server: static files plus the ONE durable write.
# POST /append?d=<designation> appends the request body to the app's
# carrier of that name - the worthy driver, network-shaped: the bytes,
# their name, and their sequence are all canon's; this end holds the
# platform's single irreducible act. Single-writer by usage.
#   python serve.py [port] [appdir]        (default 8137, ../../apps/elysium)
import io
import os
import sys
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
APPDIR = os.path.abspath(sys.argv[2] if len(sys.argv) > 2
                         else os.path.join("..", "..", "apps", "elysium"))

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if not self.path.startswith("/append"):
            self.send_error(404)
            return
        d = "journal"
        if "?d=" in self.path:
            d = self.path.split("?d=", 1)[1]
        if "/" in d or "\\" in d or ".." in d:
            self.send_error(400)
            return
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        with io.open(os.path.join(APPDIR, d), "ab") as f:
            f.write(body)
        self.send_response(200)
        self.send_header("Content-Length", "1")
        self.end_headers()
        self.wfile.write(b"T")

if __name__ == "__main__":
    print("serving on %d, appending into %s" % (PORT, APPDIR))
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
