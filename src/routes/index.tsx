import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignInMark } from "@/components/sign-in-mark";
import {
  COPY_COOLDOWN_MS,
  canTapToCopy,
  getCopyCooldownMs,
  loadCopied,
  markCopied,
  normalizeCode,
} from "@/lib/copied-codes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nusuk Referral Codes — Share & Copy" },
      { name: "description", content: "Share your Nusuk referral code and copy codes shared by others. Free and open to everyone." },
      { property: "og:title", content: "Nusuk Referral Codes" },
      { property: "og:description", content: "Share and copy Nusuk referral codes for free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Code = { id: string; code: string; created_at: string };

function Index() {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState<Set<string>>(new Set());
  const [nextCopyAt, setNextCopyAt] = useState(0);
  const [now, setNow] = useState(0);
  const nextCopyAtRef = useRef(0);

  useEffect(() => setCopied(loadCopied()), []);

  useEffect(() => {
    if (!nextCopyAt) return;

    const update = () => {
      const current = Date.now();
      setNow(current);
      if (current >= nextCopyAt) setNextCopyAt(0);
    };

    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [nextCopyAt]);

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Code[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`codes-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "referral_codes" }, () =>
        qc.invalidateQueries({ queryKey: ["codes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const add = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.from("referral_codes").insert({ code });
      if (error) throw error;
    },
    onSuccess: () => {
      setValue("");
      toast.success("تمت إضافة الكود · Code added");
      qc.invalidateQueries({ queryKey: ["codes"] });
    },
    onError: (e: { code?: string }) => {
      toast.error(e?.code === "23505" ? "هذا الكود موجود بالفعل · Code already shared" : "تعذّر الإضافة · Couldn't add code");
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = normalizeCode(value);
    if (!c) return;
    if (c.length > 64) {
      toast.error("الكود طويل جدًا · Code is too long");
      return;
    }
    add.mutate(c);
  };

  const copy = async (item: Code) => {
    if (!canTapToCopy(copied, item.id)) return;

    const startedAt = Date.now();
    const remaining = getCopyCooldownMs(nextCopyAtRef.current, startedAt);
    if (remaining > 0) {
      toast.error(`انتظر ${Math.ceil(remaining / 1000)} ثوانٍ · Wait ${Math.ceil(remaining / 1000)}s`);
      return;
    }

    const until = startedAt + COPY_COOLDOWN_MS;
    nextCopyAtRef.current = until;
    setNextCopyAt(until);
    setNow(startedAt);

    try {
      await navigator.clipboard.writeText(item.code);
      setCopied((s) => markCopied(s, item.id));
      toast.success("تم النسخ · Copied");
    } catch {
      nextCopyAtRef.current = 0;
      setNextCopyAt(0);
      toast.error("تعذّر النسخ · Couldn't copy");
    }
  };

  const cooldownMs = getCopyCooldownMs(nextCopyAt, now);
  const cooldownSeconds = Math.ceil(cooldownMs / 1000);

  return (
    <main className="min-h-screen bg-background pattern-bg">
      <SignInMark />
      <div className="mx-auto max-w-xl px-4 py-10">
        <header className="text-center">
          <p className="font-display text-sm tracking-[0.3em] text-primary uppercase">Nusuk</p>
          <h1 className="mt-2 font-display text-4xl text-foreground">أكواد إحالة نُسُك</h1>
          <p className="mt-2 text-muted-foreground">Share your referral code. Tap any code to copy it. Wait 3 seconds between copies.</p>
        </header>

        <form onSubmit={submit} className="mt-8 flex gap-2 rounded-2xl bg-card p-2 shadow-soft">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={64}
            placeholder="أضف كودك · Add your code"
            className="min-w-0 flex-1 bg-transparent px-3 text-lg text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={add.isPending || !value.trim()}
            className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Share
          </button>
        </form>

        <section className="mt-8 space-y-3">
          {isLoading && <p className="text-center text-muted-foreground">Loading…</p>}
          {!isLoading && codes.length === 0 && (
            <p className="text-center text-muted-foreground">لا توجد أكواد بعد · No codes yet — be the first!</p>
          )}
          {codes.map((c) => {
            const done = copied.has(c.id);
            return done ? (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-success bg-success-soft p-4">
                <span className="select-text break-all font-mono text-xl text-success-foreground">{c.code}</span>
                <span className="ml-3 inline-flex shrink-0 items-center gap-1 text-sm text-success-foreground select-none">
                  <Check className="h-4 w-4" /> Copied
                </span>
              </div>
            ) : (
              <button
                key={c.id}
                onClick={() => copy(c)}
                disabled={cooldownMs > 0}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-soft transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
              >
                <span className="break-all font-mono text-xl text-foreground">{c.code}</span>
                <span className="ml-3 inline-flex shrink-0 items-center gap-1 text-sm text-primary">
                  {cooldownMs > 0 ? (
                    `Wait ${cooldownSeconds}s`
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copy
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
