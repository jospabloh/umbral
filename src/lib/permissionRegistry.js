// Client-side permission registry for Umbral. Mirrors base44/shared/permissions.ts.
// The client uses this to show/hide UI; backend functions re-check every write.

export const PERMISSION_DEFAULTS = {
  "Unidades:ver": { condo_admin: true, committee: true, guard: false, resident: false },
  "Unidades:crear": { condo_admin: true, committee: false, guard: false, resident: false },
  "Unidades:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Unidades:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Residentes:ver": { condo_admin: true, committee: true, guard: false, resident: false },
  "Residentes:crear": { condo_admin: true, committee: false, guard: false, resident: false },
  "Residentes:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Residentes:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Vehiculos:ver": { condo_admin: true, committee: true, guard: false, resident: false },
  "Vehiculos:crear": { condo_admin: true, committee: false, guard: false, resident: false },
  "Vehiculos:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Vehiculos:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Accesos:ver": { condo_admin: true, committee: true, guard: true, resident: false },
  "Accesos:crear": { condo_admin: true, committee: false, guard: true, resident: true },
  "Accesos:modificar": { condo_admin: true, committee: false, guard: true, resident: true },
  "Accesos:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Cuotas:ver": { condo_admin: true, committee: true, guard: false, resident: false },
  "Cuotas:crear": { condo_admin: true, committee: false, guard: false, resident: false },
  "Cuotas:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Cuotas:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Pagos:ver": { condo_admin: true, committee: true, guard: false, resident: false },
  "Pagos:crear": { condo_admin: true, committee: false, guard: false, resident: false },
  "Pagos:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Pagos:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Avisos:ver": { condo_admin: true, committee: true, guard: false, resident: true },
  "Avisos:crear": { condo_admin: true, committee: true, guard: false, resident: false },
  "Avisos:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Avisos:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Miembros:ver": { condo_admin: true, committee: false, guard: false, resident: false },
  "Miembros:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Permisos:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Proveedores:ver": { condo_admin: true, committee: true, guard: false, resident: false },
  "Proveedores:crear": { condo_admin: true, committee: false, guard: false, resident: false },
  "Proveedores:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Proveedores:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Personal:ver": { condo_admin: true, committee: true, guard: false, resident: false },
  "Personal:crear": { condo_admin: true, committee: false, guard: false, resident: false },
  "Personal:modificar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Personal:eliminar": { condo_admin: true, committee: false, guard: false, resident: false },
  "Reportes:ver": { condo_admin: true, committee: true, guard: false, resident: false },
};

export const PERMISSION_SECTIONS = [
  "Unidades", "Residentes", "Vehiculos", "Accesos", "Cuotas", "Pagos", "Avisos", "Miembros", "Proveedores", "Personal", "Reportes",
];

export const PERMISSION_ACTIONS = ["ver", "crear", "modificar", "eliminar"];

export function can(role, key, overrides = {}) {
  if (role === "admin") return true;
  const overrideKey = `${role}:${key}`;
  if (overrideKey in overrides) return overrides[overrideKey];
  const def = PERMISSION_DEFAULTS[key];
  if (!def) return false;
  return def[role] === true;
}