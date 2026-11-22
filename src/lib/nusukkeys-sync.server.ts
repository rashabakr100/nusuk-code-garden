import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  NUSUKKEYS_SOURCE,
  NUSUKKEYS_URL,
  parseNusukKeysResponse,
  shouldWaitForBackoff,
} from "@/lib/nusukkeys-import";

const STATE_ID = "nusukkeys";

export type SyncResult =
  | { status: "ok"; added: number; skipped: number }
  | { status: "failed"; reason: string }
  | { status: "waiting"; reason: string };

async function readState() {
  const { data } = await supabaseAdmin.from("code_sync_state").select("*").eq("id", STATE_ID).maybeSingle();
  return data;
}

async function fetchCodes() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(NUSUKKEYS_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`Source answered ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Adds new codes from nusukkeys.xyz. Only ever INSERTS (ON CONFLICT DO NOTHING):
 * it never edits, hides or deletes an existing code, whatever the source returns.
 * Never throws.
 */
export async function runNusukKeysSync({ force }: { force: boolean }): Promise<SyncResult> {
  let state: Awaited<ReturnType<typeof readState>> = null;
  try {
    state = await readState();
    if (!force && shouldWaitForBackoff(state)) {
      return { status: "waiting", reason: "Too many failures in a row; retrying every 6 hours" };
    }
  } catch (e) {
    console.error("[sync] could not read state", e);
  }

  const attemptAt = new Date().toISOString();
  try {
    const body = await fetchCodes();
    const candidates = parseNusukKeysResponse(body);
    if (candidates.length === 0) throw new Error("No valid codes found in the source");

    const rows = candidates.map((c) => ({
      code: c.code,
      source: NUSUKKEYS_SOURCE,
      ...(c.createdAt ? { created_at: c.createdAt } : {}),
    }));
    const { data, error } = await supabaseAdmin
      .from("referral_codes")
      .upsert(rows, { onConflict: "code", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Saving failed: ${error.message}`);

    const added = data?.length ?? 0;
    const skipped = candidates.length - added;
    await supabaseAdmin.from("code_sync_state").upsert({
      id: STATE_ID,
      last_attempt_at: attemptAt,
      last_success_at: attemptAt,
      last_success_added: added,
      last_success_skipped: skipped,
      consecutive_failures: 0,
    });
    return { status: "ok", added, skipped };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[sync] failed:", reason);
    try {
      await supabaseAdmin.from("code_sync_state").upsert({
        id: STATE_ID,
        last_attempt_at: attemptAt,
        last_failure_at: attemptAt,
        last_failure_reason: reason.slice(0, 300),
        consecutive_failures: (state?.consecutive_failures ?? 0) + 1,
      });
    } catch (e2) {
      console.error("[sync] could not save failure", e2);
    }
    return { status: "failed", reason };
  }
}
