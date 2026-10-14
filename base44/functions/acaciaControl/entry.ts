import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { asPage } from "../../shared/auth.ts";
import {
  COUNT_CAP,
  LICENSE_ENTITY,
  SESSION_ENTITY,
  TICKET_ENTITY,
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
  usageEntities,
} from "./_bridge_logic.ts";

// acaciaControl: the ACACIA Mission Control bridge for Umbral (standard modules
// 5 and 15). Mission Control calls this over an HMAC-signed body, no user
// token: { action, params, ts, sig }. The signature is checked against THIS
// app's derived key (INGEST_HMAC_SECRET + ACACIA_APP_SLUG, see _acaciaSign.ts).
// That signature is the only authorization: there is no user session here.
//
// Fail closed: while either secret is unset every call answers 503 and nothing
// is read or written. Secret values are never logged or returned.
//
// Actions: ping, licenses.list (alias tenants), license.set, tickets.list,
// tickets.update (status only: Umbral tickets have no reply thread),
// tenants.contacts, emails.sendFollowup, usage.summary, sessions.list,
// sessions.revoke. Anything else answers 400 unknown action.
export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const gate = await authorizeBridge(
      { secret: Deno.env.get("INGEST_HMAC_SECRET"), slug: Deno.env.get("ACACIA_APP_SLUG") },
      body,
    );
    if (!gate.ok) return Response.json({ error: gate.error, code: gate.code }, { status: gate.status });
    const { action, params } = gate;

    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    // Every condo_admin, oldest first, so "the owner" of a condominium is
    // deterministic when it has more than one.
    const condoAdmins = async () =>
      asPage(await sr.entities.User.filter({ role: "condo_admin" }, { sort: "created_date", limit: COUNT_CAP }));

    // id -> User for the distinct ids given. One get per id, failures skipped.
    const usersById = async (ids) => {
      const out = new Map();
      const unique = [...new Set(ids.filter((i) => typeof i === "string" && i))];
      for (let i = 0; i < unique.length; i += 20) {
        await Promise.all(unique.slice(i, i + 20).map(async (id) => {
          try {
            const u = await sr.entities.User.get(id);
            if (u) out.set(id, u);
          } catch { /* deleted account: the row simply has no email */ }
        }));
      }
      return out;
    };

    switch (action) {
      case "ping": {
        // A real round-trip to the store, so "ok" means the backend can read.
        try {
          await sr.entities.Condominium.list({ limit: 1 });
          return Response.json({ ok: true, pong: true });
        } catch (e) {
          console.error("acaciaControl ping: store read failed", e?.message);
          return Response.json({ ok: false, error: "store_unreachable" }, { status: 503 });
        }
      }

      case "licenses.list":
      case "tenants": {
        const bad = entityError(LICENSE_ENTITY, params.entity);
        if (bad) return Response.json({ error: bad }, { status: 400 });
        const [condos, admins] = await Promise.all([
          sr.entities.Condominium.list({ sort: "-created_date", limit: COUNT_CAP }).then(asPage),
          condoAdmins(),
        ]);
        const ownerByCondo = new Map();
        for (const u of admins) {
          const cid = condominiumIdOf(u);
          if (cid && u.email && !ownerByCondo.has(cid)) ownerByCondo.set(cid, u.email);
        }
        return Response.json({
          ok: true,
          records: condos.map((c) => projectCondominium(c, ownerByCondo.get(c.id) ?? null)),
        });
      }

      case "license.set": {
        // Only the four platform-owned Condominium fields, validated. `log`
        // and `mirror` (other apps' audit row / User mirror) do not apply.
        const bad = entityError(LICENSE_ENTITY, params.entity);
        if (bad) return Response.json({ error: bad }, { status: 400 });
        const id = params.id;
        if (typeof id !== "string" || !id) return Response.json({ error: "params.id required" }, { status: 400 });
        const checked = sanitizeLicensePatch(params.patch);
        if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
        const [condo] = asPage(await sr.entities.Condominium.filter({ id }, { limit: 1 }));
        if (!condo) return Response.json({ error: "not found" }, { status: 404 });
        await sr.entities.Condominium.update(id, checked.patch);
        return Response.json({ ok: true });
      }

      case "tickets.list": {
        const bad = entityError(TICKET_ENTITY, params.entity);
        if (bad) return Response.json({ error: bad }, { status: 400 });
        const tickets = asPage(await sr.entities.SupportTicket.list({ sort: "-created_date", limit: COUNT_CAP }));
        const users = await usersById(tickets.filter((t) => !t.created_by_email).map((t) => t.created_by_user_id));
        return Response.json({
          ok: true,
          records: tickets.map((t) => projectTicket(t, users.get(t.created_by_user_id)?.email ?? null)),
        });
      }

      case "tickets.update": {
        const bad = entityError(TICKET_ENTITY, params.entity);
        if (bad) return Response.json({ error: bad }, { status: 400 });
        const id = params.id;
        if (typeof id !== "string" || !id) return Response.json({ error: "params.id required" }, { status: 400 });
        if (params.message !== undefined || params.appendField !== undefined || params.appendItem !== undefined) {
          return Response.json({ error: "replies not supported" }, { status: 400 });
        }
        const checked = sanitizeTicketUpdate(params.patch);
        if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
        const [ticket] = asPage(await sr.entities.SupportTicket.filter({ id }, { limit: 1 }));
        if (!ticket) return Response.json({ error: "not found" }, { status: 404 });
        await sr.entities.SupportTicket.update(id, checked.patch);
        return Response.json({ ok: true });
      }

      case "tenants.contacts": {
        // `recipient` (Mission Control's spec) is ignored: who speaks for a
        // condominium is Umbral's rule, not the caller's. Read-only.
        const bad = entityError(LICENSE_ENTITY, params.entity);
        if (bad) return Response.json({ error: bad }, { status: 400 });
        return Response.json({ ok: true, contacts: condoContacts(await condoAdmins()) });
      }

      case "emails.sendFollowup": {
        // Mission Control owns the content; this only sends it, and only to an
        // allowed recipient (checkFollowup). The owner gets a copy of what goes
        // to a condominium; an internal notice is already addressed to ACACIA.
        const owner = Deno.env.get("PLATFORM_OWNER_EMAIL") ?? "";
        const support = Deno.env.get("APP_SUPPORT_EMAIL") ?? "";
        const contacts = params.internal === true ? [] : condoContacts(await condoAdmins()).map((c) => c.email);
        const checked = checkFollowup(params, { internal: [owner, support].filter(Boolean), contacts });
        if ("error" in checked) return Response.json({ error: checked.error }, { status: checked.status });
        await sr.integrations.Core.SendEmail({
          to: checked.to, subject: checked.subject, body: checked.html, from_name: "ACACIA",
        });
        const sent_at = new Date().toISOString();
        if (!checked.internal && owner && owner.toLowerCase() !== checked.to) {
          try {
            await sr.integrations.Core.SendEmail({
              to: owner, subject: `[Copia → ${checked.to}] ${checked.subject}`, body: checked.html, from_name: "ACACIA",
            });
          } catch { /* the owner copy never fails the contact's send */ }
        }
        return Response.json({ ok: true, sent_at, recipient: checked.to });
      }

      case "usage.summary": {
        const counts = {};
        for (const e of usageEntities(params.entities)) {
          if (!isUsageEntity(e)) { counts[e] = null; continue; }
          try {
            counts[e] = asPage(await sr.entities[e].list({ limit: COUNT_CAP })).length;
          } catch {
            counts[e] = null; // entity missing or unreadable
          }
        }
        return Response.json({ ok: true, counts, cap: COUNT_CAP });
      }

      case "sessions.list": {
        const bad = entityError(SESSION_ENTITY, params.entity);
        if (bad) return Response.json({ error: bad }, { status: 400 });
        const sessions = asPage(await sr.entities.Session.list({ sort: "-last_seen", limit: COUNT_CAP }));
        const users = await usersById(sessions.map((s) => s.user_id));
        return Response.json({ ok: true, records: sessions.map((s) => projectSession(s, users.get(s.user_id))) });
      }

      case "sessions.revoke": {
        // Force-logout: sessionHeartbeat answers 403 for a revoked session.
        const bad = entityError(SESSION_ENTITY, params.entity);
        if (bad) return Response.json({ error: bad }, { status: 400 });
        const ids = cleanRevokeIds(params.ids);
        if (ids.length === 0) return Response.json({ error: "params.ids required" }, { status: 400 });
        let revoked = 0;
        for (const id of ids) {
          try { await sr.entities.Session.update(id, { status: "revoked" }); revoked++; } catch { /* skip missing */ }
        }
        return Response.json({ ok: true, revoked });
      }

      default:
        return Response.json({ error: `unknown action: ${action}` }, { status: 400 });
    }
  } catch (e) {
    console.error("acaciaControl failed", e?.message);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
