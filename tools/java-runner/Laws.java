import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

// The lambda laws over the booted base on the Java host, one by one, a peer of tools/js-runner/laws.js,
// tools/cs-runner/laws and tools/rust-host/src/bin/laws.rs: boot the store once (main:boot over the cells),
// apply each named law to it, and print its name, its answer and its time.
//
//   java -Xss512m -cp "../lib/sqlite-jdbc.jar;../lib/slf4j-api.jar;." Laws <list-file | law...>
public class Laws {
    public static void main(String[] args) throws Exception {
        String lambda = Reader.path("AREST_LAMBDA", "../../arest");
        Reader.load(lambda);
        Reader.load(Reader.path("AREST_TESTS", "../../arest.tests"));
        Reader.load(Reader.path("AREST_SCENARIOS", "../../engine/shared/scenarios.canon"));
        Reader.loadBase(Reader.path("AREST_CARRIERS", "../base"), lambda);
        Registrations.register(lambda);
        List<String> names = new ArrayList<String>();
        if (args.length == 1 && Files.isRegularFile(Paths.get(args[0]))) {
            for (String l : Files.readAllLines(Paths.get(args[0]))) if (!l.trim().isEmpty()) names.add(l.trim());
        } else for (String a : args) names.add(a);
        long t = System.nanoTime();
        Object store = Arest.Ev("main:boot", Arest.CELLS.toArray());
        System.out.println("boot " + (System.nanoTime() - t) / 1000000 + " ms");
        int bad = 0;
        for (String l : names) {
            t = System.nanoTime();
            String r;
            try {
                Object o = Arest.Ev(l, store);
                r = o instanceof Object[] ? "SEQ " + ((Object[]) o).length : String.valueOf(o);
            } catch (Throwable e) {
                r = "ERROR " + String.valueOf(e.getMessage()).replace('\n', ' ');
                if (r.length() > 260) r = r.substring(0, 260);
            }
            if (!"T".equals(r)) bad++;
            System.out.println(l + " " + r + " " + (System.nanoTime() - t) / 1000000 + " ms");
        }
        System.out.println(names.size() + " laws, " + bad + " not T");
        System.exit(bad == 0 ? 0 : 1);
    }
}
