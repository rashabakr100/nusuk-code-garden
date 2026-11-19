import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogIn, LogOut } from "lucide-react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Account = { email: string | null; name: string | null };

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export function SignInMark() {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [busy, setBusy] = useState<"google" | "lovable" | null>(null);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session;
      if (alive && session) {
        setAccount({ email: session.user.email ?? null, name: session.user.user_metadata?.["name"] ?? null });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(
        session
          ? { email: session.user.email ?? null, name: session.user.user_metadata?.["name"] ?? null }
          : null,
      );
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const start = async (provider: "google" | "lovable") => {
    if (busy) return;
    setBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        toast.error("تعذّر تسجيل الدخول · Couldn't sign in");
        return;
      }
      if (result.redirected) return;

      setOpen(false);
      toast.success("تم تسجيل الدخول · Signed in");
    } catch {
      toast.error("تعذّر تسجيل الدخول · Couldn't sign in");
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    toast.success("تم تسجيل الخروج · Signed out");
  };

  const initial = (account?.name || account?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={account ? "Account" : "Sign in"}
          title={account ? account.email || "Account" : "Sign in"}
          className="fixed right-2 top-2 z-50 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-soft transition hover:text-primary"
        >
          {account ? (
            <span className="text-[10px] font-semibold leading-none text-primary">{initial}</span>
          ) : (
            <LogIn className="h-3 w-3" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" sideOffset={6} className="w-64 rounded-2xl p-3">
        {account ? (
          <div className="space-y-2">
            <p className="truncate text-xs text-muted-foreground">{account.email || account.name || "Signed in"}</p>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Sign in · تسجيل الدخول</p>

            <button
              type="button"
              onClick={() => start("google")}
              disabled={busy !== null}
              className="inline-flex w-full items-center rounded-xl text-[14px] font-medium disabled:opacity-60"
              style={{
                height: 40,
                padding: "0 12px",
                gap: 10,
                background: "#FFFFFF",
                border: "1px solid #747775",
                color: "#1F1F1F",
              }}
            >
              <GoogleMark />
              Continue with Google
            </button>

            <button
              type="button"
              onClick={() => start("lovable")}
              disabled={busy !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 text-[14px] font-medium text-foreground transition hover:bg-accent disabled:opacity-60"
              style={{ height: 40 }}
            >
              <LovableMark className="h-[18px] w-[18px]" />
              Continue with Lovable
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
