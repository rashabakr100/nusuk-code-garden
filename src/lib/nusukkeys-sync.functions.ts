import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only "Sync now": runs the import immediately, even during the 6-hour back-off. */
export const syncNusukKeysNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { runNusukKeysSync } = await import("@/lib/nusukkeys-sync.server");
    return runNusukKeysSync({ force: true });
  });
