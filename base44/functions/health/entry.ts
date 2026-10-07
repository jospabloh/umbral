import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const start = Date.now();
    await base44.asServiceRole.entities.Condominium.list({ limit: 1 });
    const ms = Date.now() - start;
    return Response.json({ ok: true, db_ms: ms, at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || "Error interno" }, { status: 500 });
  }
}