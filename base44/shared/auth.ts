// Shared backend helpers for Umbral: resolve the caller's stored record with
// service role (never trust the cached session), and check billing status.

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
  const condominiumId = stored.data?.condominium_id || null;
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
  const s = condominium?.data?.billing_status;
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