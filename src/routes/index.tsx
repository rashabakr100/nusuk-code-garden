import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignInMark } from "@/components/sign-in-mark";
import { useAccount } from "@/hooks/use-account";
import { canManageCode, manageVia } from "@/lib/code-permissions";
import { addOwned, getDeviceToken, loadOwned, removeOwned } from "@/lib/device-ownership";
import { CODE_PREFIX, MAX_CODE_LENGTH, isValidNgCode, stripNgPrefix, toNgCode } from "@/lib/ng-code";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  COPY_COOLDOWN_MS,
  canTapToCopy,
  getCopyCooldownMs,
  loadCopied,
  markCopied,
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

type Code = { id: string; code: string; created_at: string; user_id: string | null };

function Index() {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState<Set<string>>(new Set());
  const [nextCopyAt, setNextCopyAt] = useState(0);
  const [now, setNow] = useState(0);
  const nextCopyAtRef = useRef(0);
  const account = useAccount();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Code | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCopied(loadCopied());
    setOwned(loadOwned());
  }, []);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "referral_codes" }, () =>
        qc.invalidateQueries({ queryKey: ["codes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const add = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("add_code", { _code: code, _token: getDeviceToken() });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      if (id) setOwned((s) => addOwned(s, id));
      setValue("");
      toast.success("تمت إضافة الكود · Code added");
      qc.invalidateQueries({ queryKey: ["codes"] });
    },
    onError: (e: { code?: string }) => {
      toast.error(e?.code === "23505" ? "هذا الكود موجود بالفعل · Code already shared" : "تعذّر الإضافة · Couldn't add code");
    },
  });

  const edit = useMutation({
    mutationFn: async ({ item, code }: { item: Code; code: string }) => {
      if (manageVia(item, account) === "account") {
        const { data, error } = await supabase.from("referral_codes").update({ code }).eq("id", item.id).select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw { code: "forbidden" };
      } else {
        const { data, error } = await supabase.rpc("update_code_with_token", {
          _id: item.id,
          _token: getDeviceToken(),
          _code: code,
        });
        if (error) throw error;
        if (!data) throw { code: "forbidden" };
      }
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success("تم تعديل الكود · Code updated");
      qc.invalidateQueries({ queryKey: ["codes"] });
    },
    onError: (e: { code?: string }) => {
      toast.error(
        e?.code === "23505"
          ? "هذا الكود موجود بالفعل · Code already shared"
          : e?.code === "forbidden"
            ? "لا يمكنك تعديل هذا الكود · You can't edit this code"
            : "تعذّر التعديل · Couldn't update code",
      );
    },
  });

  const remove = useMutation({
    mutationFn: async (item: Code) => {
      if (manageVia(item, account) === "account") {
        const { data, error } = await supabase.from("referral_codes").delete().eq("id", item.id).select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw { code: "forbidden" };
      } else {
        const { data, error } = await supabase.rpc("delete_code_with_token", { _id: item.id, _token: getDeviceToken() });
        if (error) throw error;
        if (!data) throw { code: "forbidden" };
      }
      return item.id;
    },
    onSuccess: (id) => {
      setOwned((s) => removeOwned(s, id));
      toast.success("تم حذف الكود · Code deleted");
      qc.invalidateQueries({ queryKey: ["codes"] });
    },
    onError: (e: { code?: string }) => {
      toast.error(
        e?.code === "forbidden" ? "لا يمكنك حذف هذا الكود · You can't delete this code" : "تعذّر الحذف · Couldn't delete code",
      );
    },
    onSettled: () => setPendingDelete(null),
  });

  const startEdit = (item: Code) => {
    setEditingId(item.id);
    setEditValue(stripNgPrefix(item.code));
  };

  const checkCode = (raw: string) => {
    const c = toNgCode(raw);
    if (!c) return null;
    if (c.length > MAX_CODE_LENGTH) {
      toast.error("الكود طويل جدًا · Code is too long");
      return null;
    }
    if (!isValidNgCode(c)) {
      toast.error('يجب أن يبدأ الكود بـ NG- · Code must start with "NG-"');
      return null;
    }
    return c;
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = codes.find((x) => x.id === editingId);
    if (!item) return;
    const c = checkCode(editValue);
    if (!c) return;
    edit.mutate({ item, code: c });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = checkCode(value);
    if (!c) return;
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
      <SignInMark account={account} />
      <div className="mx-auto max-w-xl px-4 py-10">
        <header className="text-center">
          <p className="font-display text-sm tracking-[0.3em] text-primary uppercase">Nusuk</p>
          <h1 className="mt-2 font-display text-4xl text-foreground">أكواد إحالة نُسُك</h1>
          <p className="mt-2 text-muted-foreground">Share your referral code (starts with NG-). Tap any code to copy it. Wait 3 seconds between copies.</p>
        </header>

        <form onSubmit={submit} className="mt-8 flex gap-2 rounded-2xl bg-card p-2 shadow-soft">
          <label className="flex min-w-0 flex-1 items-center pl-3">
            <span className="select-none font-mono text-lg text-primary" dir="ltr">
              {CODE_PREFIX}
            </span>
            <input
              value={value}
              onChange={(e) => setValue(stripNgPrefix(e.target.value.replace(/\s+/g, "")))}
              maxLength={MAX_CODE_LENGTH - CODE_PREFIX.length}
              placeholder="أضف كودك · your code"
              aria-label="Your code (after NG-)"
              dir="ltr"
              className="min-w-0 flex-1 bg-transparent pl-0.5 pr-2 font-mono text-lg text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
            />
          </label>
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
            const canManage = canManageCode(c, account, owned);

            if (editingId === c.id) {
              return (
                <form
                  key={c.id}
                  onSubmit={saveEdit}
                  className="flex items-center gap-2 rounded-2xl border border-primary bg-card p-2 shadow-soft"
                >
                  <span className="select-none pl-2 font-mono text-xl text-primary" dir="ltr">
                    {CODE_PREFIX}
                  </span>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(stripNgPrefix(e.target.value.replace(/\s+/g, "")))}
                    maxLength={MAX_CODE_LENGTH - CODE_PREFIX.length}
                    aria-label="Edit code (after NG-)"
                    dir="ltr"
                    className="-ml-2 min-w-0 flex-1 bg-transparent pr-2 font-mono text-xl text-foreground outline-none"
                  />
                  <button
                    type="submit"
                    disabled={edit.isPending || !editValue.trim()}
                    aria-label="Save"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              );
            }

            const actions = canManage ? (
              <div className="flex shrink-0 items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  aria-label="Edit code"
                  title="Edit · تعديل"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(c)}
                  aria-label="Delete code"
                  title="Delete · حذف"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null;

            return done ? (
              <div key={c.id} className="flex items-center rounded-2xl border border-success bg-success-soft">
                <div className="flex min-w-0 flex-1 items-center justify-between p-4">
                  <span className="select-text break-all font-mono text-xl text-success-foreground">{c.code}</span>
                  <span className="ml-3 inline-flex shrink-0 items-center gap-1 text-sm text-success-foreground select-none">
                    <Check className="h-4 w-4" /> Copied
                  </span>
                </div>
                {actions}
              </div>
            ) : (
              <div key={c.id} className="flex items-center rounded-2xl border border-border bg-card shadow-soft">
                <button
                  type="button"
                  onClick={() => copy(c)}
                  disabled={cooldownMs > 0}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-2xl p-4 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
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
                {actions}
              </div>
            );
          })}
        </section>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الكود؟ · Delete this code?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{pendingDelete?.code}</span> will be removed for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) remove.mutate(pendingDelete);
              }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
