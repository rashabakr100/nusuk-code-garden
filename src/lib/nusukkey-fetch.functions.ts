import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only "Fetch more codes": one import run per tap, at most one every 15 seconds. */
export const fetchMoreCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { runNusukKeyFetch } = await import("@/lib/nusukkey-fetch.server");
    return runNusukKeyFetch("manual");
  });
