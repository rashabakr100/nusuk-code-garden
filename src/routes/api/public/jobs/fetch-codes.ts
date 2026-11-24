import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Called every 30 minutes by the backend schedule; runs the same import as the admin "Fetch more codes" button. */
export const Route = createFileRoute("/api/public/jobs/fetch-codes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { runNusukKeyFetch } = await import("@/lib/nusukkey-fetch.server");
        const result = await runNusukKeyFetch("auto");
        return Response.json({ status: result.status });
      },
    },
  },
});
