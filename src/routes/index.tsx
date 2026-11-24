import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, CircleCheck, Circle, Copy, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignInMark } from "@/components/sign-in-mark";
import { useAccount } from "@/hooks/use-account";
import { canManageCode, manageVia } from "@/lib/code-permissions";
import { addOwned, getDeviceToken, loadOwned, removeOwned } from "@/lib/device-ownership";
import { MAX_CODE_LENGTH, cleanTypedCode, isValidNgCode } from "@/lib/ng-code";
import { copyNow } from "@/lib/clipboard";
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
import { canTapToCopy, loadCopied, loadCopiedAt, markCopied, mergeCopied, stampCopied } from "@/lib/copied-codes";
import { getVisitorId } from "@/lib/visitor-id";
import { PINNED_CODES, nextCodeToUse, nusukOpenUrl, orderCodes } from "@/lib/code-order";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nusuk Referral Codes — Share & Copy" },
      { name: "description", content: "Share your Nusuk referral code, then copy or open codes shared by others straight in the Nusuk app. Free and open to everyone." },
      { property: "og:title", content: "Nusuk Referral Codes" },
      { property: "og:description", content: "Share and copy Nusuk referral codes for free." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Code = { id: string; code: string; created_at: string; user_id: string | null; source: string | null };

function OpenLink({ item, onOpen, className }: { item: Code; onOpen: (item: Code) => void; className?: string }) {
  return (
    <a
      href={nusukOpenUrl(item.code)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onOpen(item)}
      aria-label={`Copy ${item.code} and open the Nusuk app`}
      className={cn("inline-flex shrink-0 items-center justify-center gap-1 font-medium", className)}
    >
      <ExternalLink className="h-4 w-4 shrink-0" /> Copy and open
    </a>
  );
}

function Index() {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [copied, setCopied] = useState<Set<string>>(new Set());
  const account = useAccount();
  const [managing, setManaging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Code | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [copiedAt, setCopiedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    setCopied(loadCopied());
    setCopiedAt(loadCopiedAt());
    setOwned(loadOwned());
  }, []);

  const { data: rawCodes = [], isLoading } = useQuery({
    queryKey: ["codes"],
    queryFn: async () => {
      // Pinned codes are fetched on their own so newer (e.g. imported) codes can never push them out of the list.
      const [latest, pinned] = await Promise.all([
        supabase.from("referral_codes").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("referral_codes").select("*").in("code", [...PINNED_CODES]),
      ]);
      if (latest.error) throw latest.error;
      const rows = latest.data as Code[];
      const have = new Set(rows.map((r) => r.id));
      for (const r of (pinned.data ?? []) as Code[]) if (!have.has(r.id)) rows.push(r);
      return rows;
    },
  });

  // This visitor's own codes: added from this device, or with their signed-in account (admins included, only their own).
  const ownIds = useMemo(() => {
    const s = new Set(owned);
    if (account) for (const c of rawCodes) if (c.user_id === account.id) s.add(c.id);
    return s;
  }, [owned, account, rawCodes]);
  const codes = useMemo(
    () => orderCodes(rawCodes, copied, { copiedAt, own: ownIds }),
    [rawCodes, copied, copiedAt, ownIds],
  );
  // The next-code card uses the normal order (a person's own code is no use to them).
  const normalOrder = useMemo(() => orderCodes(rawCodes, copied, { copiedAt }), [rawCodes, copied, copiedAt]);
  const availableCount = codes.reduce((count, item) => count + (copied.has(item.id) ? 0 : 1), 0);
  const usedCount = codes.length - availableCount;
  const next = nextCodeToUse(normalOrder, copied);
  const manageable = codes.filter((c) => canManageCode(c, account, owned));
  const selected = codes.find((c) => c.id === selectedId) ?? null;

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
      setSelectedId(null);
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

  const stopManaging = () => {
    setManaging(false);
    setSelectedId(null);
    setEditingId(null);
  };

  const startEdit = (item: Code) => {
    setEditingId(item.id);
    setEditValue(item.code);
  };

  const checkCode = (raw: string) => {
    const c = cleanTypedCode(raw);
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

  const markUsed = (item: Code, action: "copy" | "open") => {
    setCopied((s) => markCopied(s, item.id));
    setCopiedAt((m) => stampCopied(m, item.id));
    // The request only runs once .then() is called.
    supabase.rpc("record_code_use", { _code_id: item.id, _action: action, _visitor: getVisitorId() }).then(() => {});
  };

  // When someone signs in, keep everything they used on this device and add what their account used elsewhere.
  const accountId = account?.id ?? null;
  useEffect(() => {
    if (!accountId) return;
    let alive = true;
    supabase.rpc("sync_used_codes", { _code_ids: [...loadCopied()] }).then(({ data }) => {
      if (alive && data) setCopied((s) => mergeCopied(s, data as string[]));
    });
    return () => {
      alive = false;
    };
  }, [accountId]);

  const copyAndOpen = (item: Code) => {
    if (copyNow(item.code)) toast.success("تم النسخ · Copied");
    markUsed(item, "open");
  };

  const copy = async (item: Code) => {
    if (!canTapToCopy(copied, item.id)) return;
    try {
      await navigator.clipboard.writeText(item.code);
      markUsed(item, "copy");
      toast.success("تم النسخ · Copied");
    } catch {
      toast.error("تعذّر النسخ · Couldn't copy");
    }
  };

  return (
    <main className="min-h-screen bg-background pattern-bg">
      <div
        aria-live="polite"
        aria-label={`${availableCount} codes available to use, ${usedCount} used`}
        className="absolute left-3 top-2 z-40 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur"
      >
        <span className="font-mono text-sm text-primary">{isLoading ? "…" : availableCount}</span> Available
        <span className="mx-1 text-border">·</span>
        <span className="font-mono text-sm text-primary">{isLoading ? "…" : usedCount}</span> Used
      </div>
      <SignInMark account={account} />
      <div className={cn("mx-auto max-w-xl px-4 py-10", managing && "pb-28")}>
        <header className="text-center">
          <p className="font-display text-sm tracking-[0.3em] text-primary uppercase">Nusuk</p>
          <h1 className="mt-2 font-display text-4xl text-foreground">أكواد إحالة نُسُك</h1>
          <p className="mt-2 text-muted-foreground">
            Share your referral code. Tap a code to copy it, or tap "Copy and open" to copy it and go straight to the Nusuk app.
          </p>
        </header>

        <form onSubmit={submit} className="mt-8 flex gap-2 rounded-2xl bg-card p-2 shadow-soft">
          <label className="flex min-w-0 flex-1 items-center pl-3">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\s+/g, ""))}
              maxLength={MAX_CODE_LENGTH}
              placeholder="كودك · your code"
              aria-label="Your code (starts with NG-)"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              dir="ltr"
              className="min-w-0 flex-1 bg-transparent pr-2 font-mono text-lg text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground"
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

        {!isLoading && codes.length > 0 && (
          <section
            aria-label="Next code"
            className="mt-6 overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-soft"
          >
            {next ? (
              <div key={next.id} className="animate-in fade-in slide-in-from-right-4 duration-300">
                <p className="text-sm opacity-80">الكود التالي · Next code</p>
                <p className="mt-1 break-all font-mono text-3xl tracking-wide" dir="ltr">
                  {next.code}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => copy(next)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-foreground py-3 font-medium text-primary transition active:scale-[0.98]"
                  >
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                  <OpenLink
                    item={next}
                    onOpen={copyAndOpen}
                    className="rounded-xl border border-primary-foreground/40 py-3 transition active:scale-[0.98]"
                  />
                </div>
              </div>
            ) : (
              <div className="py-2 text-center">
                <CircleCheck className="mx-auto h-8 w-8" />
                <p className="mt-2 font-medium">استخدمت كل الأكواد · You've used every code</p>
                <p className="text-sm opacity-80">New codes will show up here.</p>
              </div>
            )}
          </section>
        )}

        <section className="mt-8 space-y-3">
          {isLoading && <p className="text-center text-muted-foreground">Loading…</p>}
          {!isLoading && codes.length === 0 && (
            <p className="text-center text-muted-foreground">لا توجد أكواد بعد · No codes yet — be the first!</p>
          )}
          {codes.map((c) => {
            const done = copied.has(c.id);

            if (editingId === c.id) {
              return (
                <form
                  key={c.id}
                  onSubmit={saveEdit}
                  className="flex items-center gap-2 rounded-2xl border border-primary bg-card p-2 shadow-soft"
                >
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value.replace(/\s+/g, ""))}
                    maxLength={MAX_CODE_LENGTH}
                    aria-label="Edit code (starts with NG-)"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="ltr"
                    className="min-w-0 flex-1 pl-2 bg-transparent pr-2 font-mono text-xl text-foreground outline-none"
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

            if (managing) {
              const canManage = canManageCode(c, account, owned);
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setSelectedId(isSelected ? null : c.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition",
                    isSelected ? "border-primary ring-2 ring-primary" : "border-border",
                    !canManage && "opacity-40",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="break-all font-mono text-xl text-foreground">{c.code}</span>
                  </span>
                  {canManage &&
                    (isSelected ? (
                      <CircleCheck className="h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                    ))}
                </button>
              );
            }

            return done ? (
              <div key={c.id} className="flex items-stretch overflow-hidden rounded-2xl border border-success bg-success-soft">
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 p-4">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="select-text break-all font-mono text-xl text-success-foreground">{c.code}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-success-foreground select-none">
                    <Check className="h-4 w-4" /> <span className="hidden sm:inline">Used</span>
                  </span>
                </div>
                <OpenLink item={c} onOpen={copyAndOpen} className="flex-col gap-0.5 whitespace-nowrap border-l border-success px-3 text-xs leading-tight text-success-foreground" />
              </div>
            ) : (
              <div key={c.id} className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <button
                  type="button"
                  onClick={() => copy(c)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 p-4 text-left transition active:scale-[0.98]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="break-all font-mono text-xl text-foreground">{c.code}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-primary">
                    <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Copy</span>
                  </span>
                </button>
                <OpenLink item={c} onOpen={copyAndOpen} className="flex-col gap-0.5 whitespace-nowrap border-l border-border px-3 text-xs leading-tight text-primary" />
              </div>
            );
          })}
        </section>

        {!managing && manageable.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setManaging(true)}
              aria-label="Edit your codes"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:text-primary"
            >
              <Pencil className="h-3 w-3" /> تعديل · Edit
            </button>
          </div>
        )}
      </div>

      {managing && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {selected ? (
                <span className="font-mono text-foreground">{selected.code}</span>
              ) : (
                "اختر كودًا · Select a code"
              )}
            </p>
            <button
              type="button"
              disabled={!selected}
              onClick={() => selected && startEdit(selected)}
              className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-2 text-sm text-foreground disabled:opacity-40"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={() => selected && setPendingDelete(selected)}
              className="inline-flex items-center gap-1 rounded-lg border border-destructive px-3 py-2 text-sm text-destructive disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button
              type="button"
              onClick={stopManaging}
              className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              Done
            </button>
          </div>
        </div>
      )}

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
