import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/sync-nusukkeys")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          const { runNusukKeysSync } = await import("@/lib/nusukkeys-sync.server");
          const result = await runNusukKeysSync({ force: false });
          return Response.json(result);
        } catch (e) {
          console.error("[sync] unexpected", e);
          return Response.json({ status: "failed" });
        }
      },
    },
  },
});
