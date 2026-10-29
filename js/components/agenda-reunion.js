/* Agenda para elegir fecha y hora de una reunión (mismo diseño que el
   "Plazo del proyecto y agenda de OTI" de Comercial): calendario del mes
   con la disponibilidad del equipo del área, horas del día con quién está
   libre u ocupado (en vivo) y casillas para sumar a los integrantes libres
   como participantes. Escribe la fecha y el horario en los campos
   date / start_time / end_time del formulario que la contiene. */
import { api } from '../api.js';

const HORA_INI = 8;     // jornada 08:00–18:00
const HORA_FIN = 18;
const REFRESCO_MS = 20000;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const pad2 = n => String(n).padStart(2, '0');
const isoDia = (a, m, d) => `${a}-${pad2(m + 1)}-${pad2(d)}`;
const hoyIso = () => { const h = new Date(); return isoDia(h.getFullYear(), h.getMonth(), h.getDate()); };
const fechaDeIso = f => { const [a, m, d] = f.split('-').map(Number); return new Date(a, m - 1, d); };
const aMin = t => { const [h, m] = String(t || '').split(':').map(Number); return h * 60 + (m || 0); };
const deMin = n => `${pad2(Math.floor(n / 60))}:${pad2(n % 60)}`;
const nombre = p => [p.nombre, p.apellidos].filter(Boolean).join(' ');
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const st = {
  area: 'TI', areaLabel: 'OTI', anio: 0, mes: 0, fecha: '', inicio: '', fin: '',
  excluir: null, fechaOriginal: '', datos: null, error: null, actualizado: null, timer: null, pidiendo: 0,
  cont: null, opciones: null,
};

/* Inicia la agenda (al abrir el formulario). Se puede volver a montar
   (re-render del formulario) y conserva lo elegido. */
export function iniciarAgenda({ area, areaLabel, fecha, inicio, fin, excluirReunion }) {
  st.area = area; st.areaLabel = areaLabel;
  st.fecha = fecha || ''; st.inicio = inicio || ''; st.fin = fin || '';
  st.excluir = excluirReunion || null; st.fechaOriginal = fecha || '';
  const base = st.fecha ? fechaDeIso(st.fecha) : new Date();
  st.anio = base.getFullYear(); st.mes = base.getMonth();
  st.datos = null; st.error = null;
}

/* Monta la agenda dentro de `cont`. opciones:
   - seleccionados(): ids de participantes internos ya elegidos
   - alCambiarHorario({date, start_time, end_time})
   - alMarcarPersona(miembro, agregar) */
export function montarAgenda(cont, opciones) {
  st.cont = cont; st.opciones = opciones;
  estilos();
  pintar();
  if (!st.datos) cargar();
  clearInterval(st.timer);
  st.timer = setInterval(() => {
    if (!document.body.contains(st.cont)) { clearInterval(st.timer); st.timer = null; return; }
    cargar(true);
  }, REFRESCO_MS);
}

export function repintarAgenda() { if (st.cont && document.body.contains(st.cont)) pintar(); }

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
  repintarAgenda();
}

function ocupaciones() {
  return (st.datos?.busy || []).filter(b => !st.excluir || b.meeting_id !== st.excluir);
}
// Integrantes ocupados en [ini, fin) de un día → Map(user_id → reuniones)
function ocupadosEn(fecha, ini, fin) {
  const res = new Map();
  ocupaciones().forEach(b => {
    if (b.date === fecha && b.start_time < fin && b.end_time > ini) {
      if (!res.has(b.user_id)) res.set(b.user_id, []);
      res.get(b.user_id).push(b);
    }
  });
  return res;
}
function estadoDia(fecha) {
  const n = (st.datos?.members || []).length;
  if (!n) return '';
  let libres = 0, sinNadie = 0, total = 0;
  for (let h = HORA_INI; h < HORA_FIN; h++) {
    const ocu = ocupadosEn(fecha, `${pad2(h)}:00`, `${pad2(h + 1)}:00`).size;
    total++;
    if (ocu === 0) libres++;
    if (ocu >= n) sinNadie++;
  }
  return libres === total ? 'libre' : sinNadie === total ? 'ocupado' : 'parcial';
}

function avisar() {
  st.opciones?.alCambiarHorario?.({ date: st.fecha, start_time: st.inicio, end_time: st.fin });
}

function pintar() {
  const c = st.cont;
  if (!c) return;
  const miembros = st.datos?.members || [];
  const hoy = hoyIso();
  const h = new Date();
  const esMesActual = st.anio === h.getFullYear() && st.mes === h.getMonth();

  // Calendario del mes
  const primerDow = (new Date(st.anio, st.mes, 1).getDay() + 6) % 7;
  const diasMes = new Date(st.anio, st.mes + 1, 0).getDate();
  let celdas = '';
  for (let i = 0; i < primerDow; i++) celdas += '<span class="agr-dia fuera"></span>';
  for (let d = 1; d <= diasMes; d++) {
    const f = isoDia(st.anio, st.mes, d);
    const dow = new Date(st.anio, st.mes, d).getDay();
    const pasado = f < hoy && f !== st.fechaOriginal;
    const finde = dow === 0 || dow === 6;
    const est = !pasado && st.datos ? estadoDia(f) : '';
    const sel = f === st.fecha;
    const tit = pasado ? 'Fecha pasada' : est === 'libre' ? `${st.areaLabel} libre todo el día` : est === 'parcial' ? `${st.areaLabel} con reuniones: revisa las horas` : est === 'ocupado' ? `Todo ${st.areaLabel} ocupado` : '';
    celdas += `<button type="button" class="agr-dia ${est} ${finde ? 'finde' : ''} ${f === hoy ? 'hoy' : ''} ${sel ? 'sel' : ''}" data-dia="${f}" ${pasado ? 'disabled' : ''} title="${tit}">${d}<span class="barra"></span>${sel ? '<span class="agr-marca">REUNIÓN</span>' : ''}</button>`;
  }
  const anios = [];
  for (let a = h.getFullYear() - (st.fechaOriginal && st.fechaOriginal < hoy ? 1 : 0); a <= h.getFullYear() + 2; a++) anios.push(a);

  // Horas del día elegido
  let panel;
  if (st.error && !st.datos) {
    panel = `<div class="agr-vacio">⚠️ ${esc(st.error)}<br><br><button type="button" class="agr-btn" data-accion="recargar">Reintentar</button><br><br>Puedes elegir la fecha y la hora igualmente.</div>`;
  } else if (!st.fecha) {
    panel = `<div class="agr-vacio">Elige un día en el calendario para ver las horas libres de ${esc(st.areaLabel)}.${miembros.length ? `<br><small>Equipo ${esc(st.areaLabel)}: ${miembros.map(m => esc(nombre(m))).join(', ')}</small>` : ''}</div>`;
  } else {
    const iniSel = st.inicio ? aMin(st.inicio) : null, finSel = st.fin ? aMin(st.fin) : null;
    let filas = '';
    if (!st.datos) filas = `<div class="agr-vacio">Consultando la agenda de ${esc(st.areaLabel)}…</div>`;
    else if (!miembros.length) filas = `<div class="agr-vacio">No hay integrantes activos del área ${esc(st.areaLabel)} registrados en RR. HH.; elige la hora igualmente.</div>`;
    for (let hr = HORA_INI; st.datos && miembros.length && hr < HORA_FIN; hr++) {
      const ocu = ocupadosEn(st.fecha, `${pad2(hr)}:00`, `${pad2(hr + 1)}:00`);
      const libres = miembros.length - ocu.size;
      const puntos = miembros.map(m => `<span class="agr-punto ${ocu.has(m.user_id) ? 'ocu' : ''}" title="${esc(nombre(m))}: ${ocu.has(m.user_id) ? 'ocupado' : 'libre'}"></span>`).join('');
      const pasada = st.fecha === hoy && hr <= h.getHours();
      const enRango = iniSel !== null && finSel !== null && hr * 60 < finSel && (hr + 1) * 60 > iniSel;
      filas += `<button type="button" class="agr-hora ${libres === 0 ? 'nadie' : ''} ${enRango ? 'sel' : ''}" data-hora="${hr}" ${pasada ? 'disabled' : ''}>
        <strong>${pad2(hr)}:00 – ${pad2(hr + 1)}:00</strong><span class="agr-puntos">${puntos}</span>
        <span class="agr-cuenta">${libres === miembros.length ? 'Todos libres' : libres === 0 ? 'Nadie libre' : `${libres} de ${miembros.length} libres`}</span></button>`;
    }
    // Quién está libre u ocupado en el horario elegido
    let detalle = '';
    if (st.inicio && st.fin && st.fin > st.inicio && miembros.length) {
      const ocu = ocupadosEn(st.fecha, st.inicio, st.fin);
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
    panel = `<div class="agr-paso">Horas del ${fechaDeIso(st.fecha).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })} · elige la hora</div>
      <div class="agr-horas">${filas}</div>
      <div class="agr-tiempos">
        <label>Inicio *<input type="time" name="start_time" class="input text-sm" required value="${esc(st.inicio)}"></label>
        <label>Fin *<input type="time" name="end_time" class="input text-sm" required value="${esc(st.fin)}"></label>
        <span class="agr-dur">${st.inicio && st.fin && st.fin > st.inicio ? `${aMin(st.fin) - aMin(st.inicio)} min` : ''}</span>
      </div>${detalle}`;
  }

  const vivo = st.error ? `<span class="agr-vivo error" title="${esc(st.error)}">Sin conexión con la agenda</span>`
    : `<span class="agr-vivo">En vivo${st.actualizado ? ' · ' + st.actualizado.toLocaleTimeString('es-PE') : ''}</span>`;
  const resumen = st.fecha
    ? `📅 ${fechaDeIso(st.fecha).toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}${st.inicio ? ` · ${st.inicio}${st.fin ? '–' + st.fin : ''}` : ' · sin hora'}`
    : 'Sin fecha elegida';

  // Al repintar se conserva el scroll de las horas; la primera vez se muestra la hora elegida
  const scrollPrevio = c.querySelector('.agr-horas')?.scrollTop;
  c.innerHTML = `<div class="agr">
    <input type="hidden" name="date" value="${esc(st.fecha)}">
    <div class="agr-cab"><div><b>📅 Fecha y hora</b><small>Agenda de ${esc(st.areaLabel)} en vivo: elige el día y la hora sin cruces</small></div>
      <div class="agr-cab-der">${vivo}<button type="button" class="agr-btn icono" data-accion="recargar" title="Actualizar ahora">↻</button></div></div>
    <div class="agr-resumen ${st.fecha && st.inicio ? 'ok' : ''}">${resumen}</div>
    <div class="agr-nav">
      <button type="button" class="agr-btn icono" data-mes="-1" ${esMesActual && !(st.fechaOriginal && st.fechaOriginal < hoy) ? 'disabled' : ''} title="Mes anterior">‹</button>
      <div class="agr-nav-sel">
        <select data-ir="mes" aria-label="Mes">${MESES.map((n, i) => `<option value="${i}" ${i === st.mes ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select data-ir="anio" aria-label="Año">${anios.map(a => `<option value="${a}" ${a === st.anio ? 'selected' : ''}>${a}</option>`).join('')}</select>
      </div>
      <button type="button" class="agr-btn icono" data-mes="1" title="Mes siguiente">›</button>
    </div>
    <div class="agr-mes">${['L','M','M','J','V','S','D'].map(x => `<div class="agr-dow">${x}</div>`).join('')}${celdas}</div>
    <div class="agr-leyenda"><span><i style="background:#2563eb"></i>Reunión</span><span><i style="background:#10b981"></i>${esc(st.areaLabel)} libre</span><span><i style="background:#f59e0b"></i>Con reuniones</span><span><i style="background:#ef4444"></i>${esc(st.areaLabel)} ocupado</span></div>
    <div class="agr-panel">${panel}</div>
  </div>`;
  const lista = c.querySelector('.agr-horas');
  if (lista) {
    const sel = lista.querySelector('.agr-hora.sel');
    if (scrollPrevio !== undefined) lista.scrollTop = scrollPrevio;
    else if (sel) lista.scrollTop = Math.max(0, sel.offsetTop - lista.offsetTop - 40);
  }
  conectar(c);
}

function conectar(c) {
  c.querySelectorAll('[data-dia]').forEach(b => b.addEventListener('click', () => {
    st.fecha = b.dataset.dia;
    if (st.fecha === hoyIso() && st.inicio && aMin(st.inicio) <= new Date().getHours() * 60 + new Date().getMinutes()) { st.inicio = ''; st.fin = ''; }
    pintar(); avisar();
  }));
  c.querySelectorAll('[data-hora]').forEach(b => b.addEventListener('click', () => {
    const hr = Number(b.dataset.hora);
    // Conserva la duración elegida (por defecto 1 hora)
    const dur = st.inicio && st.fin && st.fin > st.inicio ? aMin(st.fin) - aMin(st.inicio) : 60;
    st.inicio = `${pad2(hr)}:00`;
    st.fin = deMin(Math.min(hr * 60 + dur, 23 * 60 + 59));
    pintar(); avisar();
  }));
  c.querySelectorAll('input[name="start_time"], input[name="end_time"]').forEach(inp => inp.addEventListener('change', () => {
    if (inp.name === 'start_time') {
      const dur = st.inicio && st.fin && st.fin > st.inicio ? aMin(st.fin) - aMin(st.inicio) : 60;
      st.inicio = inp.value;
      if (st.inicio && (!st.fin || st.fin <= st.inicio)) st.fin = deMin(Math.min(aMin(st.inicio) + dur, 23 * 60 + 59));
    } else st.fin = inp.value;
    pintar(); avisar();
  }));
  c.querySelectorAll('[data-persona]').forEach(chk => chk.addEventListener('change', () => {
    const m = (st.datos?.members || []).find(x => String(x.user_id) === chk.dataset.persona);
    if (m) st.opciones?.alMarcarPersona?.(m, chk.checked);
    pintar();
  }));
  c.querySelector('[data-accion="todos"]')?.addEventListener('click', () => {
    const ocu = ocupadosEn(st.fecha, st.inicio, st.fin);
    const elegidos = new Set((st.opciones?.seleccionados?.() || []).map(String));
    (st.datos?.members || []).filter(m => !ocu.has(m.user_id) && !elegidos.has(String(m.user_id))).forEach(m => st.opciones?.alMarcarPersona?.(m, true));
    pintar();
  });
  c.querySelectorAll('[data-accion="recargar"]').forEach(b => b.addEventListener('click', () => cargar()));
  c.querySelectorAll('[data-mes]').forEach(b => b.addEventListener('click', () => {
    const f = new Date(st.anio, st.mes + Number(b.dataset.mes), 1);
    irA(f.getFullYear(), f.getMonth());
  }));
  c.querySelector('[data-ir="mes"]')?.addEventListener('change', e => irA(st.anio, Number(e.target.value)));
  c.querySelector('[data-ir="anio"]')?.addEventListener('change', e => irA(Number(e.target.value), st.mes));
}

function irA(anio, mes) {
  const h = new Date();
  const minimo = st.fechaOriginal && st.fechaOriginal < hoyIso() ? fechaDeIso(st.fechaOriginal) : h;
  if (anio < minimo.getFullYear() || (anio === minimo.getFullYear() && mes < minimo.getMonth())) { anio = minimo.getFullYear(); mes = minimo.getMonth(); }
  st.anio = anio; st.mes = mes; st.datos = null;
  pintar(); cargar();
}

function estilos() {
  if (document.getElementById('agr-estilos')) return;
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
  .agr-btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #334155; cursor: pointer; }
  .agr-btn.icono { width: 30px; height: 30px; padding: 0; font-size: 16px; }
  .agr-btn:disabled { opacity: .4; cursor: default; }
  .agr-resumen { font-size: 12px; font-weight: 700; color: #64748b; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 6px 10px; margin-bottom: 8px; }
  .agr-resumen.ok { color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; }
  .agr-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .agr-nav-sel { display: flex; gap: 6px; }
  .agr-nav-sel select { border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px 8px; font-size: 12.5px; font-weight: 600; background: #fff; }
  .agr-mes { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .agr-dow { text-align: center; font-size: 10.5px; font-weight: 800; color: #94a3b8; padding: 2px 0; }
  .agr-dia { position: relative; height: 38px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 12.5px; font-weight: 700; color: #1e293b; cursor: pointer; padding: 0; }
  .agr-dia.fuera { border: 0; background: none; }
  .agr-dia:disabled { color: #cbd5e1; background: #f8fafc; cursor: default; }
  .agr-dia.finde:not(:disabled) { background: #f8fafc; color: #64748b; }
  .agr-dia.hoy { box-shadow: inset 0 0 0 2px #93c5fd; }
  .agr-dia:not(:disabled):hover { border-color: #2563eb; }
  .agr-dia .barra { position: absolute; left: 25%; right: 25%; bottom: 4px; height: 3px; border-radius: 3px; background: transparent; }
  .agr-dia.libre .barra { background: #10b981; } .agr-dia.parcial .barra { background: #f59e0b; } .agr-dia.ocupado .barra { background: #ef4444; }
  .agr-dia.sel { background: #2563eb !important; color: #fff !important; border-color: #1d4ed8; }
  .agr-dia.sel .barra { background: #fff; }
  .agr-marca { position: absolute; top: -7px; left: 50%; transform: translateX(-50%); font-size: 7.5px; font-weight: 800; letter-spacing: .3px; background: #0f172a; color: #fff; border-radius: 4px; padding: 1px 4px; }
  .agr-leyenda { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 10.5px; color: #64748b; margin: 8px 0; }
  .agr-leyenda i { display: inline-block; width: 10px; height: 4px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
  .agr-panel { border-top: 1px solid #f1f5f9; padding-top: 8px; }
  .agr-paso { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: #475569; margin-bottom: 6px; }
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
  .agr-tiempos { display: flex; gap: 8px; align-items: flex-end; margin-top: 8px; }
  .agr-tiempos label { display: flex; flex-direction: column; gap: 3px; font-size: 11.5px; font-weight: 600; color: #475569; }
  .agr-dur { font-size: 11.5px; font-weight: 700; color: #1d4ed8; padding-bottom: 8px; }
  .agr-detalle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .agr-detalle h4 { font-size: 11px; font-weight: 800; color: #334155; margin: 0 0 5px; display: flex; justify-content: space-between; gap: 6px; align-items: center; }
  .agr-link { border: 0; background: none; color: #2563eb; font-size: 11px; font-weight: 700; cursor: pointer; padding: 0; }
  .agr-persona { display: block; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; font-size: 12px; margin-bottom: 4px; }
  .agr-persona.libre { display: flex; gap: 6px; align-items: flex-start; cursor: pointer; background: #ecfdf5; border-color: #a7f3d0; }
  .agr-persona.libre.fuera { background: #fff; border-color: #e2e8f0; }
  .agr-persona small { display: block; font-size: 10.5px; color: #64748b; }
  .agr-persona.ocu { background: #fef2f2; border-color: #fecaca; }
  .agr-vacio { font-size: 12px; color: #64748b; text-align: center; padding: 14px 8px; }
  @media (max-width: 640px) { .agr-detalle { grid-template-columns: 1fr; } }`;
  document.head.appendChild(s);
}
