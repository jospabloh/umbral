// deno test --allow-env base44/tests/bridge_test.ts
// Zero external imports: only the shared signer and the pure bridge logic.
import { signAs } from '../functions/acaciaControl/_acaciaSign.ts';
import {
  authorizeBridge,
  checkFollowup,
  cleanRevokeIds,
  condoContacts,
  condominiumIdOf,
  entityError,
  isUsageEntity,
  projectCondominium,
  projectSession,
  projectTicket,
  sanitizeLicensePatch,
  sanitizeTicketUpdate,
} from '../functions/acaciaControl/_bridge_logic.ts';

function assertEquals(actual: unknown, expected: unknown, msg?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(msg || `expected ${e}, got ${a}`);
}

const MASTER = 'test-master';
const NOW = 1_800_000_000_000;
const ENV = { secret: MASTER, slug: 'umbral' };

async function signed(slug: string, action = 'ping', params: Record<string, unknown> = {}, ts = NOW) {
  return { action, params, ts: String(ts), sig: await signAs(MASTER, slug, String(ts), action, params) };
}

Deno.test('a body signed with umbral\'s derived key is accepted (200 path)', async () => {
  const g = await authorizeBridge(ENV, await signed('umbral', 'licenses.list', { entity: 'Condominium' }), NOW);
  assertEquals(g.ok, true);
  if (g.ok) assertEquals([g.action, g.params], ['licenses.list', { entity: 'Condominium' }]);
});

Deno.test('a body signed by ANOTHER app is rejected with 401', async () => {
  for (const other of ['sommel', 'puntos', 'rumbo']) {
    const g = await authorizeBridge(ENV, await signed(other), NOW);
    assertEquals(g.ok, false, other);
    if (!g.ok) assertEquals(g.status, 401);
  }
});

Deno.test('a tampered body is 401', async () => {
  const b = await signed('umbral', 'license.set', { id: 'a' });
  const g = await authorizeBridge(ENV, { ...b, params: { id: 'b' } }, NOW);
  assertEquals(g.ok, false);
  if (!g.ok) assertEquals(g.status, 401);
});

Deno.test('secret or slug unset FAILS CLOSED with 503, even for a valid signature', async () => {
  const body = await signed('umbral');
  for (const env of [{}, { secret: MASTER }, { slug: 'umbral' }, { secret: '', slug: 'umbral' }, { secret: MASTER, slug: null }]) {
    const g = await authorizeBridge(env, body, NOW);
    assertEquals(g.ok, false);
    if (!g.ok) assertEquals([g.status, g.code], [503, 'bridge_not_configured']);
  }
});

Deno.test('missing fields are 400, checked before the signature', async () => {
  for (const b of [{}, null, { action: 'ping' }, { action: 'ping', ts: '1' }, { ts: '1', sig: 'x' }]) {
    const g = await authorizeBridge(ENV, b, NOW);
    assertEquals(g.ok, false);
    if (!g.ok) assertEquals(g.status, 400);
  }
  const arr = await authorizeBridge(ENV, { action: 'ping', params: [], ts: String(NOW), sig: 'x' }, NOW);
  if (arr.ok || arr.status !== 400) throw new Error('array params must be 400');
});

Deno.test('entityError pins each action to one entity', () => {
  assertEquals(entityError('Condominium', 'Condominium'), null);
  assertEquals(entityError('Condominium', 'User') !== null, true);
  assertEquals(entityError('Session', undefined) !== null, true);
});

Deno.test('license.set patch: only the four platform fields, validated', () => {
  assertEquals(
    sanitizeLicensePatch({ billing_status: 'active', license_plan: 'pro', license_expires_at: '2026-11-01' }),
    { patch: { billing_status: 'active', license_plan: 'pro', license_expires_at: '2026-11-01T00:00:00.000Z' } },
  );
  assertEquals(sanitizeLicensePatch({ trial_end_at: null }), { patch: { trial_end_at: null } });
  for (const bad of [
    { join_code: 'X' }, { name: 'x' }, { billing_status: 'gratis' }, { trial_end_at: 'nope' },
    { license_plan: 5 }, { billing_status: 'active', address: 'x' }, {}, null, [], 'x',
  ]) {
    assertEquals('error' in sanitizeLicensePatch(bad), true, JSON.stringify(bad));
  }
});

Deno.test('tickets.update: only status in {submitted, resolved}', () => {
  assertEquals(sanitizeTicketUpdate({ status: 'resolved' }), { patch: { status: 'resolved' } });
  assertEquals(sanitizeTicketUpdate({ status: 'submitted' }), { patch: { status: 'submitted' } });
  for (const bad of [
    { status: 'cerrado' }, { status: 'resolved', message: 'x' }, { message: 'x' },
    { condominium_id: 'c2' }, { status: 'resolved', created_by_email: 'a@b.c' }, {}, null, [], 'x',
  ]) {
    assertEquals('error' in sanitizeTicketUpdate(bad), true, JSON.stringify(bad));
  }
});

Deno.test('projectCondominium never exposes join_code, address or legal fields', () => {
  const p = projectCondominium({
    id: 'c1', name: 'Torres', join_code: 'ABC12345', address: 'Calle 1', legal_name: 'Torres AC',
    privacy_contact_email: 'p@x.mx', legal_version: 'v1', billing_status: 'trial',
    trial_end_at: '2026-11-01T00:00:00Z', license_plan: 'pro',
  }, 'admin@x.mx');
  assertEquals(Object.keys(p).sort(), [
    'billing_status', 'created_date', 'id', 'license_expires_at', 'license_plan', 'name', 'owner_email', 'trial_end_at',
  ]);
  const json = JSON.stringify(p);
  for (const secret of ['ABC12345', 'Calle 1', 'Torres AC', 'p@x.mx', 'v1']) {
    assertEquals(json.includes(secret), false, secret);
  }
  assertEquals(p.owner_email, 'admin@x.mx');
  assertEquals(projectCondominium(null, null).id, null);
});

Deno.test('projectSession maps Umbral fields and revoked_at', () => {
  const user = { email: 'a@x.mx', full_name: 'Ana' };
  const base = { id: 's1', user_id: 'u1', device_id: 'dev-1', created_date: 'C', updated_date: 'U', last_seen: 'L' };
  assertEquals(projectSession({ ...base, device_label: 'iPhone', status: 'active' }, user), {
    id: 's1', user_email: 'a@x.mx', user_name: 'Ana', device: 'iPhone',
    started_at: 'C', last_active_at: 'L', revoked_at: null,
  });
  // No label: falls back to the device id. Revoked: updated_date is the time.
  const r = projectSession({ ...base, status: 'revoked' }, user);
  assertEquals([r.device, r.revoked_at], ['dev-1', 'U']);
  assertEquals(projectSession({ ...base, status: 'revoked', updated_date: undefined }, null).revoked_at, null);
  assertEquals(projectSession({ ...base, status: 'passive' }, null).revoked_at, null);
});

Deno.test('projectTicket adds created_by_email, preferring the stored one', () => {
  assertEquals(projectTicket({ id: 't', subject: 's' }, 'u@x.mx').created_by_email, 'u@x.mx');
  assertEquals(projectTicket({ id: 't', created_by_email: 'own@x.mx' }, 'u@x.mx').created_by_email, 'own@x.mx');
  assertEquals(projectTicket({ id: 't' }, null).created_by_email, null);
});

Deno.test('tenant pointer: top-level, else legacy data / data.data', () => {
  assertEquals(condominiumIdOf({ condominium_id: 'c1' }), 'c1');
  assertEquals(condominiumIdOf({ condominium_id: '', data: { condominium_id: 'c2' } }), 'c2');
  assertEquals(condominiumIdOf({ data: { data: { condominium_id: 'c3' } } }), 'c3');
  assertEquals(condominiumIdOf({ condominium_id: '', data: {} }), '');
  // Migrated record: a cleared pointer never falls back to the legacy copy.
  assertEquals(condominiumIdOf({ condominium_id: '', legacy_migrated_at: '2026-10-14T00:00:00Z', data: { condominium_id: 'c9' } }), '');
});

Deno.test('contacts: condo_admin only, platform admin and unscoped users skipped', () => {
  assertEquals(condoContacts([
    { role: 'condo_admin', condominium_id: 'c1', email: 'Ana@X.mx', full_name: 'Ana' },
    { role: 'condo_admin', condominium_id: 'c2', email: 'b@x.mx' },
    { role: 'admin', condominium_id: 'c1', email: 'plat@x.mx' },
    { role: 'condo_admin', condominium_id: '', email: 'huerfano@x.mx' },
    { role: 'resident', condominium_id: 'c1', email: 'res@x.mx' },
  ]), [
    { id: 'c1', name: 'Ana', email: 'ana@x.mx' },
    { id: 'c2', name: 'b@x.mx', email: 'b@x.mx' },
  ]);
});

const ALLOWED = { internal: ['h.josepablo@gmail.com'], contacts: ['ana@x.mx'] };
const MAIL = { subject: 'Tu licencia', html: '<p>hola</p>' };

Deno.test('followup: contact ok, arbitrary address 403, internal only to ACACIA', () => {
  const ok = checkFollowup({ ...MAIL, to: 'Ana@X.mx' }, ALLOWED);
  assertEquals('error' in ok ? ok : ok.to, 'ana@x.mx');
  assertEquals('error' in checkFollowup({ ...MAIL, to: 'otro@gmail.com' }, ALLOWED) && 403, 403);
  assertEquals('error' in checkFollowup({ ...MAIL, to: 'soporte@acaciaco.com.mx', internal: true }, ALLOWED), false);
  assertEquals('error' in checkFollowup({ ...MAIL, to: 'ana@x.mx', internal: true }, ALLOWED), true);
  assertEquals('error' in checkFollowup({ ...MAIL, to: 'x@acaciaco.com.mx.evil.io', internal: true }, ALLOWED), true);
  assertEquals((checkFollowup({ to: 'ana@x.mx', subject: 'a\nBcc: x@y.z', html: 'h' }, ALLOWED) as { status: number }).status, 400);
});

Deno.test('usage allowlist and revoke ids', () => {
  assertEquals(isUsageEntity('AccessPass'), true);
  assertEquals(isUsageEntity('LegalAcceptance'), false);
  assertEquals(isUsageEntity('SupportTicket'), false);
  assertEquals(cleanRevokeIds(['a', 'a', '', 5, 'b']), ['a', 'b']);
  assertEquals(cleanRevokeIds('x'), []);
});
