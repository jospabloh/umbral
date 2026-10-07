export const APP_VERSION = "0.1.0";
export const RELEASE_DATE = "2026-10-07";

export const CHANGELOG = [
  {
    version: "0.1.0",
    date: "2026-10-07",
    title: "Primera versión: los cimientos",
    items: [
      "Cuentas, condominio y roles con aislamiento entre condominios.",
      "Aceptación de Términos y Condiciones por versión, en nombre del condominio.",
      "Permisos ajustables por condominio y rol.",
      "Sesión por dispositivo con aviso de inactividad.",
      "Pantallas de cuenta, miembros, soporte y acerca de.",
      "Tema claro, oscuro y sistema.",
    ],
  },
];

export const MANUAL_SECTIONS = [
  {
    id: "inicio",
    title: "Primeros pasos",
    body: "Cuando creas tu cuenta, eliges entre registrar tu condominio o usar un código de invitación. Si registras, quedas como administrador del condominio. Si usas un código, el administrador del condominio aprueba tu ingreso y te asigna un rol.",
  },
  {
    id: "roles",
    title: "Roles",
    body: "Administrador del condominio: gestiona todo. Mesa directiva: lee todo y publica avisos. Vigilante: valida pases y registra accesos. Residente: crea sus pases y ve su estado de cuenta.",
  },
  {
    id: "terminos",
    title: "Términos y condiciones",
    body: "El administrador acepta los términos una vez por versión, en nombre del condominio. Mientras dure el plazo, puede posponer la decisión. Rechazar no bloquea a los demás residentes.",
  },
  {
    id: "permisos",
    title: "Permisos",
    body: "Desde la pantalla de Permisos, el administrador ajusta qué puede hacer cada rol. Los cambios se guardan al instante.",
  },
  {
    id: "sesion",
    title: "Sesión y dispositivos",
    body: "Puedes ver en Cuenta los dispositivos donde tienes sesión abierta y revocarlos. Tras 20 minutos sin actividad, la app avisa y cierra sesión tras dos minutos.",
  },
  {
    id: "soporte",
    title: "Soporte",
    body: "Desde Soporte puedes reportar un problema o sugerir una mejora. Para solicitudes de datos personales usa la opción ARCO.",
  },
];