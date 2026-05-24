// ─── db.js ─── depende de: supabase.js, auth.js ─────────────
// Capa de datos. Todas las queries a Supabase pasan por aquí.

const DB = window.DB = {

  // ─── CICLOS ────────────────────────────────────────────────
  ciclos: {
    async listar() {
      const { data, error } = await sb.from('ciclos')
        .select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async crear({ nombre, fecha_inicio, fecha_fin }) {
      const { data, error } = await sb.from('ciclos')
        .insert({ nombre, fecha_inicio, fecha_fin, activo: true, docente_id: Auth.user.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('ciclos').delete().eq('id', id);
      if (error) throw error;
    },
    async toggleActivo(id, activo) {
      const { error } = await sb.from('ciclos').update({ activo }).eq('id', id);
      if (error) throw error;
    }
  },

  // ─── GRUPOS ────────────────────────────────────────────────
  grupos: {
    async listarPorCiclo(cicloId) {
      const { data, error } = await sb.from('grupos')
        .select(`*, alumnos(count), grupo_docentes(count)`)
        .eq('ciclo_id', cicloId)
        .order('nombre');
      if (error) throw error;
      return data || [];
    },
    async crear({ ciclo_id, nombre, turno, descripcion }) {
      const { data, error } = await sb.from('grupos')
        .insert({ ciclo_id, nombre, turno, descripcion, docente_id: Auth.user.id })
        .select().single();
      if (error) throw error;
      // Auto-asignar al docente creador
      await DB.grupos.asignarDocente(data.id, Auth.user.id);
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('grupos').delete().eq('id', id);
      if (error) throw error;
    },
    async asignarDocente(grupoId, docenteId) {
      const { error } = await sb.from('grupo_docentes')
        .upsert({ grupo_id: grupoId, docente_id: docenteId },
                 { onConflict: 'grupo_id,docente_id' });
      if (error) throw error;
    },
    async listarDocentes(grupoId) {
      const { data, error } = await sb.from('grupo_docentes')
        .select('*, perfil:perfiles(id, nombre, email)')
        .eq('grupo_id', grupoId);
      if (error) throw error;
      return data || [];
    }
  },

  // ─── MATERIAS ──────────────────────────────────────────────
  materias: {
    async listarPorGrupo(grupoId) {
      const { data, error } = await sb.from('materias')
        .select(`*, actividades(count), docente:perfiles!docente_asignado_id(nombre)`)
        .eq('grupo_id', grupoId)
        .order('nombre');
      if (error) throw error;
      return data || [];
    },
    async crear({ grupo_id, nombre, estado }) {
      const { data, error } = await sb.from('materias')
        .insert({
          grupo_id, nombre, estado,
          docente_id: Auth.user.id,
          docente_asignado_id: Auth.user.id,
          ciclo: ''
        })
        .select().single();
      if (error) throw error;
      return data;
    },
    async actualizar(id, campos) {
      const { data, error } = await sb.from('materias')
        .update(campos).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('materias').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ─── ALUMNOS ───────────────────────────────────────────────
  alumnos: {
    async listarPorGrupo(grupoId) {
      const { data, error } = await sb.from('alumnos')
        .select('*')
        .eq('grupo_id', grupoId)
        .eq('activo', true)
        .order('numero_lista');
      if (error) throw error;
      return data || [];
    },
    async crear({ grupo_id, nombre, numero_lista, matricula }) {
      const row = { grupo_id, nombre, numero_lista };
      if (matricula) row.matricula = matricula.trim().toUpperCase();
      const { data, error } = await sb.from('alumnos')
        .insert(row)
        .select().single();
      if (error) throw error;
      return data;
    },
    async importar(rows) {
      // rows: [{ grupo_id, nombre, numero_lista, matricula }]
      // matricula es obligatoria — se filtra antes de llamar esta función
      const lotes = [];
      for (let i = 0; i < rows.length; i += 50) lotes.push(rows.slice(i, i + 50));
      let insertados = 0;
      for (const lote of lotes) {
        const filas = lote.map(r => ({
          grupo_id:     r.grupo_id,
          nombre:       r.nombre,
          numero_lista: r.numero_lista ?? null,
          matricula:    r.matricula ? r.matricula.trim().toUpperCase() : null,
          activo:       true,
        }));
        const { data, error } = await sb.from('alumnos').insert(filas).select();
        if (error) throw error;
        insertados += data?.length || 0;
      }
      return insertados;
    },
    async buscarPorMatricula(matricula) {
      const { data, error } = await sb.from('alumnos')
        .select('id, nombre, perfil_id, activo, matricula, grupo:grupos(nombre)')
        .eq('matricula', matricula.trim().toUpperCase())
        .single();
      if (error) return null;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('alumnos').update({ activo: false }).eq('id', id);
      if (error) throw error;
    }

  // ─── ACTIVIDADES ───────────────────────────────────────────
  actividades: {
    async listar(materiaId) {
      const { data, error } = await sb.from('actividades')
        .select('*').eq('materia_id', materiaId).order('orden');
      if (error) throw error;
      return data || [];
    },
    async crear({ materia_id, nombre, tipo, fecha, valor_max, orden }) {
      const { data, error } = await sb.from('actividades')
        .insert({ materia_id, nombre, tipo, fecha, valor_max, orden })
        .select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('actividades').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ─── CALIFICACIONES ────────────────────────────────────────
  calificaciones: {
    async listarPorMateria(materiaId) {
      // Trae todas las calificaciones de alumnos que tienen actividades de esta materia
      const { data, error } = await sb.from('calificaciones')
        .select('*, actividad:actividades!inner(materia_id)')
        .eq('actividad.materia_id', materiaId);
      if (error) throw error;
      // Mapear a { alumno_id: { actividad_id: { id, valor } } }
      const map = {};
      for (const c of (data || [])) {
        if (!map[c.alumno_id]) map[c.alumno_id] = {};
        map[c.alumno_id][c.actividad_id] = { id: c.id, valor: c.valor };
      }
      return map;
    },
    async guardar({ alumno_id, actividad_id, valor }) {
      const { data, error } = await sb.from('calificaciones')
        .upsert({ alumno_id, actividad_id, valor },
                 { onConflict: 'alumno_id,actividad_id' })
        .select().single();
      if (error) throw error;
      return data;
    }
  },

  // ─── ASISTENCIA ────────────────────────────────────────────
  asistencia: {
    async listarPorMateria(materiaId) {
      const { data, error } = await sb.from('asistencia')
        .select('*').eq('materia_id', materiaId);
      if (error) throw error;
      // { fecha: { alumno_id: { id, estado } } }
      const map = {};
      for (const a of (data || [])) {
        if (!map[a.fecha]) map[a.fecha] = {};
        map[a.fecha][a.alumno_id] = { id: a.id, estado: a.estado };
      }
      return map;
    },
    async guardar({ alumno_id, materia_id, fecha, estado }) {
      const { data, error } = await sb.from('asistencia')
        .upsert({ alumno_id, materia_id, fecha, estado },
                 { onConflict: 'alumno_id,materia_id,fecha' })
        .select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('asistencia').delete().eq('id', id);
      if (error) throw error;
    },
    async marcarTodos(alumnos, materia_id, fecha, estado) {
      const rows = alumnos.map(al => ({ alumno_id: al.id, materia_id, fecha, estado }));
      const { data, error } = await sb.from('asistencia')
        .upsert(rows, { onConflict: 'alumno_id,materia_id,fecha' }).select();
      if (error) throw error;
      return data || [];
    }
  },

  // ─── COMUNICADOS ───────────────────────────────────────────
  comunicados: {
    async listar(grupoId) {
      const { data, error } = await sb.from('comunicados')
        .select('*, docente:perfiles(nombre)')
        .eq('grupo_id', grupoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async crear({ grupo_id, titulo, contenido, tipo }) {
      const { data, error } = await sb.from('comunicados')
        .insert({ grupo_id, titulo, contenido, tipo, docente_id: Auth.user.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('comunicados').delete().eq('id', id);
      if (error) throw error;
    }
  },

  // ─── TUTORES ───────────────────────────────────────────────
  tutores: {
    async alumnosDePadre(padreId) {
      const { data, error } = await sb.from('tutores')
        .select('*, alumno:alumnos(*, grupo:grupos(nombre, ciclo:ciclos(nombre)))')
        .eq('padre_id', padreId);
      if (error) throw error;
      return data || [];
    },
    async vincular({ padre_id, alumno_id, relacion }) {
      const { data, error } = await sb.from('tutores')
        .upsert({ padre_id, alumno_id, relacion },
                 { onConflict: 'padre_id,alumno_id' })
        .select().single();
      if (error) throw error;
      return data;
    }
  },

  // ─── DOCENTES AUTORIZADOS ──────────────────────────────────
  docentesAutorizados: {
    async listar() {
      const { data, error } = await sb.from('docentes_autorizados')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async crear({ nombre, email }) {
      // El código lo genera la función SQL generar_codigo_docente()
      const { data: codigo, error: errCod } = await sb.rpc('generar_codigo_docente');
      if (errCod) throw errCod;
      const { data, error } = await sb.from('docentes_autorizados')
        .insert({
          nombre,
          email: email || null,
          codigo_invitacion: codigo,
          created_by: Auth.user.id,
        })
        .select().single();
      if (error) throw error;
      return data; // incluye data.codigo_invitacion para mostrarlo al admin
    },
    async revocar(id) {
      const { error } = await sb.from('docentes_autorizados')
        .update({ usado: true })
        .eq('id', id);
      if (error) throw error;
    },
    async eliminar(id) {
      // Solo elimina si el código no ha sido usado
      const { error } = await sb.from('docentes_autorizados')
        .delete()
        .eq('id', id)
        .eq('usado', false);
      if (error) throw error;
    },
    async validarCodigo(codigo) {
      // Devuelve el registro si el código es válido y no ha sido usado
      const { data, error } = await sb.from('docentes_autorizados')
        .select('id, nombre, usado')
        .eq('codigo_invitacion', codigo.trim().toUpperCase())
        .single();
      if (error || !data) return null;
      if (data.usado) return null;
      return data;
    },
  },

  // ─── PERFIL ────────────────────────────────────────────────
  perfiles: {
    async listarDocentes() {
      const { data, error } = await sb.from('perfiles')
        .select('id, nombre, email').eq('rol', 'docente').order('nombre');
      if (error) throw error;
      return data || [];
    },
    async todos() {
      const { data, error } = await sb.from('perfiles')
        .select('*').order('nombre');
      if (error) throw error;
      return data || [];
    }
  }
};
