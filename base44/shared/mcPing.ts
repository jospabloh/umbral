// Fire-and-forget nudge to Mission Control after a ticket or a condominium is
// created, so it shows up there in seconds instead of at the next sync. MC
// re-reads the authentic record through the bridge (it trusts nothing in this
// body), so the ping carries only ids. Never throws and never fails a request:
// the sync is the safety net.
const MC_URL = "https://control.acaciaco.com.mx";

export async function pingMissionControl(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(`${MC_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("pingMissionControl", path, "status", res.status);
  } catch (e) {
    console.error("pingMissionControl", path, "failed", (e as Error)?.message);
  }
}
