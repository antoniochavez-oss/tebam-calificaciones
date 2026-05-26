// ─── auth.js ─── depende de: config.js, supabase.js ─────────
// Protege la página y llena los datos del usuario en el UI.
// Uso: await Auth.init() al inicio de cada portal.

const Auth = window.Auth = {

  user:   null,
  perfil: null,

  // Inicia sesión
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Registro con rol explícito
  async register(email, password, nombre, rol = 'docente') {
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: {
        data: { nombre, rol },
        emailRedirectTo: URLS[rol] || URLS.docente,
      }
    });
    if (error) throw error;
    return data;
  },

  // Cierra sesión
  async logout() {
    await sb.auth.signOut();
    location.href = URLS.login;
  },

  // Guarda que hay sesión; si no, redirige al login.
  // rolRequerido: si se pasa, verifica que el perfil tenga ese rol.
  async init(rolRequerido = null) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.href = URLS.login; return null; }

    this.user = session.user;

    // Cargar perfil
    const { data: perfil } = await sb
      .from('perfiles')
      .select('*')
      .eq('id', this.user.id)
      .single();

    this.perfil = perfil;

    // Verificar rol si se requiere
    // admin y coordinador tienen acceso expandido
    if (rolRequerido) {
      const rolesPermitidos = {
        'admin':   ['admin', 'coordinador'],
        'docente': ['docente', 'admin', 'coordinador'],
      };
      const permitidos = rolesPermitidos[rolRequerido] || [rolRequerido, 'admin'];
      if (!permitidos.includes(perfil?.rol)) {
        redirectByRol(perfil?.rol);
        return null;
      }
    }

    // Hidratar UI con datos del usuario
    this._hydrateUI();

    // Escuchar cambios de sesión
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') location.href = URLS.login;
    });

    return perfil;
  },

  _hydrateUI() {
    const p = this.perfil;
    if (!p) return;

    const nombre   = p.nombre || this.user.email.split('@')[0];
    const iniciales = nombre.split(/\s+/).slice(0, 2)
      .map(s => s[0]?.toUpperCase() || '').join('');
    const rolLabel = {
      docente:'Docente', alumno:'Alumno',
      padre:'Padre de familia', admin:'Administrador',
      coordinador:'Coordinador'
    }[p.rol] || p.rol;

    document.querySelectorAll('.user-name').forEach(el => el.textContent = nombre);
    document.querySelectorAll('.user-rol').forEach(el => el.textContent = `${rolLabel} · TEBAM`);
    document.querySelectorAll('.user-avatar').forEach(el => el.textContent = iniciales);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = this.user.email);
  }
};
