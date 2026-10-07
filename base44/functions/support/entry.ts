import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { resolveCaller } from "../../shared/auth.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";
    if (action !== "create") return Response.json({ error: "Acción no válida." }, { status: 400 });

    const ctx = await resolveCaller(base44);
    if (!ctx.ok) return Response.json({ error: ctx.error }, { status: ctx.status });
    const { caller, stored, condominiumId } = ctx;

    const type = body.type;
    if (!type || !["soporte", "mejora", "arco", "legal"].includes(type)) {
      return Response.json({ error: "Tipo no válido." }, { status: 400 });
    }
    const subject = (body.subject || "").trim();
    const message = (body.message || "").trim();
    if (!subject || !message) {
      return Response.json({ error: "Asunto y mensaje son obligatorios." }, { status: 400 });
    }

    await base44.asServiceRole.entities.SupportTicket.create({
      data: {
        condominium_id: condominiumId,
        created_by_user_id: caller.id,
        type,
        subject,
        message,
        status: "submitted",
        app: "umbral",
      },
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}