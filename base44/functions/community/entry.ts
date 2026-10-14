import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller, guardBilling, asPage } from "../../shared/auth.ts";
import { hasPermission } from "../../shared/permissions.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { stored, condominiumId, condominium, caller } = ctx;
    if (!condominiumId) return Response.json({ error: "Sin condominio." }, { status: 400 });

    if (action === "listNotices") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Avisos:ver");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const res = await base44.asServiceRole.entities.Notice.filter(
        { condominium_id: condominiumId, status: "published" },
        { sort: "-published_at", limit: 100 }
      );
      return Response.json({ items: asPage(res) });
    }

    if (action === "createNotice") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Avisos:crear");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const title = (body.title || "").trim();
      const text = (body.body || "").trim();
      if (!title || !text) return Response.json({ error: "Título y mensaje requeridos." }, { status: 400 });
      const notice = await base44.asServiceRole.entities.Notice.create({
        condominium_id: condominiumId,
        created_by_user_id: caller.id,
        created_by_name: stored.full_name || caller.email,
        title,
        body: text,
        type: body.type || "info",
        pinned: !!body.pinned,
        status: "published",
        published_at: new Date().toISOString(),
      });
      return Response.json({ notice });
    }

    if (action === "archiveNotice") {
      const allowed = await hasPermission(base44, stored, condominiumId, "Avisos:eliminar");
      if (!allowed) return Response.json({ error: "Sin permiso." }, { status: 403 });
      const blocked = guardBilling(condominium);
      if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });
      const notice = await base44.asServiceRole.entities.Notice.get(body.notice_id);
      if (!notice || notice.condominium_id !== condominiumId) {
        return Response.json({ error: "Aviso no encontrado." }, { status: 404 });
      }
      await base44.asServiceRole.entities.Notice.update(body.notice_id, { ...notice, status: "archived" });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}