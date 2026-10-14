// Shared backend helpers for Umbral: resolve the caller's stored record with
// service role (never trust the cached session), and check billing status.
// NOTE: entity records are flat — custom fields live at the top level, never
// under a `data` wrapper. The tenant pointer is `stored.condominium_id`; RLS
// sees it as {{user.data.condominium_id}}.

// The first schema declared a custom field literally named `data`, so its
// values landed one level deeper than every RLS rule looks. Depending on how
// the record is flattened, the old values sit at `data` or `data.data`.
function legacyFields(stored) {
  const d = stored?.data;
  if (!d || typeof d !== "object") return null;
  return d.data && typeof d.data === "object" ? d.data : d;
}

// Copy the legacy fields to the top-level ones exactly once, then mark the
// record. The mark matters: removing a member clears condominium_id, and
// without it the next request would copy the stale legacy pointer back in.
async function migrateLegacy(base44, stored) {
  if (stored.legacy_migrated_at) return stored;
  const legacy = legacyFields(stored);
  const patch = { legacy_migrated_at: new Date().toISOString() };
  if (legacy) {
    if (!stored.condominium_id && legacy.condominium_id) patch.condominium_id = legacy.condominium_id;
    if (!stored.unit_id && legacy.unit_id) patch.unit_id = legacy.unit_id;
    if (!stored.phone && legacy.phone) patch.phone = legacy.phone;
  }
  await base44.asServiceRole.entities.User.update(stored.id, patch);
  const migrated = { ...stored, ...patch };
  // full_name is a built-in field: copy it in its own write so a refusal
  // there can never block the tenant pointer migration above.
  if (legacy?.full_name && !stored.full_name) {
    try {
      await base44.asServiceRole.entities.User.update(stored.id, { full_name: legacy.full_name });
      migrated.full_name = legacy.full_name;
    } catch (e) {
      console.error("legacy full_name copy failed", stored.id, e?.message);
    }
  }
  return migrated;
}

// Read another account through the service role, migrated like the caller.
export async function readUser(base44, id) {
  if (!id) return null;
  let u;
  try {
    u = await base44.asServiceRole.entities.User.get(id);
  } catch (e) {
    return null;
  }
  return u ? await migrateLegacy(base44, u) : null;
}

export async function resolveCaller(base44) {
  const caller = await base44.auth.me();
  if (!caller) return { ok: false, status: 401, error: "No autenticado" };
  let stored;
  try {
    stored = await base44.asServiceRole.entities.User.get(caller.id);
  } catch (e) {
    return { ok: false, status: 404, error: "Cuenta no encontrada" };
  }
  if (!stored) return { ok: false, status: 404, error: "Cuenta no encontrada" };
  stored = await migrateLegacy(base44, stored);
  const condominiumId = stored.condominium_id || null;
  let condominium = null;
  if (condominiumId) {
    try {
      condominium = await base44.asServiceRole.entities.Condominium.get(condominiumId);
    } catch (e) {
      condominium = null;
    }
  }
  return { ok: true, caller, stored, condominium, condominiumId };
}

export function billingBlocksWrites(condominium) {
  const s = condominium?.billing_status;
  return s === "view_only" || s === "suspended";
}

// Reject writes when the condominium is in a degraded billing state.
// Returns an error object when blocked, null when allowed.
export function guardBilling(condominium) {
  if (billingBlocksWrites(condominium)) {
    return {
      status: 402,
      error: "El condominio está en modo de solo lectura. No se pueden hacer cambios.",
    };
  }
  return null;
}

export function asPage(res) {
  if (Array.isArray(res)) return res;
  return res?.items || [];
}