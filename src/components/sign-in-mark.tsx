import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { BarChart3, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Account } from "@/hooks/use-account";

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

const inputClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary";

export function SignInMark({ account }: { account: Account | null }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  const google = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
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
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          toast.error(
            error.message.toLowerCase().includes("confirm")
              ? "أكّد بريدك أولاً · Please confirm your email first"
              : "البريد أو كلمة السر غير صحيحة · Wrong email or password",
          );
          return;
        }
        setPassword("");
        setOpen(false);
        toast.success("تم تسجيل الدخول · Signed in");
      } else {
        if (password.length < 6) {
          toast.error("كلمة السر 6 أحرف على الأقل · Password must be at least 6 characters");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          toast.error(error.message || "تعذّر إنشاء الحساب · Couldn't create account");
          return;
        }
        setPassword("");
        if (data.session) {
          setOpen(false);
          toast.success("تم إنشاء الحساب · Account created");
        } else {
          setCheckEmail(true);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOpen(false);
    toast.success("تم تسجيل الخروج · Signed out");
  };

  const initial = (account?.name || account?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCheckEmail(false);
      }}
    >
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
            {account.isAdmin && (
              <p className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-foreground">
                <ShieldCheck className="h-3 w-3" /> Admin · مشرف
              </p>
            )}
            {account.isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
              >
                <BarChart3 className="h-3.5 w-3.5" /> استخدام الأكواد · Code usage
              </Link>
            )}
            <button
              type="button"
              onClick={signOut}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        ) : checkEmail ? (
          <div className="space-y-2 text-center">
            <p className="text-sm font-medium text-foreground">تحقّق من بريدك · Check your email</p>
            <p className="text-xs text-muted-foreground">
              We sent a confirmation link. Open it, then sign in.
            </p>
            <button
              type="button"
              onClick={() => {
                setCheckEmail(false);
                setMode("signin");
              }}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {mode === "signin" ? "Sign in · تسجيل الدخول" : "Create account · حساب جديد"}
            </p>

            <button
              type="button"
              onClick={google}
              disabled={busy}
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

            <div className="flex items-center gap-2 py-0.5 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or · أو <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={submit} className="space-y-2">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email · البريد"
                aria-label="Email"
                className={inputClass}
              />
              <input
                type="password"
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password · كلمة السر"
                aria-label="Password"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={busy}
                className="h-9 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="w-full text-center text-[11px] text-primary underline-offset-2 hover:underline"
            >
              {mode === "signin" ? "No account? Create one · حساب جديد" : "Have an account? Sign in"}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
