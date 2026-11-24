import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  NUSUKKEY_PAGES,
  NUSUKKEY_SOURCE,
  PAUSE_BETWEEN_PAGES_MS,
  parseCodesFromHtml,
  parseOpenLinkIds,
  planImport,
} from "@/lib/nusukkey-import";

export type FetchTrigger = "manual" | "auto";

export type FetchResult =
  | { status: "ok"; added: number; alreadyHad: number; confirmed: number; sample: string[] }
  | { status: "failed"; reason: string; sample: string[] }
  | { status: "too_soon" }
  | { status: "busy" }
  | { status: "skipped"; reason: "disabled" | "backoff" };

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

async function record(
  trigger: FetchTrigger,
  run: { status: "ok" | "failed"; added?: number; alreadyHad?: number; confirmed?: number; sample: string[]; reason?: string },
) {
  try {
    await supabaseAdmin.from("code_import_runs").insert({
      source: NUSUKKEY_SOURCE,
      trigger,
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

async function finish(ok: boolean, added: number, skipped: number, reason: string) {
  try {
    await supabaseAdmin.rpc("finish_code_fetch", { _ok: ok, _added: added, _skipped: skipped, _reason: reason });
  } catch (e) {
    console.error("[fetch-codes] could not release lock", e);
  }
}

/**
 * One "Fetch more codes" run, from a tap or the 30-minute schedule. One lock (claim_code_fetch) means a tap
 * and a scheduled run never overlap. Only ever INSERTS new codes (ON CONFLICT DO NOTHING): it never edits,
 * hides or deletes any existing code, whatever the source returns. Never throws.
 */
export async function runNusukKeyFetch(trigger: FetchTrigger = "manual"): Promise<FetchResult> {
  try {
    const { data: claim, error } = await supabaseAdmin.rpc("claim_code_fetch", { _trigger: trigger });
    if (error) throw new Error(`Could not start: ${error.message}`);
    if (claim === "too_soon") return { status: "too_soon" };
    if (claim === "busy") return { status: "busy" };
    if (claim === "disabled" || claim === "backoff") return { status: "skipped", reason: claim };
    if (claim !== "ok") throw new Error(`Could not start: ${claim}`);
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

    await finish(true, added, already, "");
    await record(trigger, { status: "ok", added, alreadyHad: already, confirmed, sample });
    return { status: "ok", added, alreadyHad: already, confirmed, sample };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[fetch-codes] failed:", reason);
    await finish(false, 0, 0, reason);
    await record(trigger, { status: "failed", sample, reason });
    return { status: "failed", reason, sample };
  }
}
