import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MIN_MS_BETWEEN_RUNS,
  NUSUKKEY_PAGES,
  NUSUKKEY_SOURCE,
  PAUSE_BETWEEN_PAGES_MS,
  parseCodesFromHtml,
  parseOpenLinkIds,
  planImport,
} from "@/lib/nusukkey-import";

const STATE_ID = "nusukkey";

export type FetchResult =
  | { status: "ok"; added: number; alreadyHad: number; confirmed: number; sample: string[] }
  | { status: "failed"; reason: string; sample: string[] }
  | { status: "too_soon" };

async function fetchPage(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Claims the run slot in one UPDATE, so two taps within 15 seconds can't both run. */
async function claimRunSlot(): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - MIN_MS_BETWEEN_RUNS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("code_sync_state")
    .update({ last_attempt_at: now.toISOString() })
    .eq("id", STATE_ID)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`)
    .select("id");
  if (error) throw new Error(`Could not start: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

async function record(run: {
  status: "ok" | "failed";
  added?: number;
  alreadyHad?: number;
  confirmed?: number;
  sample: string[];
  reason?: string;
}) {
  try {
    await supabaseAdmin.from("code_import_runs").insert({
      source: NUSUKKEY_SOURCE,
      status: run.status,
      added: run.added ?? 0,
      already_had: run.alreadyHad ?? 0,
      confirmed: run.confirmed ?? 0,
      sample: run.sample,
      ...(run.reason ? { reason: run.reason.slice(0, 300) } : {}),
    });
  } catch (e) {
    console.error("[fetch-codes] could not record run", e);
  }
}

/**
 * One "Fetch more codes" run. Only ever INSERTS new codes (ON CONFLICT DO NOTHING):
 * it never edits, hides or deletes any existing code, whatever the source returns. Never throws.
 */
export async function runNusukKeyFetch(): Promise<FetchResult> {
  try {
    if (!(await claimRunSlot())) return { status: "too_soon" };
  } catch (e) {
    return { status: "failed", reason: e instanceof Error ? e.message : String(e), sample: [] };
  }

  let sample: string[] = [];
  try {
    const found: string[] = [];
    const linkIds = new Set<string>();
    const errors: string[] = [];
    for (const [i, url] of NUSUKKEY_PAGES.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_BETWEEN_PAGES_MS));
      try {
        const html = await fetchPage(url);
        for (const c of parseCodesFromHtml(html)) if (!found.includes(c)) found.push(c);
        for (const c of parseOpenLinkIds(html)) linkIds.add(c);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    sample = found.slice(0, 5);
    if (found.length === 0) {
      throw new Error(errors.length ? errors.join("; ") : "No valid codes found on the pages");
    }
    const confirmed = found.filter((c) => linkIds.has(c)).length;

    const { data: existingRows, error: readErr } = await supabaseAdmin
      .from("referral_codes")
      .select("code")
      .in("code", found);
    if (readErr) throw new Error(`Reading codes failed: ${readErr.message}`);
    const { toAdd, alreadyHad } = planImport(found, new Set((existingRows ?? []).map((r) => r.code)));

    let added = 0;
    if (toAdd.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("referral_codes")
        .upsert(
          toAdd.map((code) => ({ code, source: NUSUKKEY_SOURCE })),
          { onConflict: "code", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw new Error(`Saving failed: ${error.message}`);
      added = data?.length ?? 0;
    }
    const already = alreadyHad + (toAdd.length - added);

    const at = new Date().toISOString();
    await supabaseAdmin
      .from("code_sync_state")
      .update({ last_success_at: at, last_success_added: added, last_success_skipped: already, consecutive_failures: 0 })
      .eq("id", STATE_ID);
    await record({ status: "ok", added, alreadyHad: already, confirmed, sample });
    return { status: "ok", added, alreadyHad: already, confirmed, sample };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[fetch-codes] failed:", reason);
    await record({ status: "failed", sample, reason });
    return { status: "failed", reason, sample };
  }
}
