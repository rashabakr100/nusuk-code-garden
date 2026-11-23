import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BULK_IMPORT_SOURCE, MAX_BULK_TEXT, parsePastedCodes, planBulkImport } from "@/lib/bulk-import";

export type BulkResult =
  | { status: "none" }
  | { status: "failed"; reason: string }
  | {
      status: "preview";
      newCount: number;
      duplicates: number;
      ignored: number;
      overCap: number;
      sample: string[];
    }
  | { status: "imported"; added: number; alreadyHad: number; ignored: number; overCap: number };

/**
 * Admin-only bulk import from pasted text. "preview" changes nothing; "import" only INSERTS new codes
 * (ON CONFLICT DO NOTHING), so it never edits, hides or deletes existing codes and is safe to repeat.
 */
export const bulkImportCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().max(MAX_BULK_TEXT), mode: z.enum(["preview", "import"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<BulkResult> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");

    try {
      const parsed = parsePastedCodes(data.text);
      if (parsed.codes.length === 0) return { status: "none" };

      const existing = new Set<string>();
      for (let i = 0; i < parsed.codes.length; i += 100) {
        const chunk = parsed.codes.slice(i, i + 100);
        const { data: rows, error } = await context.supabase.from("referral_codes").select("code").in("code", chunk);
        if (error) throw new Error(`Reading codes failed: ${error.message}`);
        for (const r of rows ?? []) existing.add(r.code);
      }
      const plan = planBulkImport(parsed.codes, existing);

      if (data.mode === "preview") {
        return {
          status: "preview",
          newCount: plan.toAdd.length + plan.overCap,
          duplicates: parsed.repeats + plan.alreadyHad,
          ignored: parsed.ignored,
          overCap: plan.overCap,
          sample: plan.toAdd.slice(0, 10),
        };
      }

      let added = 0;
      if (plan.toAdd.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: inserted, error } = await supabaseAdmin
          .from("referral_codes")
          .upsert(
            plan.toAdd.map((code) => ({ code, source: BULK_IMPORT_SOURCE })),
            { onConflict: "code", ignoreDuplicates: true },
          )
          .select("id");
        if (error) throw new Error(`Saving failed: ${error.message}`);
        added = inserted?.length ?? 0;
      }
      return {
        status: "imported",
        added,
        alreadyHad: plan.alreadyHad + (plan.toAdd.length - added),
        ignored: parsed.ignored,
        overCap: plan.overCap,
      };
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error("[bulk-import] failed:", reason);
      return { status: "failed", reason };
    }
  });
