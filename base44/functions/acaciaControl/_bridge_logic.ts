// Pure logic for the acaciaControl bridge. Zero external imports (only the
// shared signer) so `deno test` loads it in a sandbox where deno.land and
// jsr.io are blocked. entry.ts does the I/O; every decision that can be wrong
// lives here, where base44/tests/bridge_test.ts pins it.
import { verifyAs } from './_acaciaSign.ts';

/** Reads and writes are pinned to these entities. Mission Control names the
 *  entity in every call, but a signed body must never turn this function into
 *  a generic "read or patch any table" endpoint. */
export const LICENSE_ENTITY = 'Condominium';
export const TICKET_ENTITY = 'SupportTicket';
export const SESSION_ENTITY = 'Session';

/** Entities whose row counts Mission Control may read (counts only, never rows). */
export const USAGE_ENTITIES = [
  'Unit', 'AccessPass', 'AccessEvent', 'Payment', 'Fee', 'Notice', 'User', 'Condominium',
] as const;

export const BILLING_STATUSES = ['trial', 'active', 'view_only', 'suspended'] as const;

/** The only Condominium fields the platform may write through license.set. */
export const LICENSE_FIELDS = ['billing_status', 'trial_end_at', 'license_expires_at', 'license_plan'] as const;

export const TICKET_STATUSES = ['submitted', 'resolved'] as const;

export const COUNT_CAP = 5000; // Base44 caps list at 5,000; counts are capped here.
export const MAX_REVOKE_IDS = 200;

export type Env = { secret?: string | null; slug?: string | null };
export type Gate =
  | { ok: true; action: string; params: Record<string, unknown> }
  | { ok: false; status: number; error: string; code: string };

/** Order matters: not configured (503) -> malformed (400) -> signature (401).
 *  Secrets unset means FAIL CLOSED: nothing is verified, nothing is served. */
export async function authorizeBridge(env: Env, body: unknown, now = Date.now()): Promise<Gate> {
  if (!env.secret || !env.slug) {
    return { ok: false, status: 503, error: 'Puente no configurado', code: 'bridge_not_configured' };
  }
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const { action, ts, sig } = b;
  const params = b.params === undefined ? {} : b.params;
  if (typeof action !== 'string' || !action || !ts || typeof sig !== 'string' || !sig) {
    return { ok: false, status: 400, error: 'missing action/ts/sig', code: 'bad_request' };
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return { ok: false, status: 400, error: 'params must be an object', code: 'bad_request' };
  }
  const valid = await verifyAs(env.secret, env.slug, {
    ts: ts as string | number, action, params, sig, now,
  });
  if (!valid) return { ok: false, status: 401, error: 'bad signature', code: 'bad_signature' };
  return { ok: true, action, params: params as Record<string, unknown> };
}

/** null when `entity` is the one this action is allowed to touch. */
export function entityError(expected: string, entity: unknown): string | null {
  return entity === expected ? null : `params.entity must be ${expected}`;
}

type Row = Record<string, unknown>;

function normalizeDate(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'string' || !v) return undefined;
  const t = Date.parse(v);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}

/** The tenant pointer of a User. Top-level since the 2026-10-14 reshape; a
 *  member who has not made a request since still carries it in the legacy
 *  `data` object (possibly nested as data.data). See shared/auth.ts. */
export function condominiumIdOf(u: Row | null | undefined): string {
  if (!u) return '';
  if (typeof u.condominium_id === 'string' && u.condominium_id) return u.condominium_id;
  const d = u.data as Row | undefined;
  const legacy = (d && typeof d === 'object' ? (d.data && typeof d.data === 'object' ? d.data : d) : null) as Row | null;
  return typeof legacy?.condominium_id === 'string' ? legacy.condominium_id : '';
}

export function normEmail(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

/** The license-relevant slice of a Condominium. Never join_code, address or
 *  the legal fields: nothing else about the condominium leaves the backend. */
export function projectCondominium(c: Row | null | undefined, ownerEmail: string | null) {
  const r = c ?? {};
  return {
    id: r.id ?? null,
    name: r.name ?? null,
    billing_status: r.billing_status ?? null,
    trial_end_at: r.trial_end_at ?? null,
    license_expires_at: r.license_expires_at ?? null,
    license_plan: r.license_plan ?? null,
    created_date: r.created_date ?? null,
    owner_email: ownerEmail ?? null,
  };
}

/** Validates the patch Mission Control wants to apply. Unknown fields are an
 *  error, not silently dropped: a typo must not look like success. */
export function sanitizeLicensePatch(
  patch: unknown,
): { patch: Record<string, unknown> } | { error: string } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { error: 'params.patch required' };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch as Row)) {
    if (!(LICENSE_FIELDS as readonly string[]).includes(k)) return { error: `field not allowed: ${k}` };
    if (k === 'billing_status') {
      if (!(BILLING_STATUSES as readonly string[]).includes(v as string)) {
        return { error: `invalid billing_status: ${String(v)}` };
      }
      out[k] = v;
    } else if (k === 'license_plan') {
      if (v !== null && (typeof v !== 'string' || v.length > 60)) return { error: 'invalid license_plan' };
      out[k] = v;
    } else {
      const d = normalizeDate(v);
      if (d === undefined) return { error: `invalid date: ${k}` };
      out[k] = d;
    }
  }
  if (Object.keys(out).length === 0) return { error: 'params.patch is empty' };
  return { patch: out };
}

/** tickets.update: Umbral tickets have a status and no reply thread, so the
 *  only thing the platform may change is `status`. */
export function sanitizeTicketUpdate(
  patch: unknown,
): { patch: { status: string } } | { error: string } {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { error: 'params.patch required' };
  }
  const entries = Object.entries(patch as Row);
  for (const [k] of entries) if (k !== 'status') return { error: `field not allowed: ${k}` };
  const status = (patch as Row).status;
  if (!(TICKET_STATUSES as readonly string[]).includes(status as string)) {
    return { error: `invalid status: ${String(status)}` };
  }
  return { patch: { status: status as string } };
}

/** The raw ticket plus the creator's email (resolved from created_by_user_id
 *  when the ticket predates created_by_email). */
export function projectTicket(t: Row, userEmail: string | null) {
  return { ...t, created_by_email: (typeof t.created_by_email === 'string' && t.created_by_email) || userEmail || null };
}

/** Umbral Session -> the common shape Mission Control syncs. */
export function projectSession(s: Row, user: Row | null | undefined) {
  return {
    id: s.id ?? null,
    user_email: (user?.email as string | undefined) ?? null,
    user_name: (user?.full_name as string | undefined) ?? null,
    device: (s.device_label as string) || (s.device_id as string) || null,
    started_at: s.created_date ?? null,
    last_active_at: s.last_seen ?? null,
    revoked_at: s.status === 'revoked' ? (s.updated_date ?? null) : null,
  };
}

export function cleanRevokeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const id of ids) if (typeof id === 'string' && id) seen.add(id);
  return [...seen].slice(0, MAX_REVOKE_IDS);
}

/** usage.summary: only known entities are counted; anything else is null. */
export function usageEntities(requested: unknown): string[] {
  return Array.isArray(requested) ? requested.filter((e): e is string => typeof e === 'string') : [];
}
export function isUsageEntity(e: string): boolean {
  return (USAGE_ENTITIES as readonly string[]).includes(e);
}

/** One contact per condo_admin user (never the built-in platform `admin`).
 *  `id` is the condominium id, which is what Mission Control matches a licence
 *  row against. Admins without a condominium or a usable email are skipped. */
export function condoContacts(admins: Row[]) {
  const out: Array<{ id: string; name: string; email: string }> = [];
  for (const u of admins) {
    if (u?.role !== 'condo_admin') continue;
    const id = condominiumIdOf(u);
    const email = normEmail(u.email);
    if (!id || !email) continue;
    out.push({ id, name: (typeof u.full_name === 'string' && u.full_name) || email, email });
  }
  return out;
}

// ── emails.sendFollowup ─────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
export const MAX_SUBJECT = 200;
export const MAX_HTML = 200_000;

/** Validates an emails.sendFollowup request and decides whether `to` may
 *  receive it. A signed body alone must not turn this into "email anyone":
 *  - internal (ops notices) -> only ACACIA's own addresses: the acaciaco.com.mx
 *    domain or the owner/support secrets.
 *  - otherwise -> only a current condominium admin contact. */
export function checkFollowup(
  params: Row,
  allowed: { internal: string[]; contacts: string[] },
): { to: string; subject: string; html: string; internal: boolean } | { error: string; status: number } {
  const to = normEmail(params.to);
  const subject = typeof params.subject === 'string' ? params.subject.trim() : '';
  const html = typeof params.html === 'string' ? params.html : '';
  if (!to || !subject || !html) return { error: 'params.to/subject/html required', status: 400 };
  if (!EMAIL_RE.test(to)) return { error: 'invalid params.to', status: 400 };
  if (subject.length > MAX_SUBJECT || /[\r\n]/.test(subject)) return { error: 'invalid params.subject', status: 400 };
  if (html.length > MAX_HTML) return { error: 'params.html too large', status: 400 };
  const internal = params.internal === true;
  const ok = internal
    ? to.endsWith('@acaciaco.com.mx') || allowed.internal.map(normEmail).includes(to)
    : allowed.contacts.map(normEmail).includes(to);
  if (!ok) return { error: 'recipient not allowed', status: 403 };
  return { to, subject, html, internal };
}
