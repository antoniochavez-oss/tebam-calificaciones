// ─── config.js ─── carga primero, sin dependencias ───────────
const SUPABASE_URL      = 'https://ivmakshnjjgyjxytviqp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_G5Z7F_qeyg_D0RgGHFHJKw_X_lPJDX7';

const IS_PROD = location.hostname.endsWith('.pages.dev') ||
                location.hostname === 'tebam.edu.mx';

const BASE = IS_PROD ? 'https://tebam-calificaciones.pages.dev' : '..';

const URLS = {
  login:      `${BASE}/login.html`,
  docente:    `${BASE}/pages/docente.html`,
  alumno:     `${BASE}/pages/alumno.html`,
  padre:      `${BASE}/pages/padre.html`,
  admin:      `${BASE}/pages/admin.html`,
  mensajeria: `${BASE}/pages/mensajeria.html`,
};

// Redirige al portal correcto según el rol
function redirectByRol(rol) {
  const dest = URLS[rol] || URLS.docente;
  if (location.href !== dest) location.href = dest;
}
