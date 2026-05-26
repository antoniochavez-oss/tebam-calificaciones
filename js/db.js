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
  },

  // ─── ACTIVIDADES ───────────────────────────────────────────
  actividades: {
    async listar(materiaId) {
      const { data, error } = await sb.from('actividades')
        .select('*').eq('materia_id', materiaId).order('orden');
      if (error) throw error;
      return data || [];
    },
    async crear({ materia_id, nombre, tipo, fecha, valor_max, orden, criterio_id }) {
      const row = { materia_id, nombre, tipo, fecha, valor_max, orden };
      if (criterio_id) row.criterio_id = criterio_id;
      const { data, error } = await sb.from('actividades')
        .insert(row).select().single();
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
        .select('*, alumno:alumnos(*, grupo:grupos(id, nombre, ciclo_id))')
        .eq('padre_id', padreId);
      if (error) throw error;
      const tutores = data || [];

      // Obtener ciclos por separado para evitar JOINs profundos con RLS
      const cicloIds = [...new Set(
        tutores.map(t => t.alumno?.grupo?.ciclo_id).filter(Boolean)
      )];
      if (cicloIds.length > 0) {
        const { data: ciclos } = await sb
          .from('ciclos').select('id, nombre').in('id', cicloIds);
        const mapaCiclo = Object.fromEntries((ciclos||[]).map(c => [c.id, c]));
        tutores.forEach(t => {
          if (t.alumno?.grupo?.ciclo_id) {
            t.alumno.grupo.ciclo = mapaCiclo[t.alumno.grupo.ciclo_id] || null;
          }
        });
      }
      return tutores;
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

  // ─── MENSAJERÍA ────────────────────────────────────────────
  mensajeria: {

    // Contador de no leídos para el badge del portal
    async noLeidos() {
      const { data, error } = await sb.rpc('contar_no_leidos', { p_id: Auth.user.id });
      if (error) return 0;
      return data || 0;
    },

    // Lista de conversaciones del usuario autenticado
    async listarConversaciones() {
      const { data, error } = await sb
        .from('conversacion_participantes')
        .select(`
          conversacion_id,
          ultimo_leido_at,
          conversacion:conversaciones (
            id, tipo, asunto, creador_id, grupo_id, created_at,
            grupo:grupos(nombre),
            creador:perfiles!conversaciones_creador_id_fkey(id, nombre, rol)
          )
        `)
        .eq('perfil_id', Auth.user.id)
        .order('conversacion_id');
      if (error) throw error;

      const convs = (data || []).map(r => r.conversacion).filter(Boolean);

      // Para conversaciones directas, obtener el nombre del OTRO participante
      const directas = convs.filter(c => c.tipo === 'directa');
      if (directas.length > 0) {
        const convIds = directas.map(c => c.id);

        // Obtener todos los participantes de esas conversaciones excepto yo
        const { data: otrosParticipantes } = await sb
          .from('conversacion_participantes')
          .select('conversacion_id, perfil:perfiles!conversacion_participantes_perfil_id_fkey(id, nombre, rol)')
          .in('conversacion_id', convIds)
          .neq('perfil_id', Auth.user.id);

        // Mapear por conversacion_id
        const mapaOtro = {};
        (otrosParticipantes || []).forEach(p => {
          if (p.perfil) mapaOtro[p.conversacion_id] = p.perfil;
        });

        // Inyectar el otro participante en cada conversación directa
        convs.forEach(c => {
          if (c.tipo === 'directa') {
            c.otro = mapaOtro[c.id] || null;
          }
        });
      }

      return convs;
    },

    // Mensajes de una conversación
    async listarMensajes(conversacionId) {
      const { data, error } = await sb
        .from('mensajes')
        .select('*, remitente:perfiles!mensajes_remitente_id_fkey(id, nombre, rol)')
        .eq('conversacion_id', conversacionId)
        .eq('eliminado', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },

    // Obtener o crear conversación directa (usa función SQL para evitar duplicados)
    async obtenerOCrearDirecta(receptorId, asunto = '') {
      const { data, error } = await sb.rpc('obtener_o_crear_directa', {
        p_receptor_id: receptorId,
        p_asunto:      asunto,
      });
      if (error) throw error;
      return data; // UUID de la conversación
    },

    // Crear broadcast del docente a un grupo (alumnos + padres)
    async crearBroadcast({ grupoId, asunto, cuerpo }) {
      // 1. Crear la conversación
      const { data: conv, error: errConv } = await sb
        .from('conversaciones')
        .insert({ tipo: 'broadcast', asunto, creador_id: Auth.user.id, grupo_id: grupoId })
        .select().single();
      if (errConv) throw errConv;

      // 2. Obtener alumnos activos del grupo
      const { data: alumnos } = await sb
        .from('alumnos')
        .select('id, perfil_id')
        .eq('grupo_id', grupoId)
        .eq('activo', true)
        .not('perfil_id', 'is', null);

      const alumnoIds    = (alumnos || []).map(a => a.perfil_id).filter(Boolean);
      const alumnoRegIds = (alumnos || []).map(a => a.id).filter(Boolean);

      // 3. Obtener padres vinculados a alumnos de ese grupo
      let padreIds = [];
      if (alumnoRegIds.length > 0) {
        const { data: tutores } = await sb
          .from('tutores')
          .select('padre_id')
          .in('alumno_id', alumnoRegIds);
        padreIds = [...new Set((tutores || []).map(t => t.padre_id).filter(Boolean))];
      }

      // 4. Unir: creador + alumnos + padres (sin duplicados)
      const todos = [
        Auth.user.id,
        ...alumnoIds,
        ...padreIds,
      ].filter((v, i, a) => a.indexOf(v) === i);

      // 5. Insertar participantes en lotes de 50
      for (let i = 0; i < todos.length; i += 50) {
        const lote = todos.slice(i, i + 50).map(pid => ({
          conversacion_id: conv.id,
          perfil_id: pid,
        }));
        await sb.from('conversacion_participantes').insert(lote);
      }

      // 6. Insertar el mensaje inicial
      await sb.from('mensajes').insert({
        conversacion_id: conv.id,
        remitente_id: Auth.user.id,
        cuerpo,
      });

      return conv.id;
    },

    // Enviar mensaje en conversación existente
    async enviar({ conversacionId, cuerpo }) {
      const { data, error } = await sb
        .from('mensajes')
        .insert({ conversacion_id: conversacionId, remitente_id: Auth.user.id, cuerpo })
        .select().single();
      if (error) throw error;
      return data;
    },

    // Marcar conversación como leída (actualiza ultimo_leido_at)
    async marcarLeida(conversacionId) {
      await sb
        .from('conversacion_participantes')
        .update({ ultimo_leido_at: new Date().toISOString() })
        .eq('conversacion_id', conversacionId)
        .eq('perfil_id', Auth.user.id);
    },

    // Listar usuarios con los que el usuario puede comunicarse
    // organizado por rol — para el selector de destinatarios
    async listarDestinatarios() {
      const perfil = Auth.perfil;
      const rol    = perfil?.rol;

      // Admin y docente pueden ver todos los roles relevantes
      if (rol === 'admin' || rol === 'docente') {
        // Obtener grupos del docente (o todos si es admin)
        let grupoIds = [];
        if (rol === 'docente') {
          const { data: gd } = await sb
            .from('grupo_docentes')
            .select('grupo_id')
            .eq('docente_id', Auth.user.id);
          grupoIds = (gd || []).map(g => g.grupo_id);
        }

        // Alumnos de sus grupos
        let qAlumnos = sb.from('alumnos')
          .select('perfil_id, nombre, grupo:grupos(nombre)')
          .eq('activo', true)
          .not('perfil_id', 'is', null);
        if (rol === 'docente' && grupoIds.length > 0)
          qAlumnos = qAlumnos.in('grupo_id', grupoIds);
        const { data: alumnos } = await qAlumnos;

        // perfil_ids de los alumnos — usados para buscar padres
        const alumnoIds = (alumnos || []).map(a => a.perfil_id).filter(Boolean);

        // Padres vinculados a alumnos de sus grupos
        // Primero obtenemos los IDs de registro de alumnos (no perfil_id)
        let padres = [];
        if (alumnoIds.length > 0) {
          const { data: alumnosReg } = await sb
            .from('alumnos')
            .select('id')
            .in('perfil_id', alumnoIds);
          const alumnoRegIds = (alumnosReg || []).map(a => a.id);
          if (alumnoRegIds.length > 0) {
            const { data: tut } = await sb
              .from('tutores')
              .select('padre_id, alumno:alumnos(nombre, grupo:grupos(nombre))')
              .in('alumno_id', alumnoRegIds);
            // Obtener nombres de los padres
            const padreIdsUniq = [...new Set((tut||[]).map(t => t.padre_id).filter(Boolean))];
            if (padreIdsUniq.length > 0) {
              const { data: padrePerfiles } = await sb
                .from('perfiles')
                .select('id, nombre')
                .in('id', padreIdsUniq);
              const mapaPadre = Object.fromEntries((padrePerfiles||[]).map(p => [p.id, p.nombre]));
              padres = (tut||[])
                .filter(t => t.padre_id && mapaPadre[t.padre_id])
                .map(t => ({
                  id:     t.padre_id,
                  nombre: mapaPadre[t.padre_id],
                  hijo:   t.alumno?.nombre,
                }));
              // Deduplicar por padre_id
              padres = padres.filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);
            }
          }
        }

        // Otros docentes y admin
        const { data: staff } = await sb
          .from('perfiles')
          .select('id, nombre, rol')
          .in('rol', ['docente', 'admin'])
          .neq('id', Auth.user.id);

        return {
          docentes: (staff || []).filter(p => p.rol === 'docente'),
          admins:   (staff || []).filter(p => p.rol === 'admin'),
          alumnos:  (alumnos || []).filter(a => a.perfil_id).map(a => ({
            id: a.perfil_id, nombre: a.nombre, grupo: a.grupo?.nombre
          })),
          padres,
        };
      }

      // Alumno y padre: solo docentes de su grupo y admin
      let grupoId = null;
      if (rol === 'alumno') {
        const { data: al } = await sb
          .from('alumnos').select('grupo_id').eq('perfil_id', Auth.user.id).single();
        grupoId = al?.grupo_id;
      } else if (rol === 'padre') {
        const { data: tut } = await sb
          .from('tutores')
          .select('alumno:alumnos(grupo_id)')
          .eq('padre_id', Auth.user.id)
          .limit(1).single();
        grupoId = tut?.alumno?.grupo_id;
      }

      const { data: docentes } = grupoId
        ? await sb.from('grupo_docentes')
            .select('docente:perfiles!grupo_docentes_docente_id_fkey(id, nombre)')
            .eq('grupo_id', grupoId)
        : { data: [] };

      const { data: admins } = await sb
        .from('perfiles').select('id, nombre').eq('rol', 'admin');

      return {
        docentes: (docentes || []).map(d => d.docente).filter(Boolean),
        admins:   admins || [],
        alumnos:  [],
        padres:   [],
      };
    },
  },

  // --- CRITERIOS DE EVALUACION ----------------------------------------------
  criterios: {
    async listar(materiaId) {
      const { data, error } = await sb
        .from('criterios_evaluacion')
        .select('*')
        .eq('materia_id', materiaId)
        .order('orden');
      if (error) throw error;
      return data || [];
    },
    async crear({ materia_id, nombre, porcentaje, orden }) {
      const { data, error } = await sb
        .from('criterios_evaluacion')
        .insert({ materia_id, nombre, porcentaje, orden })
        .select().single();
      if (error) throw error;
      return data;
    },
    async actualizar(id, { nombre, porcentaje, orden }) {
      const { data, error } = await sb
        .from('criterios_evaluacion')
        .update({ nombre, porcentaje, orden })
        .eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb
        .from('criterios_evaluacion').delete().eq('id', id);
      if (error) throw error;
    },
    // Verifica si los criterios de una materia suman exactamente 100%
    sumaPorcentajes(criterios) {
      return criterios.reduce((s, c) => s + Number(c.porcentaje), 0);
    },
    // Calcula promedio ponderado dado criterios, actividades y calificaciones
    // califs = { [actividad_id]: valor }
    // actividades = [{ id, criterio_id, ... }]
    calcPonderado(criterios, actividades, califs) {
      if (!criterios.length) return null;
      const suma = criterios.reduce((s, c) => s + Number(c.porcentaje), 0);
      if (Math.abs(suma - 100) > 0.01) return null; // no suman 100%

      let total = 0;
      let pesoCubierto = 0;

      for (const criterio of criterios) {
        const actsDelCriterio = actividades.filter(a => a.criterio_id === criterio.id);
        if (!actsDelCriterio.length) continue;

        const vals = actsDelCriterio
          .map(a => califs[a.id])
          .filter(v => v !== undefined && v !== null)
          .map(Number);

        if (!vals.length) continue;

        const promCriterio = vals.reduce((s, v) => s + v, 0) / vals.length;
        total += promCriterio * (Number(criterio.porcentaje) / 100);
        pesoCubierto += Number(criterio.porcentaje);
      }

      if (pesoCubierto === 0) return null;
      // Si no todos los criterios tienen calificaciones, normalizar
      if (pesoCubierto < 100) {
        total = (total / pesoCubierto) * 100;
      }
      return Math.round(total * 100) / 100;
    },
  },

  // --- TUTORIAS -------------------------------------------------------------
  tutorias: {
    async listar(filtro = {}) {
      let q = sb.from('tutorias')
        .select('*, alumno:alumnos(nombre, grupo:grupos(nombre)), coordinador:perfiles!tutorias_coordinador_id_fkey(nombre)')
        .order('fecha', { ascending: false });
      if (filtro.alumno_id)     q = q.eq('alumno_id', filtro.alumno_id);
      if (filtro.estado)        q = q.eq('estado', filtro.estado);
      if (filtro.coordinador_id) q = q.eq('coordinador_id', filtro.coordinador_id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async listarDePadre(padreId) {
      // Obtener IDs de alumnos del padre
      const { data: tuts } = await sb.from('tutores').select('alumno_id').eq('padre_id', padreId);
      const ids = (tuts||[]).map(t => t.alumno_id);
      if (!ids.length) return [];
      const { data, error } = await sb.from('tutorias')
        .select('*, alumno:alumnos(nombre), coordinador:perfiles!tutorias_coordinador_id_fkey(nombre)')
        .in('alumno_id', ids)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async crear({ alumno_id, fecha, hora, motivo }) {
      const { data, error } = await sb.from('tutorias')
        .insert({ alumno_id, coordinador_id: Auth.user.id, fecha, hora, motivo })
        .select().single();
      if (error) throw error;
      return data;
    },
    async actualizarEstado(id, estado) {
      const { data, error } = await sb.from('tutorias')
        .update({ estado }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async registrarResultado(id, { acuerdos, observaciones, seguimiento_fecha }) {
      const { data, error } = await sb.from('tutorias')
        .update({ acuerdos, observaciones, seguimiento_fecha, estado: 'realizada' })
        .eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('tutorias').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // --- DISCIPLINA -----------------------------------------------------------
  disciplina: {
    async listarTipos() {
      const { data, error } = await sb.from('tipos_falta')
        .select('*').eq('activo', true).order('gravedad').order('nombre');
      if (error) throw error;
      return data || [];
    },
    async crearTipo({ nombre, descripcion, gravedad }) {
      const { data, error } = await sb.from('tipos_falta')
        .insert({ nombre, descripcion, gravedad, created_by: Auth.user.id })
        .select().single();
      if (error) throw error;
      return data;
    },
    async actualizarTipo(id, { nombre, descripcion, gravedad, activo }) {
      const { data, error } = await sb.from('tipos_falta')
        .update({ nombre, descripcion, gravedad, activo }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async listarFaltas(filtro = {}) {
      let q = sb.from('faltas_disciplina')
        .select('*, alumno:alumnos(nombre, grupo:grupos(nombre)), docente:perfiles!faltas_disciplina_docente_id_fkey(nombre), tipo:tipos_falta(nombre, gravedad)')
        .order('fecha_hora', { ascending: false });
      if (filtro.alumno_id)  q = q.eq('alumno_id', filtro.alumno_id);
      if (filtro.docente_id) q = q.eq('docente_id', filtro.docente_id);
      if (filtro.resuelta !== undefined) q = q.eq('resuelta', filtro.resuelta);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async listarDePadre(padreId) {
      const { data: tuts } = await sb.from('tutores').select('alumno_id').eq('padre_id', padreId);
      const ids = (tuts||[]).map(t => t.alumno_id);
      if (!ids.length) return [];
      const { data, error } = await sb.from('faltas_disciplina')
        .select('*, tipo:tipos_falta(nombre, gravedad), alumno:alumnos(nombre)')
        .in('alumno_id', ids)
        .order('fecha_hora', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async registrarFalta({ alumno_id, tipo_falta_id, descripcion }) {
      const { data, error } = await sb.from('faltas_disciplina')
        .insert({ alumno_id, docente_id: Auth.user.id, tipo_falta_id, descripcion })
        .select().single();
      if (error) throw error;
      return data;
    },
    async marcarResuelta(id, resuelta = true) {
      const { data, error } = await sb.from('faltas_disciplina')
        .update({ resuelta }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async eliminarFalta(id) {
      const { error } = await sb.from('faltas_disciplina').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // --- SESIONES (Diario de clase) -------------------------------------------
  sesiones: {
    async listar(materiaId) {
      const { data, error } = await sb
        .from('sesiones')
        .select('*, docente:perfiles!sesiones_docente_id_fkey(nombre)')
        .eq('materia_id', materiaId)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    async crear({ materia_id, fecha, tema, contenido, observaciones }) {
      const { data, error } = await sb
        .from('sesiones')
        .insert({ materia_id, docente_id: Auth.user.id, fecha, tema, contenido, observaciones })
        .select().single();
      if (error) throw error;
      return data;
    },
    async actualizar(id, { fecha, tema, contenido, observaciones }) {
      const { data, error } = await sb
        .from('sesiones')
        .update({ fecha, tema, contenido, observaciones })
        .eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async eliminar(id) {
      const { error } = await sb.from('sesiones').delete().eq('id', id);
      if (error) throw error;
    },
  },

  // --- PERFIL ----------------------------------------------------------------
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
