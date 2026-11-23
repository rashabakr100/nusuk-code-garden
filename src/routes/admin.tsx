import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { orderCodes } from "@/lib/code-order";
import { useEffect, useState } from "react";
import { fetchMoreCodes } from "@/lib/nusukkey-fetch.functions";
import { MIN_MS_BETWEEN_RUNS } from "@/lib/nusukkey-import";
import { bulkImportCodes, type BulkResult } from "@/lib/bulk-import.functions";
import { MAX_BULK_NEW, MAX_BULK_TEXT } from "@/lib/bulk-import";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Code usage — Nusuk Referral Codes" },
      { name: "description", content: "Admin view of how often each Nusuk referral code is copied and opened." },
      { property: "og:title", content: "Code usage — Nusuk Referral Codes" },
      { property: "og:description", content: "Admin view of referral code usage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsage,
});

type Row = {
  code_id: string;
  code: string;
  copies: number;
  opens: number;
  people: number;
  last_used_at: string | null;
};

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function AdminUsage() {
  const account = useAccount();
  const isAdmin = !!account?.isAdmin;

  const { data = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["code-usage", account?.id],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("code_usage_summary");
      if (error) throw error;
      return (data as Row[]).map((r) => ({
        ...r,
        copies: Number(r.copies),
        opens: Number(r.opens),
        people: Number(r.people),
      }));
    },
  });

  const rows = orderCodes(data);
  const totalCopies = rows.reduce((n, r) => n + r.copies, 0);
  const totalOpens = rows.reduce((n, r) => n + r.opens, 0);

  return (
    <main className="min-h-screen bg-background pattern-bg">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft className="h-4 w-4" /> الأكواد · Codes
        </Link>
        <h1 className="mt-4 font-display text-3xl text-foreground">استخدام الأكواد · Code usage</h1>

        {!isAdmin ? (
          <p className="mt-6 rounded-2xl bg-card p-4 text-muted-foreground shadow-soft">
            للمشرفين فقط · Admins only. Sign in with the admin account from the top-right corner of the codes page.
          </p>
        ) : (
          <>
            <FetchCodes />
            <BulkImport />

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="نسخ · Copies" value={totalCopies} />
              <Stat label="فتح · Opens" value={totalOpens} />
              <Stat label="أكواد · Codes" value={rows.length} />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Counted from today onwards. "Opens" are "Copy and open" taps.</p>
              <button
                type="button"
                onClick={() => refetch()}
                aria-label="Refresh"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary"
              >
                <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary text-xs text-secondary-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-2 py-2 text-right font-medium">Copies</th>
                    <th className="px-2 py-2 text-right font-medium">Opens</th>
                    <th className="px-2 py-2 text-right font-medium">People</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Last used</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.code_id} className="border-t border-border">
                      <td className="break-all px-3 py-2 font-mono text-foreground">{r.code}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.copies}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.opens}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.people}</td>
                      <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{formatWhen(r.last_used_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-soft">
      <p className="text-2xl font-semibold tabular-nums text-primary">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Admin-only "Fetch more codes" button for nusukkey.xyz, plus the last 10 results. */
function FetchCodes() {
  const qc = useQueryClient();
  const fetchNow = useServerFn(fetchMoreCodes);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const { data: runs = [] } = useQuery({
    queryKey: ["code-import-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("code_import_runs")
        .select("*")
        .order("ran_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });
  const run = useMutation({
    mutationFn: () => fetchNow(),
    onMutate: () => setCooldownUntil(Date.now() + MIN_MS_BETWEEN_RUNS),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["code-import-runs"] });
      qc.invalidateQueries({ queryKey: ["codes"] });
    },
  });

  const waiting = cooldownUntil > now;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [waiting]);
  useEffect(() => setNow(Date.now()), [cooldownUntil]);

  let result: string | null = null;
  const d = run.data;
  if (d?.status === "ok") result = `${d.added} new, ${d.alreadyHad} already had`;
  else if (d?.status === "too_soon") result = "Please wait 15 seconds between fetches";
  else if (d?.status === "failed" || run.error) result = "Fetch failed — existing codes unchanged";
  const sample = d && d.status !== "too_soon" ? d.sample : [];

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>
          nusukkey.xyz
          {result && <span className="ms-2 text-foreground">— {result}</span>}
        </p>
        <button
          type="button"
          onClick={() => run.mutate()}
          disabled={run.isPending || waiting}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-60"
        >
          <RefreshCw className={run.isPending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
          {waiting && !run.isPending ? `Wait ${Math.ceil((cooldownUntil - now) / 1000)}s` : "Fetch more codes"}
        </button>
      </div>
      {sample.length > 0 && (
        <p className="mt-2 break-all">
          First codes read: <span className="font-mono text-foreground">{sample.join(", ")}</span>
        </p>
      )}
      {runs.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-2">
          {runs.map((r) => (
            <li key={r.id} title={r.reason ?? undefined}>
              {timeAgo(r.ran_at)} ·{" "}
              {r.status === "ok" ? (
                <span className="text-foreground">
                  {r.added} new, {r.already_had} already had
                </span>
              ) : (
                <span className="text-destructive">failed{r.reason ? `: ${r.reason}` : ""}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Admin-only "Bulk import": paste any text, preview the codes found, then add only the new ones. */
function BulkImport() {
  const qc = useQueryClient();
  const runBulk = useServerFn(bulkImportCodes);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Extract<BulkResult, { status: "preview" }> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const extract = useMutation({
    mutationFn: () => runBulk({ data: { text, mode: "preview" } }),
    onMutate: () => {
      setPreview(null);
      setMessage(null);
    },
    onSuccess: (r) => {
      if (r.status === "preview") setPreview(r);
      else if (r.status === "none") setMessage("No codes found");
      else setMessage("Couldn't read the codes — nothing changed");
    },
    onError: () => setMessage("Couldn't read the codes — nothing changed"),
  });

  const save = useMutation({
    mutationFn: () => runBulk({ data: { text, mode: "import" } }),
    onSuccess: (r) => {
      setPreview(null);
      if (r.status === "imported") {
        setMessage(
          `${r.added} added, ${r.alreadyHad} already had, ${r.ignored} ignored` +
            (r.overCap > 0 ? ` — ${r.overCap} more not imported (limit ${MAX_BULK_NEW}); paste again to add them` : ""),
        );
        setText("");
        qc.invalidateQueries({ queryKey: ["codes"] });
        qc.invalidateQueries({ queryKey: ["code-usage"] });
      } else if (r.status === "none") setMessage("No codes found");
      else setMessage("Import failed — existing codes unchanged");
    },
    onError: () => setMessage("Import failed — existing codes unchanged"),
  });

  const busy = extract.isPending || save.isPending;

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground shadow-soft">
      <p className="text-foreground">Bulk import</p>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        maxLength={MAX_BULK_TEXT}
        rows={6}
        placeholder="Paste a post or messages with codes"
        aria-label="Text with codes to import"
        spellCheck={false}
        dir="ltr"
        className="mt-2 w-full resize-y rounded-lg border border-input bg-background p-2 font-mono text-xs text-foreground outline-none focus:border-primary"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => extract.mutate()}
          disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-60"
        >
          {extract.isPending ? "Extracting…" : "Extract codes"}
        </button>
        {preview && preview.newCount > 0 && (
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? "Importing…" : `Import ${Math.min(preview.newCount, MAX_BULK_NEW)}`}
          </button>
        )}
        {message && <span className="text-foreground">{message}</span>}
      </div>
      {preview && (
        <div className="mt-2 space-y-1">
          <p className="text-foreground">
            {preview.newCount} new · {preview.duplicates} duplicates · {preview.ignored} ignored as invalid
          </p>
          {preview.overCap > 0 && (
            <p className="text-destructive">
              The text has {preview.newCount} new codes; only the first {MAX_BULK_NEW} will be imported this time.
            </p>
          )}
          {preview.sample.length > 0 && (
            <p className="break-all">
              First new codes: <span className="font-mono text-foreground">{preview.sample.join(", ")}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
