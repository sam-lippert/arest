
; }

/* effects only, the Platform seam: apply the canon's own report to the
 * composed store and print the verdicts, byte-identical to the other
 * stations so a diff of any two captures is the parity check itself. */
int main(int argc, char** argv) {
    load_root();
    load_ds();
    load_na();
    (void)ROOT; (void)DS; (void)NA;
    const char* report_name = (argc > 1 && !strcmp(argv[1], "app")) ? "law:app_report" : "law:report";
    Obj store = mk_seq(ncells, cells);
    Obj report = Ev(mk_str(report_name), store);
    need_seq(report);
    int ok = 1;
    for (long i = 0; i < report->n; i++) {
        Obj pair = report->it[i];
        int pass = is_T(el(pair, 1));
        ok = ok && pass;
        printf(pass ? "  law OK: %s\n" : "  LAW FAILED: %s -> F\n", need_str(el(pair, 0)));
    }
    if (ok) printf("ALL LAWS HOLD (canon-evaluated: %s over the composed store)\n", report_name);
    else printf("LAW FAILURE\n");
    return ok ? 0 : 1;
}
