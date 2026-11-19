import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Account = {
  id: string;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
};

/** Current signed-in account (or null), including whether it has the admin role. */
export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    let alive = true;
    let lastUserId: string | null = null;

    const load = async (user: User | null) => {
      lastUserId = user?.id ?? null;
      if (!user) {
        if (alive) setAccount(null);
        return;
      }
      const base = {
        id: user.id,
        email: user.email ?? null,
        name: (user.user_metadata?.["name"] as string | undefined) ?? null,
      };
      if (alive) setAccount((prev) => ({ ...base, isAdmin: prev?.id === user.id ? prev.isAdmin : false }));

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (alive && lastUserId === user.id) setAccount({ ...base, isAdmin: !!data });
    };

    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      // Defer so we never call the client from inside its own auth callback.
      setTimeout(() => load(session?.user ?? null), 0);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return account;
}
