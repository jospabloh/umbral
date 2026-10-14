import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller } from "../../shared/auth.ts";
import { pingMissionControl } from "../../shared/mcPing.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";
    if (action !== "create") return Response.json({ error: "Acción no válida." }, { status: 400 });

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { caller, condominiumId } = ctx;

    const type = body.type;
    if (!type || !["soporte", "mejora", "arco", "legal"].includes(type)) {
      return Response.json({ error: "Tipo no válido." }, { status: 400 });
    }
    const subject = (body.subject || "").trim();
    const message = (body.message || "").trim();
    if (!subject || !message) {
      return Response.json({ error: "Asunto y mensaje son obligatorios." }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.SupportTicket.create({
      condominium_id: condominiumId,
      created_by_user_id: caller.id,
      created_by_email: caller.email,
      type,
      subject,
      message,
      status: "submitted",
      app: "umbral",
    });
    await pingMissionControl("/api/ingest/ticket-pull", { app: "umbral", ticketId: created.id });
    return Response.json({ ok: true, ticket_id: created.id });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}