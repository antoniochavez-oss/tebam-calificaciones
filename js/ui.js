// ─── ui.js ─── helpers de UI reutilizables ───────────────────

const UI = window.UI = {

  // ─── Toast ─────────────────────────────────────────────────
  _toastTimer: null,
  toast(msg, tipo = 'ok') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast show ${tipo}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  },

  // ─── Modales ───────────────────────────────────────────────
  openModal(id)  { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); },
  initModals() {
    document.querySelectorAll('.overlay').forEach(o =>
      o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
    );
  },

  // ─── Vistas ────────────────────────────────────────────────
  showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  },

  // ─── Breadcrumb ────────────────────────────────────────────
  setBreadcrumb(items) {
    const el = document.getElementById('crumb');
    if (!el) return;
    el.innerHTML = items.map((item, i) => {
      const isLast = i === items.length - 1;
      const sep = i > 0 ? '<span class="crumb-sep">›</span>' : '';
      if (isLast) return `${sep}<span class="crumb-cur">${UI.esc(item.label)}</span>`;
      return `${sep}<span class="crumb-item" onclick="${item.action}">${UI.esc(item.label)}</span>`;
    }).join('');
  },

  // ─── Topbar actions ────────────────────────────────────────
  setTopbar(btns) {
    const el = document.getElementById('topbarR');
    if (!el) return;
    el.innerHTML = btns.map(b =>
      `<button class="btn btn-y" onclick="${b.action}">${UI.esc(b.label)}</button>`
    ).join('');
  },

  // ─── Nav items ─────────────────────────────────────────────
  setNavActive(id) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  },

  // ─── Loader ────────────────────────────────────────────────
  showLoader(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'flex' : 'none';
  },

  // ─── Escape HTML ───────────────────────────────────────────
  esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

  // ─── Promedio ──────────────────────────────────────────────
  calcAvg(califs, actividades) {
    const vals = actividades
      .map(a => califs[a.id]?.valor)
      .filter(v => v !== undefined && v !== null && v !== '');
    if (!vals.length) return null;
    return vals.reduce((s, v) => s + Number(v), 0) / vals.length;
  },

  // ─── Badge de promedio ─────────────────────────────────────
  avgClass(avg) {
    if (avg === null) return '';
    return avg >= 8 ? 'avg-hi' : avg >= 6 ? 'avg-md' : 'avg-lo';
  },

  // ─── Ícono de actividad ────────────────────────────────────
  tipoIcon(t) {
    return { tarea:'📝', examen:'📖', participacion:'🗣️', proyecto:'🔬', rubrica:'📊' }[t] ?? '📄';
  },

  // ─── CSV parser ────────────────────────────────────────────
  parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return { headers: [], rows: [] };
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
      return obj;
    }).filter(r => Object.values(r).some(v => v));
    return { headers, rows };
  },

  // ─── Descargar plantilla CSV ───────────────────────────────
  descargarPlantillaCSV() {
    const content = 'numero_lista,nombre\n1,García López Juan\n2,Martínez Torres Ana\n3,Hernández Reyes Pedro';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plantilla_alumnos_TEBAM.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  },

  // ─── Realtime helper ───────────────────────────────────────
  subscribeToTable(table, filter, callback) {
    return sb.channel(`rt:${table}:${filter}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table, filter
      }, callback)
      .subscribe();
  }
};
