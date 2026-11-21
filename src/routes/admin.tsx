import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/use-account";
import { orderCodes } from "@/lib/code-order";

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
            <div className="mt-6 grid grid-cols-3 gap-2">
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
