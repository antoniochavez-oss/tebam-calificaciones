// ─── config.js ─── carga primero, sin dependencias ───────────
const SUPABASE_URL      = 'https://ivmakshnjjgyjxytviqp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_G5Z7F_qeyg_D0RgGHFHJKw_X_lPJDX7';

const IS_PROD = location.hostname.endsWith('.pages.dev') ||
                location.hostname === 'tebam.edu.mx';

const URLS = {
  login:   IS_PROD ? 'https://tebam-calificaciones.pages.dev/login.html'  : '../login.html',
  docente: IS_PROD ? 'https://tebam-calificaciones.pages.dev/app.html'    : '../pages/docente.html',
  alumno:  IS_PROD ? 'https://tebam-calificaciones.pages.dev/alumno.html' : '../pages/alumno.html',
  padre:   IS_PROD ? 'https://tebam-calificaciones.pages.dev/padre.html'  : '../pages/padre.html',
  admin:   IS_PROD ? 'https://tebam-calificaciones.pages.dev/admin.html'  : '../pages/admin.html',
};

// Redirige al portal correcto según el rol
function redirectByRol(rol) {
  const dest = URLS[rol] || URLS.docente;
  if (location.href !== dest) location.href = dest;
}
