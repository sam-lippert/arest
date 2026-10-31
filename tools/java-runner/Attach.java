import java.io.InputStream;
import java.io.OutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

// A SESSION'S STDIO, CONNECTED TO A ROUTER ALREADY LISTENING. Transport only: it sends the session's
// login as the first line (arest/client, AREST_LOGIN) and then copies bytes both ways until either
// side closes. It starts nothing; with no router on AREST_ROUTER_PORT (41817) it exits and says so.
//
//   java Attach
public class Attach {
    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(Reader.path("AREST_ROUTER_PORT", "41817"));
        Socket s;
        try { s = new Socket("127.0.0.1", port); }
        catch (Exception e) { System.err.println("attach: no router listens on 127.0.0.1:" + port + ": " + e.getMessage()); System.exit(1); return; }
        final OutputStream up = s.getOutputStream();
        String login = Reader.path("AREST_LOGIN", "").replace("\\", "\\\\").replace("\"", "\\\"");
        up.write(("{\"jsonrpc\":\"2.0\",\"method\":\"arest/client\",\"params\":{\"login\":\"" + login + "\"}}\n").getBytes(StandardCharsets.UTF_8));
        up.flush();
        final InputStream down = s.getInputStream();
        Thread back = new Thread(() -> { copy(down, System.out); System.exit(0); });
        back.setDaemon(true);
        back.start();
        copy(System.in, up);
        s.close();
        System.exit(0);
    }

    static void copy(InputStream in, OutputStream out) {
        byte[] b = new byte[65536];
        try { for (int n; (n = in.read(b)) > 0; ) { out.write(b, 0, n); out.flush(); } }
        catch (Exception e) { }
    }
}
