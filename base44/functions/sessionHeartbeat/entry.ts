import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, asPage } from "../../shared/auth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { caller, stored } = ctx;

    const deviceId = body.device_id;
    const deviceLabel = body.device_label || "Dispositivo";
    if (!deviceId) return Response.json({ error: "Falta device_id." }, { status: 400 });

    const res = await base44.asServiceRole.entities.Session.filter(
      { user_id: caller.id, device_id: deviceId },
      { limit: 1 }
    );
    const existing = asPage(res);

    if (existing.length > 0 && existing[0].data.status === "revoked") {
      return Response.json({ error: "Sesión revocada." }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Promote this device to active; demote the user's other sessions to passive.
    const allRes = await base44.asServiceRole.entities.Session.filter(
      { user_id: caller.id, status: "active" },
      { limit: 100 }
    );
    for (const s of asPage(allRes)) {
      if (existing.length > 0 && s.id === existing[0].id) continue;
      await base44.asServiceRole.entities.Session.update(s.id, {
        data: { ...s.data, status: "passive" },
      });
    }

    if (existing.length > 0) {
      await base44.asServiceRole.entities.Session.update(existing[0].id, {
        data: { ...existing[0].data, status: "active", device_label: deviceLabel, last_seen: now },
      });
    } else {
      await base44.asServiceRole.entities.Session.create({
        data: { user_id: caller.id, device_id: deviceId, device_label: deviceLabel, status: "active", last_seen: now },
      });
    }

    return Response.json({ ok: true, role: stored.role });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}