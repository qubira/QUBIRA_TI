/* Agenda para elegir fecha y hora de una reunión (mismo diseño que el
   "Plazo del proyecto y agenda de OTI" de Comercial): calendario del mes
   con la disponibilidad del equipo del área, horas del día con quién está
   libre u ocupado (en vivo) y casillas para sumar participantes.
   Formas de agendar: reunión única, revisiones paulatinas (serie periódica),
   auditoría por fases (apertura → revisiones → cierre) o fechas a mano.
   Escribe la fecha y el horario en los campos date / start_time / end_time
   del formulario; las demás sesiones de una serie se leen con
   obtenerOcurrencias(). */
import { api } from '../api.js';

const HORARIO_NORMAL = [8, 18];
const HORARIO_EXTENDIDO = [7, 21];
const REFRESCO_MS = 20000;
const MAX_SESIONES = 26;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DURACIONES = [[30, '30 min'], [45, '45 min'], [60, '1 h'], [90, '1 h 30'], [120, '2 h']];
export const FORMAS = {
  unica: { icono: '📌', nombre: 'Reunión única', ayuda: 'Una sola reunión en el día y la hora que elijas.' },
  revision: { icono: '🔁', nombre: 'Revisiones paulatinas', ayuda: 'Serie de revisiones del proyecto con la frecuencia que elijas. Elige el día de la primera revisión.' },
  auditoria: { icono: '🧾', nombre: 'Auditoría por fases', ayuda: 'Apertura, revisiones intermedias y cierre. Elige el día de la apertura.' },
  manual: { icono: '✋', nombre: 'Fechas a mano', ayuda: 'Haz clic en cada día de la serie; vuelve a hacer clic para quitarlo.' },
};
const FRECUENCIAS = [['diaria', 'Cada día hábil'], ['semanal', 'Semanal'], ['quincenal', 'Cada 2 semanas'], ['mensual', 'Mensual']];

const pad2 = n => String(n).padStart(2, '0');
const isoDia = (a, m, d) => `${a}-${pad2(m + 1)}-${pad2(d)}`;
const isoDe = d => isoDia(d.getFullYear(), d.getMonth(), d.getDate());
const hoyIso = () => isoDe(new Date());
const fechaDeIso = f => { const [a, m, d] = f.split('-').map(Number); return new Date(a, m - 1, d); };
const aMin = t => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + (m || 0); };
const deMin = n => `${pad2(Math.floor(n / 60))}:${pad2(n % 60)}`;
const fmtCorta = f => fechaDeIso(f).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const nombre = p => [p.nombre, p.apellidos].filter(Boolean).join(' ');
const esFinde = f => { const w = fechaDeIso(f).getDay(); return w === 0 || w === 6; };
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const st = {
  area: 'TI', areaLabel: 'OTI', anio: 0, mes: 0, fecha: '', inicio: '', fin: '', vista: '',
  excluir: null, fechaOriginal: '', permitirSerie: true, extendido: false,
  forma: 'unica', frecuencia: 'semanal', sesiones: 4, saltarFindes: true, manuales: [], quitadas: new Set(),
  verif: {}, verifToken: 0, datos: null, error: null, actualizado: null, timer: null, pidiendo: 0,
  buscando: false, aviso: '', cont: null, opciones: null,
};

/* Inicia la agenda al abrir el formulario. Se puede volver a montar
   (re-render del formulario) y conserva lo elegido. */
export function iniciarAgenda({ area, areaLabel, fecha, inicio, fin, excluirReunion, permitirSerie = true }) {
  Object.assign(st, {
    area, areaLabel, fecha: fecha || '', inicio: inicio || '', fin: fin || '', vista: fecha || '',
    excluir: excluirReunion || null, fechaOriginal: fecha || '', permitirSerie,
    forma: 'unica', frecuencia: 'semanal', sesiones: 4, saltarFindes: true, manuales: [], quitadas: new Set(),
    verif: {}, datos: null, error: null, aviso: '',
  });
  const base = st.fecha ? fechaDeIso(st.fecha) : new Date();
  st.anio = base.getFullYear(); st.mes = base.getMonth();
}

/* opciones:
   - seleccionados(): ids de participantes internos ya elegidos
   - alCambiarHorario({date, start_time, end_time})
   - alMarcarPersona(miembro, agregar)
   - alCambiarForma(forma)
   - verificar(date, start, end) → Promise<conflicts[]> (para cada sesión de una serie) */
export function montarAgenda(cont, opciones) {
  st.cont = cont; st.opciones = opciones;
  estilos();
  pintar();
  if (!st.datos) cargar();
  clearInterval(st.timer);
  st.timer = setInterval(() => {
    if (!document.body.contains(st.cont)) { clearInterval(st.timer); st.timer = null; return; }
    cargar();
  }, REFRESCO_MS);
}

export function repintarAgenda() {
  if (st.cont && document.body.contains(st.cont)) { pintar(); verificarSerie(); }
}

export function formaActual() { return st.forma; }

/* Sesiones a crear: [{date, start_time, end_time, etiqueta, indice, total}] */
export function obtenerOcurrencias() {
  const fechas = fechasSerie();
  return fechas.map((f, i) => ({
    date: f, start_time: st.inicio, end_time: st.fin, indice: i + 1, total: fechas.length,
    etiqueta: etiquetaLarga(i, fechas.length),
  }));
}

// ── Serie ──
function fechasGeneradas() {
  if (!st.fecha) return [];
  const n = Math.max(1, Math.min(MAX_SESIONES, Number(st.sesiones) || 1));
  const res = [];
  let d = fechaDeIso(st.fecha);
  const base = fechaDeIso(st.fecha);
  for (let i = 0; res.length < n && i < 400; i++) {
    let f;
    if (st.frecuencia === 'mensual') {
      f = new Date(base.getFullYear(), base.getMonth() + res.length, Math.min(base.getDate(), new Date(base.getFullYear(), base.getMonth() + res.length + 1, 0).getDate()));
    } else if (st.frecuencia === 'diaria') {
      f = new Date(d); d.setDate(d.getDate() + 1);
      if (esFinde(isoDe(f))) continue;
    } else {
      const paso = st.frecuencia === 'quincenal' ? 14 : 7;
      f = new Date(base); f.setDate(base.getDate() + paso * res.length);
    }
    let iso = isoDe(f);
    // Si cae en fin de semana, pasa al lunes siguiente
    if (st.saltarFindes) while (esFinde(iso)) { f.setDate(f.getDate() + 1); iso = isoDe(f); }
    if (!res.includes(iso)) res.push(iso);
  }
  return res;
}
function fechasSerie() {
  if (st.forma === 'unica') return st.fecha ? [st.fecha] : [];
  if (st.forma === 'manual') return st.manuales.slice().sort();
  return fechasGeneradas().filter(f => !st.quitadas.has(f));
}
function etiquetaCorta(i, total) {
  if (st.forma === 'auditoria') return i === 0 ? 'APERTURA' : i === total - 1 ? 'CIERRE' : `R${i}`;
  if (st.forma === 'revision') return `R${i + 1}`;
  if (st.forma === 'manual') return `S${i + 1}`;
  return 'REUNIÓN';
}
function etiquetaLarga(i, total) {
  if (st.forma === 'auditoria') return i === 0 ? 'Apertura de auditoría' : i === total - 1 ? 'Cierre de auditoría' : `Revisión de auditoría ${i} de ${total - 2}`;
  if (st.forma === 'revision') return `Revisión ${i + 1} de ${total}`;
  if (st.forma === 'manual') return `Sesión ${i + 1} de ${total}`;
  return '';
}

// Disponibilidad de los participantes elegidos en cada sesión de la serie
let _verifTimer = null;
function verificarSerie() {
  clearTimeout(_verifTimer);
  if (st.forma === 'unica' || !st.opciones?.verificar) return;
  _verifTimer = setTimeout(async () => {
    const ocs = obtenerOcurrencias();
    const token = ++st.verifToken;
    if (!st.inicio || !st.fin || st.fin <= st.inicio || !(st.opciones.seleccionados?.() || []).length) {
      st.verif = {}; pintarSerie(); return;
    }
    ocs.forEach(o => { st.verif[o.date] = { estado: 'cargando' }; });
    pintarSerie();
    await Promise.all(ocs.map(async o => {
      try {
        const c = await st.opciones.verificar(o.date, o.start_time, o.end_time);
        if (token !== st.verifToken) return;
        st.verif[o.date] = { estado: c.some(x => x.hard) ? 'conflicto' : c.length ? 'aviso' : 'ok', conflictos: c };
      } catch { if (token === st.verifToken) st.verif[o.date] = { estado: 'error' }; }
    }));
    if (token === st.verifToken) pintarSerie();
  }, 350);
}
export function conflictosDeSerie() {
  return obtenerOcurrencias().filter(o => st.verif[o.date]?.estado === 'conflicto').map(o => ({ ...o, conflictos: st.verif[o.date].conflictos }));
}

async function cargar() {
  const pedido = ++st.pidiendo;
  const ultimo = new Date(st.anio, st.mes + 1, 0).getDate();
  try {
    const datos = await api.get('/calendar/team-availability', { area: st.area, from: isoDia(st.anio, st.mes, 1), to: isoDia(st.anio, st.mes, ultimo) });
    if (pedido !== st.pidiendo) return;
    st.datos = datos; st.error = null; st.actualizado = new Date();
  } catch (e) {
    if (pedido !== st.pidiendo) return;
    st.error = e.message || `No se pudo consultar la agenda de ${st.areaLabel}`;
  }
  if (st.cont && document.body.contains(st.cont)) pintar();
}

const ocupaciones = datos => ((datos || st.datos)?.busy || []).filter(b => !st.excluir || b.meeting_id !== st.excluir);
function ocupadosEn(fecha, ini, fin, datos) {
  const res = new Map();
  ocupaciones(datos).forEach(b => {
    if (b.date === fecha && b.start_time < fin && b.end_time > ini) {
      if (!res.has(b.user_id)) res.set(b.user_id, []);
      res.get(b.user_id).push(b);
    }
  });
  return res;
}
function horario() { return st.extendido ? HORARIO_EXTENDIDO : HORARIO_NORMAL; }
function estadoDia(fecha) {
  const n = (st.datos?.members || []).length;
  if (!n) return '';
  const [hi, hf] = HORARIO_NORMAL;
  let libres = 0, sinNadie = 0, total = 0;
  for (let h = hi; h < hf; h++) {
    const ocu = ocupadosEn(fecha, `${pad2(h)}:00`, `${pad2(h + 1)}:00`).size;
    total++;
    if (ocu === 0) libres++;
    if (ocu >= n) sinNadie++;
  }
  return libres === total ? 'libre' : sinNadie === total ? 'ocupado' : 'parcial';
}
function duracion() { return st.inicio && st.fin && st.fin > st.inicio ? aMin(st.fin) - aMin(st.inicio) : 60; }

function avisar() {
  const primera = fechasSerie()[0] || st.fecha;
  st.opciones?.alCambiarHorario?.({ date: primera || '', start_time: st.inicio, end_time: st.fin });
  verificarSerie();
}

// ── Pintado ──
function pintar() {
  const c = st.cont;
  if (!c) return;
  const miembros = st.datos?.members || [];
  const hoy = hoyIso();
  const h = new Date();
  const serie = fechasSerie();
  const minimo = st.fechaOriginal && st.fechaOriginal < hoy ? fechaDeIso(st.fechaOriginal) : h;
  const enMinimo = st.anio === minimo.getFullYear() && st.mes === minimo.getMonth();

  // Calendario del mes
  const primerDow = (new Date(st.anio, st.mes, 1).getDay() + 6) % 7;
  const diasMes = new Date(st.anio, st.mes + 1, 0).getDate();
  let celdas = '';
  for (let i = 0; i < primerDow; i++) celdas += '<span class="agr-dia fuera"></span>';
  for (let d = 1; d <= diasMes; d++) {
    const f = isoDia(st.anio, st.mes, d);
    const pasado = f < hoy && f !== st.fechaOriginal;
    const est = !pasado && st.datos ? estadoDia(f) : '';
    const idx = serie.indexOf(f);
    const marca = idx >= 0 ? etiquetaCorta(idx, serie.length) : '';
    const quitada = st.forma !== 'unica' && st.forma !== 'manual' && st.quitadas.has(f);
    const tit = pasado ? 'Fecha pasada' : marca ? (etiquetaLarga(idx, serie.length) || 'Reunión') : est === 'libre' ? `${st.areaLabel} libre todo el día` : est === 'parcial' ? `${st.areaLabel} con reuniones: revisa las horas` : est === 'ocupado' ? `Todo ${st.areaLabel} ocupado` : '';
    celdas += `<button type="button" class="agr-dia ${est} ${esFinde(f) ? 'finde' : ''} ${f === hoy ? 'hoy' : ''} ${idx >= 0 ? 'sel' : ''} ${idx > 0 ? 'serie' : ''} ${f === st.vista ? 'vista' : ''} ${quitada ? 'quitada' : ''}" data-dia="${f}" ${pasado ? 'disabled' : ''} title="${esc(tit)}">${d}<span class="barra"></span>${marca ? `<span class="agr-marca">${marca}</span>` : ''}</button>`;
  }
  const anios = [];
  for (let a = minimo.getFullYear(); a <= h.getFullYear() + 2; a++) anios.push(a);

  // Horas del día en foco
  const vista = st.vista || st.fecha;
  const [hi, hf] = horario();
  let panel;
  if (st.error && !st.datos) {
    panel = `<div class="agr-vacio">⚠️ ${esc(st.error)}<br><br><button type="button" class="agr-btn" data-accion="recargar">Reintentar</button><br><br>Puedes elegir la fecha y la hora igualmente.</div>`;
  } else if (!vista) {
    panel = `<div class="agr-vacio">Elige un día en el calendario para ver las horas libres de ${esc(st.areaLabel)}.${miembros.length ? `<br><small>Equipo ${esc(st.areaLabel)}: ${miembros.map(m => esc(nombre(m))).join(', ')}</small>` : ''}</div>`;
  } else {
    const iniSel = st.inicio ? aMin(st.inicio) : null, finSel = st.fin ? aMin(st.fin) : null;
    let filas = '';
    const verMes = vista.startsWith(`${st.anio}-${pad2(st.mes + 1)}`);
    if (!st.datos) filas = `<div class="agr-vacio">Consultando la agenda de ${esc(st.areaLabel)}…</div>`;
    else if (!verMes) filas = `<div class="agr-vacio">El día ${fmtCorta(vista)} está en otro mes. <button type="button" class="agr-link" data-ver="${vista}">Ir a ese mes</button></div>`;
    else if (!miembros.length) filas = `<div class="agr-vacio">No hay integrantes activos del área ${esc(st.areaLabel)} registrados en RR. HH.; elige la hora igualmente.</div>`;
    for (let hr = hi; st.datos && verMes && miembros.length && hr < hf; hr++) {
      const ocu = ocupadosEn(vista, `${pad2(hr)}:00`, `${pad2(hr + 1)}:00`);
      const libres = miembros.length - ocu.size;
      const puntos = miembros.map(m => `<span class="agr-punto ${ocu.has(m.user_id) ? 'ocu' : ''}" title="${esc(nombre(m))}: ${ocu.has(m.user_id) ? 'ocupado' : 'libre'}"></span>`).join('');
      const pasada = vista === hoy && hr <= h.getHours();
      const enRango = iniSel !== null && finSel !== null && hr * 60 < finSel && (hr + 1) * 60 > iniSel;
      filas += `<button type="button" class="agr-hora ${libres === 0 ? 'nadie' : ''} ${enRango ? 'sel' : ''}" data-hora="${hr}" ${pasada ? 'disabled' : ''}>
        <strong>${pad2(hr)}:00 – ${pad2(hr + 1)}:00</strong><span class="agr-puntos">${puntos}</span>
        <span class="agr-cuenta">${libres === miembros.length ? 'Todos libres' : libres === 0 ? 'Nadie libre' : `${libres} de ${miembros.length} libres`}</span></button>`;
    }
    let detalle = '';
    if (st.inicio && st.fin && st.fin > st.inicio && miembros.length && st.datos && verMes) {
      const ocu = ocupadosEn(vista, st.inicio, st.fin);
      const libres = miembros.filter(m => !ocu.has(m.user_id));
      const ocupados = miembros.filter(m => ocu.has(m.user_id));
      const elegidos = new Set((st.opciones?.seleccionados?.() || []).map(String));
      const faltan = libres.filter(m => !elegidos.has(String(m.user_id))).length;
      detalle = `<div class="agr-detalle">
        <div><h4>✅ Disponibles de ${esc(st.areaLabel)} (${libres.length})${faltan ? ` <button type="button" class="agr-link" data-accion="todos">Agregar todos</button>` : ''}</h4>
          ${libres.length ? libres.map(m => `<label class="agr-persona libre ${elegidos.has(String(m.user_id)) ? '' : 'fuera'}"><input type="checkbox" data-persona="${m.user_id}" ${elegidos.has(String(m.user_id)) ? 'checked' : ''}><span>${esc(nombre(m))}${m.cargo ? `<small>${esc(m.cargo)}</small>` : ''}</span></label>`).join('') : `<div class="agr-vacio">Nadie de ${esc(st.areaLabel)} está libre en ese horario.</div>`}</div>
        <div><h4>⛔ Ocupados (${ocupados.length})</h4>
          ${ocupados.length ? ocupados.map(m => `<div class="agr-persona ocu">${esc(nombre(m))}${ocu.get(m.user_id).map(b => `<small>${esc(b.title)} · ${b.start_time}–${b.end_time} · ${esc(b.area || '')} · ${esc(b.modality || '')}</small>`).join('')}</div>`).join('') : '<div class="agr-vacio">Nadie ocupado: horario ideal.</div>'}</div>
      </div>`;
    }
    const idxV = serie.indexOf(vista);
    panel = `<div class="agr-paso">${idxV >= 0 && st.forma !== 'unica' ? esc(etiquetaLarga(idxV, serie.length)) + ' · ' : ''}Horas del ${fechaDeIso(vista).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}${st.forma !== 'unica' ? ' · la hora se aplica a todas las sesiones' : ''}
        <label class="agr-ext"><input type="checkbox" data-accion="extendido" ${st.extendido ? 'checked' : ''}> ${HORARIO_EXTENDIDO[0]}:00–${HORARIO_EXTENDIDO[1]}:00</label></div>
      <div class="agr-horas">${filas}</div>
      <div class="agr-tiempos">
        <label>Inicio *<input type="time" name="start_time" class="input text-sm" required value="${esc(st.inicio)}"></label>
        <label>Fin *<input type="time" name="end_time" class="input text-sm" required value="${esc(st.fin)}"></label>
        <div class="agr-durs">${DURACIONES.map(([m, t]) => `<button type="button" class="agr-chip ${st.inicio && duracion() === m && st.fin ? 'activo' : ''}" data-dur="${m}" ${st.inicio ? '' : 'disabled'}>${t}</button>`).join('')}</div>
      </div>${detalle}`;
  }

  const vivo = st.error ? `<span class="agr-vivo error" title="${esc(st.error)}">Sin conexión con la agenda</span>`
    : `<span class="agr-vivo">En vivo${st.actualizado ? ' · ' + st.actualizado.toLocaleTimeString('es-PE') : ''}</span>`;
  const resumen = !serie.length ? 'Sin fecha elegida'
    : st.forma === 'unica' ? `📅 ${fechaDeIso(serie[0]).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}${st.inicio ? ` · ${st.inicio}${st.fin ? '–' + st.fin : ''}` : ' · sin hora'}`
    : `${FORMAS[st.forma].icono} ${serie.length} ${serie.length === 1 ? 'sesión' : 'sesiones'} · del ${fmtCorta(serie[0])} al ${fmtCorta(serie[serie.length - 1])}${st.inicio ? ` · ${st.inicio}${st.fin ? '–' + st.fin : ''}` : ' · sin hora'}`;

  const formas = st.permitirSerie ? `<div class="agr-formas">${Object.entries(FORMAS).map(([k, f]) => `<button type="button" class="agr-forma ${st.forma === k ? 'activo' : ''}" data-forma="${k}" title="${esc(f.ayuda)}">${f.icono} ${f.nombre}</button>`).join('')}</div>
    <div class="agr-ayuda">${esc(FORMAS[st.forma].ayuda)}</div>
    ${st.forma === 'revision' || st.forma === 'auditoria' ? `<div class="agr-config">
      <label>Frecuencia<select data-cfg="frecuencia">${FRECUENCIAS.map(([v, t]) => `<option value="${v}" ${st.frecuencia === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>${st.forma === 'auditoria' ? 'Sesiones (con apertura y cierre)' : 'N.° de revisiones'}<input type="number" data-cfg="sesiones" min="${st.forma === 'auditoria' ? 2 : 1}" max="${MAX_SESIONES}" value="${st.sesiones}"></label>
      <label class="agr-check"><input type="checkbox" data-cfg="saltarFindes" ${st.saltarFindes ? 'checked' : ''}> Pasar fines de semana al lunes</label>
    </div>` : ''}` : `<div class="agr-ayuda">Editando una sesión: cambia su día u horario aquí.</div>`;

  const scrollPrevio = c.querySelector('.agr-horas')?.scrollTop;
  c.innerHTML = `<div class="agr">
    <input type="hidden" name="date" value="${esc(serie[0] || st.fecha)}">
    <div class="agr-cab"><div><b>📅 Fecha y hora</b><small>Agenda de ${esc(st.areaLabel)} en vivo: elige el día y la hora sin cruces</small></div>
      <div class="agr-cab-der">${vivo}<button type="button" class="agr-btn icono" data-accion="recargar" title="Actualizar ahora">↻</button></div></div>
    ${formas}
    <div class="agr-resumen ${serie.length && st.inicio ? 'ok' : ''}"><span>${resumen}</span>
      <button type="button" class="agr-btn" data-accion="hueco" ${st.buscando ? 'disabled' : ''} title="Busca el próximo horario en que los participantes del equipo están libres">${st.buscando ? 'Buscando…' : '⚡ Próximo horario libre'}</button></div>
    ${st.aviso ? `<div class="agr-aviso">${esc(st.aviso)}</div>` : ''}
    <div class="agr-nav">
      <button type="button" class="agr-btn icono" data-mes="-1" ${enMinimo ? 'disabled' : ''} title="Mes anterior">‹</button>
      <div class="agr-nav-sel">
        <select data-ir="mes" aria-label="Mes">${MESES.map((n, i) => `<option value="${i}" ${i === st.mes ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select data-ir="anio" aria-label="Año">${anios.map(a => `<option value="${a}" ${a === st.anio ? 'selected' : ''}>${a}</option>`).join('')}</select>
      </div>
      <button type="button" class="agr-btn icono" data-mes="1" title="Mes siguiente">›</button>
    </div>
    <div class="agr-mes">${['L','M','M','J','V','S','D'].map(x => `<div class="agr-dow">${x}</div>`).join('')}${celdas}</div>
    <div class="agr-leyenda"><span><i style="background:#2563eb"></i>${st.forma === 'unica' ? 'Reunión' : 'Sesión'}</span><span><i style="background:#10b981"></i>${esc(st.areaLabel)} libre</span><span><i style="background:#f59e0b"></i>Con reuniones</span><span><i style="background:#ef4444"></i>${esc(st.areaLabel)} ocupado</span></div>
    <div id="agr-serie"></div>
    <div class="agr-panel">${panel}</div>${panel.includes('name="start_time"') ? '' : `<input type="hidden" name="start_time" value="${esc(st.inicio)}"><input type="hidden" name="end_time" value="${esc(st.fin)}">`}
  </div>`;
  const lista = c.querySelector('.agr-horas');
  if (lista) {
    const sel = lista.querySelector('.agr-hora.sel');
    if (scrollPrevio !== undefined) lista.scrollTop = scrollPrevio;
    else if (sel) lista.scrollTop = Math.max(0, sel.offsetTop - lista.offsetTop - 40);
  }
  pintarSerie();
  conectar(c);
}

// Lista de sesiones de la serie con su disponibilidad
function pintarSerie() {
  const box = st.cont?.querySelector('#agr-serie');
  if (!box) return;
  if (st.forma === 'unica') { box.innerHTML = ''; return; }
  const ocs = obtenerOcurrencias();
  const quitadas = st.forma !== 'manual' ? fechasGeneradas().filter(f => st.quitadas.has(f)) : [];
  if (!ocs.length) { box.innerHTML = `<div class="agr-serie-vacia">${st.forma === 'manual' ? 'Haz clic en los días de la serie.' : 'Elige en el calendario el día de la primera sesión.'}</div>`; return; }
  const hayPart = (st.opciones?.seleccionados?.() || []).length;
  const estado = o => {
    const v = st.verif[o.date];
    if (!st.inicio || !st.fin) return '<span class="agr-est gris">sin hora</span>';
    if (!hayPart) return '<span class="agr-est gris">agrega participantes</span>';
    if (!v || v.estado === 'cargando') return '<span class="agr-est gris">verificando…</span>';
    if (v.estado === 'ok') return '<span class="agr-est ok">✓ libre</span>';
    if (v.estado === 'aviso') return `<span class="agr-est aviso" title="${esc(v.conflictos.map(x => `${x.user_name}: ${x.meeting_name}`).join('\n'))}">⚠ cruce mixto</span>`;
    if (v.estado === 'conflicto') return `<span class="agr-est mal" title="${esc(v.conflictos.filter(x => x.hard).map(x => `${x.user_name}: ${x.meeting_name} ${x.start_time.slice(0, 5)}–${x.end_time.slice(0, 5)}`).join('\n'))}">⛔ ${v.conflictos.filter(x => x.hard).map(x => esc(x.user_name || 'Alguien')).join(', ')} ocupado</span>`;
    return '<span class="agr-est gris">sin verificar</span>';
  };
  const malas = ocs.filter(o => st.verif[o.date]?.estado === 'conflicto').length;
  box.innerHTML = `<div class="agr-serie">
    <div class="agr-serie-cab"><b>${ocs.length} ${ocs.length === 1 ? 'sesión' : 'sesiones'}</b>${malas ? `<span class="agr-est mal">${malas} con cruces: quítalas o cambia la hora</span>` : ''}</div>
    ${ocs.map(o => `<div class="agr-ses ${o.date === (st.vista || st.fecha) ? 'vista' : ''}">
      <button type="button" class="agr-ses-dia" data-ver="${o.date}" title="Ver las horas de ese día">${esc(o.etiqueta)}<small>${fechaDeIso(o.date).toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</small></button>
      ${estado(o)}
      <button type="button" class="agr-ses-x" data-quitar="${o.date}" title="Quitar esta sesión">×</button></div>`).join('')}
    ${quitadas.length ? `<div class="agr-serie-pie">Quitadas: ${quitadas.map(f => `<button type="button" class="agr-link" data-reponer="${f}">${fmtCorta(f)} ↺</button>`).join(' ')}</div>` : ''}
  </div>`;
  box.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => verDia(b.dataset.ver)));
  box.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.quitar;
    if (st.forma === 'manual') st.manuales = st.manuales.filter(x => x !== f);
    else st.quitadas.add(f);
    if (st.vista === f) st.vista = fechasSerie()[0] || '';
    pintar(); avisar();
  }));
  box.querySelectorAll('[data-reponer]').forEach(b => b.addEventListener('click', () => { st.quitadas.delete(b.dataset.reponer); pintar(); avisar(); }));
}

function verDia(f) {
  st.vista = f;
  const d = fechaDeIso(f);
  if (d.getFullYear() !== st.anio || d.getMonth() !== st.mes) irA(d.getFullYear(), d.getMonth());
  else pintar();
}

function conectar(c) {
  c.querySelectorAll('[data-dia]').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.dia;
    st.aviso = '';
    if (st.forma === 'manual') {
      if (st.manuales.includes(f)) st.manuales = st.manuales.filter(x => x !== f);
      else if (st.manuales.length >= MAX_SESIONES) st.aviso = `Máximo ${MAX_SESIONES} sesiones por serie.`;
      else st.manuales = [...st.manuales, f];
      st.fecha = st.manuales.slice().sort()[0] || '';
      st.vista = st.manuales.includes(f) ? f : st.fecha;
    } else if (st.forma !== 'unica' && fechasSerie().includes(f) && f !== st.fecha) {
      st.vista = f; // ver una sesión de la serie
    } else {
      st.fecha = f; st.vista = f; st.quitadas = new Set();
    }
    if (st.vista === hoyIso() && st.inicio && aMin(st.inicio) <= new Date().getHours() * 60 + new Date().getMinutes()) { st.inicio = ''; st.fin = ''; }
    pintar(); avisar();
  }));
  c.querySelectorAll('[data-hora]').forEach(b => b.addEventListener('click', () => {
    const hr = Number(b.dataset.hora);
    const dur = duracion();
    st.inicio = `${pad2(hr)}:00`;
    st.fin = deMin(Math.min(hr * 60 + dur, 23 * 60 + 59));
    if (!st.fecha && st.vista) st.fecha = st.vista;
    pintar(); avisar();
  }));
  c.querySelectorAll('[data-dur]').forEach(b => b.addEventListener('click', () => {
    if (!st.inicio) return;
    st.fin = deMin(Math.min(aMin(st.inicio) + Number(b.dataset.dur), 23 * 60 + 59));
    pintar(); avisar();
  }));
  c.querySelectorAll('input[name="start_time"], input[name="end_time"]').forEach(inp => inp.addEventListener('change', () => {
    if (inp.name === 'start_time') {
      const dur = duracion();
      st.inicio = inp.value;
      if (st.inicio && (!st.fin || st.fin <= st.inicio)) st.fin = deMin(Math.min(aMin(st.inicio) + dur, 23 * 60 + 59));
    } else st.fin = inp.value;
    pintar(); avisar();
  }));
  c.querySelectorAll('[data-persona]').forEach(chk => chk.addEventListener('change', () => {
    const m = (st.datos?.members || []).find(x => String(x.user_id) === chk.dataset.persona);
    if (m) st.opciones?.alMarcarPersona?.(m, chk.checked);
    pintar(); verificarSerie();
  }));
  c.querySelector('[data-accion="todos"]')?.addEventListener('click', () => {
    const vista = st.vista || st.fecha;
    const ocu = ocupadosEn(vista, st.inicio, st.fin);
    const elegidos = new Set((st.opciones?.seleccionados?.() || []).map(String));
    (st.datos?.members || []).filter(m => !ocu.has(m.user_id) && !elegidos.has(String(m.user_id))).forEach(m => st.opciones?.alMarcarPersona?.(m, true));
    pintar(); verificarSerie();
  });
  c.querySelector('[data-accion="extendido"]')?.addEventListener('change', e => { st.extendido = e.target.checked; pintar(); });
  c.querySelector('[data-accion="hueco"]')?.addEventListener('click', proximoHueco);
  c.querySelectorAll('[data-accion="recargar"]').forEach(b => b.addEventListener('click', () => cargar()));
  c.querySelectorAll('.agr-panel [data-ver]').forEach(b => b.addEventListener('click', () => verDia(b.dataset.ver)));
  c.querySelectorAll('[data-forma]').forEach(b => b.addEventListener('click', () => cambiarForma(b.dataset.forma)));
  c.querySelectorAll('[data-cfg]').forEach(el => el.addEventListener('change', () => {
    const k = el.dataset.cfg;
    if (k === 'saltarFindes') st.saltarFindes = el.checked;
    else if (k === 'sesiones') st.sesiones = Math.max(st.forma === 'auditoria' ? 2 : 1, Math.min(MAX_SESIONES, Number(el.value) || 1));
    else st[k] = el.value;
    st.quitadas = new Set();
    setTimeout(() => { pintar(); avisar(); });
  }));
  c.querySelectorAll('[data-mes]').forEach(b => b.addEventListener('click', () => {
    const f = new Date(st.anio, st.mes + Number(b.dataset.mes), 1);
    irA(f.getFullYear(), f.getMonth());
  }));
  c.querySelector('[data-ir="mes"]')?.addEventListener('change', e => irA(st.anio, Number(e.target.value)));
  c.querySelector('[data-ir="anio"]')?.addEventListener('change', e => irA(Number(e.target.value), st.mes));
}

function cambiarForma(forma) {
  if (!FORMAS[forma] || forma === st.forma) return;
  const antes = fechasSerie();
  st.forma = forma; st.quitadas = new Set(); st.aviso = '';
  if (forma === 'manual') st.manuales = antes.slice();           // conserva las fechas para ajustarlas a mano
  if (forma === 'auditoria' && st.sesiones < 3) st.sesiones = 3;
  if (forma === 'revision' && st.sesiones < 2) st.sesiones = 4;
  st.vista = fechasSerie()[0] || st.fecha;
  st.opciones?.alCambiarForma?.(forma);
  pintar(); avisar();
}

// Próximo horario (hábil, dentro de la jornada) en que los integrantes elegidos del equipo están libres
async function proximoHueco() {
  const miembros = st.datos?.members || [];
  st.buscando = true; st.aviso = ''; pintar();
  try {
    const desde = st.fecha && st.fecha > hoyIso() ? st.fecha : hoyIso();
    const hasta = new Date(fechaDeIso(desde)); hasta.setDate(hasta.getDate() + 45);
    const datos = await api.get('/calendar/team-availability', { area: st.area, from: desde, to: isoDe(hasta) });
    const equipo = datos.members || miembros;
    const elegidos = new Set((st.opciones?.seleccionados?.() || []).map(String));
    const enEquipo = equipo.filter(m => elegidos.has(String(m.user_id))).map(m => m.user_id);
    const quienes = enEquipo.length ? enEquipo : equipo.map(m => m.user_id);
    const dur = duracion();
    const ahora = new Date(); const minHoy = ahora.getHours() * 60 + ahora.getMinutes();
    for (let d = fechaDeIso(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
      const f = isoDe(d);
      if (esFinde(f)) continue;
      for (let m = HORARIO_NORMAL[0] * 60; m + dur <= HORARIO_NORMAL[1] * 60; m += 30) {
        if (f === hoyIso() && m <= minHoy) continue;
        const ocu = ocupadosEn(f, deMin(m), deMin(m + dur), datos);
        if (quienes.every(id => !ocu.has(id))) {
          st.inicio = deMin(m); st.fin = deMin(m + dur);
          if (st.forma === 'manual') { if (!st.manuales.includes(f)) st.manuales = [...st.manuales, f]; st.fecha = st.manuales.slice().sort()[0]; }
          else { st.fecha = f; st.quitadas = new Set(); }
          st.vista = f;
          st.aviso = `Libre: ${fmtCorta(f)} de ${st.inicio} a ${st.fin} para ${enEquipo.length ? 'los participantes elegidos' : `todo ${st.areaLabel}`}.`;
          st.buscando = false;
          const dd = fechaDeIso(f);
          if (dd.getFullYear() !== st.anio || dd.getMonth() !== st.mes) irA(dd.getFullYear(), dd.getMonth()); else pintar();
          avisar();
          return;
        }
      }
    }
    st.aviso = 'No hay un horario libre para todos en los próximos 45 días dentro de la jornada.';
  } catch (e) {
    st.aviso = 'No se pudo buscar: ' + (e.message || 'error');
  }
  st.buscando = false; pintar();
}

function irA(anio, mes) {
  const h = new Date();
  const minimo = st.fechaOriginal && st.fechaOriginal < hoyIso() ? fechaDeIso(st.fechaOriginal) : h;
  if (anio < minimo.getFullYear() || (anio === minimo.getFullYear() && mes < minimo.getMonth())) { anio = minimo.getFullYear(); mes = minimo.getMonth(); }
  st.anio = anio; st.mes = mes; st.datos = null;
  pintar(); cargar();
}

function estilos() {
  if (document.getElementById('agr-estilos')) document.getElementById('agr-estilos').remove();
  const s = document.createElement('style');
  s.id = 'agr-estilos';
  s.textContent = `
  .agr { border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px; background: #fff; }
  .agr-cab { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; margin-bottom: 8px; }
  .agr-cab b { display: block; font-size: 13.5px; color: #0f172a; }
  .agr-cab small { font-size: 11px; color: #64748b; }
  .agr-cab-der { display: flex; align-items: center; gap: 6px; flex: none; }
  .agr-vivo { font-size: 10.5px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
  .agr-vivo::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #10b981; margin-right: 5px; vertical-align: middle; }
  .agr-vivo.error { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
  .agr-vivo.error::before { background: #ef4444; }
  .agr-btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #334155; cursor: pointer; white-space: nowrap; }
  .agr-btn.icono { width: 30px; height: 30px; padding: 0; font-size: 16px; }
  .agr-btn:disabled { opacity: .4; cursor: default; }
  .agr-formas { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 6px; }
  .agr-forma { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 7px 8px; font-size: 12px; font-weight: 700; color: #334155; cursor: pointer; text-align: left; }
  .agr-forma:hover { border-color: #93c5fd; }
  .agr-forma.activo { background: #1e3a8a; color: #fff; border-color: #1e3a8a; }
  .agr-ayuda { font-size: 11.5px; color: #64748b; margin-bottom: 8px; }
  .agr-config { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: flex-end; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
  .agr-config label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 700; color: #475569; }
  .agr-config select, .agr-config input[type=number] { border: 1px solid #cbd5e1; border-radius: 7px; padding: 4px 6px; font-size: 12.5px; background: #fff; }
  .agr-config input[type=number] { width: 70px; }
  .agr-config .agr-check { flex-direction: row; align-items: center; gap: 6px; font-weight: 600; padding-bottom: 4px; }
  .agr-resumen { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #64748b; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 6px 8px 6px 10px; margin-bottom: 8px; }
  .agr-resumen.ok { color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; }
  .agr-aviso { font-size: 11.5px; font-weight: 600; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; }
  .agr-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .agr-nav-sel { display: flex; gap: 6px; }
  .agr-nav-sel select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px 8px; font-size: 12.5px; font-weight: 600; background: #fff; }
  .agr-mes { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .agr-dow { text-align: center; font-size: 10.5px; font-weight: 800; color: #94a3b8; padding: 2px 0; }
  .agr-dia { position: relative; height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 12.5px; font-weight: 700; color: #1e293b; cursor: pointer; padding: 0; }
  .agr-dia.fuera { border: 0; background: none; }
  .agr-dia:disabled { color: #cbd5e1; background: #f8fafc; cursor: default; }
  .agr-dia.finde:not(:disabled):not(.sel) { background: #f8fafc; color: #64748b; }
  .agr-dia.hoy { box-shadow: inset 0 0 0 2px #93c5fd; }
  .agr-dia:not(:disabled):hover { border-color: #2563eb; }
  .agr-dia .barra { position: absolute; left: 25%; right: 25%; bottom: 4px; height: 3px; border-radius: 3px; background: transparent; }
  .agr-dia.libre .barra { background: #10b981; } .agr-dia.parcial .barra { background: #f59e0b; } .agr-dia.ocupado .barra { background: #ef4444; }
  .agr-dia.sel { background: #2563eb !important; color: #fff !important; border-color: #1d4ed8; }
  .agr-dia.sel.serie { background: #0f766e !important; border-color: #0f766e; }
  .agr-dia.sel .barra { background: #fff; }
  .agr-dia.vista { outline: 2px solid #f59e0b; outline-offset: 1px; }
  .agr-dia.quitada { text-decoration: line-through; color: #94a3b8; }
  .agr-marca { position: absolute; top: -7px; left: 50%; transform: translateX(-50%); font-size: 7.5px; font-weight: 800; letter-spacing: .3px; background: #0f172a; color: #fff; border-radius: 4px; padding: 1px 4px; white-space: nowrap; z-index: 1; }
  .agr-leyenda { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10.5px; color: #64748b; margin: 8px 0; }
  .agr-leyenda i { display: inline-block; width: 10px; height: 4px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  .agr-serie { border: 1px solid #ccfbf1; background: #f0fdfa; border-radius: 10px; padding: 8px; margin-bottom: 8px; }
  .agr-serie-cab { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 12px; color: #0f766e; margin-bottom: 6px; }
  .agr-serie-vacia { font-size: 12px; color: #0f766e; background: #f0fdfa; border: 1px dashed #99f6e4; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
  .agr-ses { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 6px 5px 8px; margin-bottom: 4px; }
  .agr-ses.vista { border-color: #f59e0b; }
  .agr-ses-dia { flex: 1; text-align: left; border: 0; background: none; cursor: pointer; font-size: 12px; font-weight: 700; color: #0f172a; padding: 0; }
  .agr-ses-dia small { display: block; font-weight: 500; color: #64748b; font-size: 11px; text-transform: capitalize; }
  .agr-ses-x { border: 0; background: #f1f5f9; color: #64748b; border-radius: 6px; width: 24px; height: 24px; cursor: pointer; font-size: 15px; flex: none; }
  .agr-ses-x:hover { background: #fee2e2; color: #b91c1c; }
  .agr-serie-pie { font-size: 11px; color: #64748b; margin-top: 4px; }
  .agr-est { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 2px 8px; white-space: nowrap; max-width: 170px; overflow: hidden; text-overflow: ellipsis; }
  .agr-est.ok { background: #dcfce7; color: #166534; } .agr-est.mal { background: #fee2e2; color: #b91c1c; }
  .agr-est.aviso { background: #fef3c7; color: #92400e; } .agr-est.gris { background: #f1f5f9; color: #64748b; }
  .agr-panel { border-top: 1px solid #f1f5f9; padding-top: 8px; }
  .agr-paso { display: flex; justify-content: space-between; gap: 8px; align-items: center; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: #475569; margin-bottom: 6px; }
  .agr-ext { font-size: 10.5px; font-weight: 600; text-transform: none; letter-spacing: 0; color: #64748b; white-space: nowrap; display: flex; gap: 4px; align-items: center; }
  .agr-horas { display: flex; flex-direction: column; gap: 4px; max-height: 240px; overflow: auto; padding-right: 2px; }
  .agr-hora { display: flex; align-items: center; gap: 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 5px 10px; cursor: pointer; font-size: 12px; text-align: left; }
  .agr-hora strong { width: 104px; flex: none; color: #0f172a; }
  .agr-hora:hover:not(:disabled) { border-color: #2563eb; }
  .agr-hora:disabled { opacity: .5; cursor: default; }
  .agr-hora.nadie { background: #fef2f2; border-color: #fecaca; }
  .agr-hora.sel { background: #eff6ff; border-color: #2563eb; box-shadow: inset 3px 0 0 #2563eb; }
  .agr-puntos { flex: 1; display: flex; gap: 3px; flex-wrap: wrap; }
  .agr-punto { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
  .agr-punto.ocu { background: #ef4444; }
  .agr-cuenta { font-size: 11px; font-weight: 700; color: #047857; white-space: nowrap; }
  .agr-hora.nadie .agr-cuenta { color: #b91c1c; }
  .agr-tiempos { display: flex; gap: 8px; align-items: flex-end; margin-top: 8px; flex-wrap: wrap; }
  .agr-tiempos label { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; font-weight: 600; color: #475569; }
  .agr-durs { display: flex; gap: 4px; flex-wrap: wrap; padding-bottom: 4px; }
  .agr-chip { border: 1px solid #cbd5e1; background: #fff; border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; }
  .agr-chip.activo { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
  .agr-chip:disabled { opacity: .4; cursor: default; }
  .agr-detalle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .agr-detalle h4 { font-size: 11px; font-weight: 800; color: #334155; margin: 0 0 5px; display: flex; justify-content: space-between; gap: 6px; align-items: center; }
  .agr-link { border: 0; background: none; color: #2563eb; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; }
  .agr-persona { display: block; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; font-size: 12px; margin-bottom: 4px; }
  .agr-persona.libre { display: flex; gap: 6px; align-items: flex-start; cursor: pointer; background: #ecfdf5; border-color: #a7f3d0; }
  .agr-persona.libre.fuera { background: #fff; border-color: #e2e8f0; }
  .agr-persona small { display: block; font-size: 10.5px; color: #64748b; }
  .agr-persona.ocu { background: #fef2f2; border-color: #fecaca; }
  .agr-vacio { font-size: 12px; color: #64748b; text-align: center; padding: 14px 8px; }
  /* Columnas con scroll independiente dentro del formulario */
  @media (min-width: 1024px) {
    .cal-cols { height: calc(90vh - 110px); }
    .cal-col { overflow-y: auto; height: 100%; padding-right: 6px; overscroll-behavior: contain; }
  }
  @media (max-width: 640px) { .agr-detalle { grid-template-columns: 1fr; } .agr-formas { grid-template-columns: 1fr; } }`;
  document.head.appendChild(s);
}
