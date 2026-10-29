import { api }        from '../api.js';
import { getUser }    from '../state.js';
import { toast, showModal, closeModal, confirmModal, pageHeader, spinner, icon } from '../utils.js';
import { iniciarAgenda, montarAgenda, repintarAgenda } from '../components/agenda-reunion.js';

const OWN_AREA = 'TI';
const AREAS = [['TI','OTI'],['ADG','ADG'],['RRHH','RR. HH.'],['SOPORTE','Soporte']];
const MEETING_TYPES = ['Reunión técnica','Planificación','Revisión','Incidencia','Coordinación','Otro'];
const EXTERNAL_KINDS = [['cliente','Cliente'],['postulante','Postulante'],['proveedor','Proveedor'],['consultor','Consultor'],['otro','Otro']];
const STATUS_LABEL = { scheduled:'Programada', confirmed:'Confirmada', in_progress:'En curso', completed:'Finalizada', cancelled:'Cancelada' };
const MODALITY_LABEL = { presencial: 'Presencial', virtual: 'Virtual' };

/* Ícono clickeable que resume la modalidad de la reunión: en presencial
   abre la dirección en Google Maps, en virtual abre el link de ingreso
   tal cual se guardó. Sin ubicación cargada, solo informa la modalidad. */
function modalityIconHtml(m) {
  const isVirtual = m.modality === 'virtual';
  const iconName = isVirtual ? 'videocam' : 'location_on';
  const label = MODALITY_LABEL[m.modality] || 'Presencial';
  const colorClasses = isVirtual ? 'bg-blue-50 text-blue-700' : 'bg-primary-50 text-primary-700';
  if (!m.location) {
    return `<span class="badge ${colorClasses}" title="${esc(label)}">${icon(iconName,12)} ${label}</span>`;
  }
  const href = isVirtual
    ? (/^https?:\/\//i.test(m.location) ? m.location : 'https://' + m.location)
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.location)}`;
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="badge ${colorClasses} hover:brightness-95" title="${esc(label + ' · ' + m.location)}" onclick="event.stopPropagation()">${icon(iconName,12)} ${label}</a>`;
}

let _mode = 'area';               // 'area' | 'mine' | 'week' | 'weekArea'
let _filters = { area: OWN_AREA, participant: '', type: '', date_from: todayISO(), date_to: '', status: '' };
let _meetings = [];
let _editingId = null;
let _conflicts = [];
let _selectedParticipants = [];   // [{user_id, nombre, apellidos, area, cargo, role?}]
let _externalParticipants = [];   // [{name, kind}]
let _dirResults = [];
let _dirDebounce, _filterDebounce;
let _checkToken = 0;
let _draft = {};                  // texto en progreso del formulario — sobrevive a un re-render por filtro/recarga
let _weekOffset = 0;              // semanas respecto a la actual, para la vista semanal
const WEEK_START_HOUR = 7;
const WEEK_END_HOUR = 21;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDateOnly(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function fullName(p) { return [p.nombre, p.apellidos].filter(Boolean).join(' '); }
function isPrivileged() { return (getUser()?.nivel_acceso || 0) >= 100; }

function isoDate(d) { return d.toISOString().slice(0, 10); }
function weekBounds(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=domingo..6=sábado
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() + diffToMonday + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return { monday, sunday: days[6], days };
}
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTH_LABELS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="cal-page">${spinner()}</div>`;
  load();
}

async function load() {
  try {
    let params;
    if (_mode === 'week' || _mode === 'weekArea') {
      const { monday, sunday } = weekBounds(_weekOffset);
      params = { date_from: isoDate(monday), date_to: isoDate(sunday) };
      if (_mode === 'week') {
        /* Solo las reuniones propias de quien está logueado — el horario
           de una misma persona nunca se solapa (ya se valida al crear/
           editar), así que esta vista nunca va a mostrar bloques
           superpuestos. */
        params.mine = 'true';
      } else {
        /* Vista semana general: todas las reuniones del área, de
           cualquier participante — estas sí pueden solaparse entre sí
           (dos personas distintas con reuniones a la misma hora), así
           que el render usa un layout de columnas para no superponerlas. */
        params.area = OWN_AREA;
      }
    } else {
      params = { date_from: _filters.date_from || undefined, date_to: _filters.date_to || undefined, status: _filters.status || undefined };
      if (_mode === 'mine') {
        params.mine = 'true';
      } else {
        params.area = _filters.area;
      }
    }
    let meetings = await api.get('/calendar/meetings', params);
    if (_mode !== 'week' && _mode !== 'weekArea') {
      if (_filters.participant) {
        const q = _filters.participant.toLowerCase();
        meetings = meetings.filter(m => (m.participants || []).some(p =>
          (p.user_name || p.external_name || '').toLowerCase().includes(q)));
      }
      if (_filters.type) {
        meetings = meetings.filter(m => (m.meeting_type || '').toLowerCase() === _filters.type.toLowerCase());
      }
    }
    _meetings = meetings;
    renderPage();
  } catch (err) {
    const c = document.getElementById('cal-page');
    if (c) c.innerHTML = `<p class="text-center text-red-400 py-16">${esc(err.message || 'Error al cargar el calendario')}</p>`;
  }
}

function renderPage() {
  const c = document.getElementById('cal-page');
  if (!c) return;

  c.innerHTML = `
  ${pageHeader('Calendario — OTI', `${_meetings.length} reunión${_meetings.length !== 1 ? 'es' : ''}`,
    `<button id="cal-add-btn" class="btn-primary">${icon('add',20)} Agregar reunión</button>`)}

  <div class="sticky top-0 z-20 bg-gray-50 pt-1 pb-3 -mx-6 px-6">
    <div class="flex items-center gap-2 border-b border-gray-200">
      <button type="button" class="cal-tab px-4 py-2 text-sm font-medium border-b-2 ${_mode==='area' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-mode="area">Calendario — OTI</button>
      <button type="button" class="cal-tab px-4 py-2 text-sm font-medium border-b-2 ${_mode==='mine' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-mode="mine">Mi agenda</button>
      <button type="button" class="cal-tab px-4 py-2 text-sm font-medium border-b-2 ${_mode==='week' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-mode="week">Vista semana</button>
      <button type="button" class="cal-tab px-4 py-2 text-sm font-medium border-b-2 ${_mode==='weekArea' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-mode="weekArea">Vista semana general</button>
    </div>
    ${(_mode === 'week' || _mode === 'weekArea') ? '' : `
    <div class="flex flex-wrap gap-3 mt-4">
      ${_mode === 'area' ? `
        <select id="f-area" class="input w-auto">
          ${AREAS.map(([k,l]) => `<option value="${k}" ${_filters.area===k?'selected':''}>${l}</option>`).join('')}
          ${isPrivileged() ? `<option value="ALL" ${_filters.area==='ALL'?'selected':''}>Todas las áreas</option>` : ''}
        </select>` : ''}
      <div class="relative min-w-[180px]">
        <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:16px">search</span>
        <input id="f-participant" class="input pl-8" placeholder="Buscar participante..." value="${esc(_filters.participant)}">
      </div>
      <select id="f-type" class="input w-auto">
        <option value="">Todos los tipos</option>
        ${MEETING_TYPES.map(t => `<option value="${t}" ${_filters.type===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <input type="date" id="f-date-from" class="input w-auto" value="${_filters.date_from}">
      <input type="date" id="f-date-to" class="input w-auto" value="${_filters.date_to}">
      <select id="f-status" class="input w-auto">
        <option value="">Todos los estados</option>
        ${Object.entries(STATUS_LABEL).map(([k,l]) => `<option value="${k}" ${_filters.status===k?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>`}
  </div>

  <div class="mt-5">
  ${_mode === 'week' ? weekViewHtml(false) : _mode === 'weekArea' ? weekViewHtml(true) : `
  <div id="cal-list">${listHtml()}</div>`}
  </div>`;

  wirePage();
}

/* En la vista semana solo se muestran las reuniones propias (ver
   load()), así que colorear por área no sirve para distinguirlas —
   casi siempre serían todas del mismo color. Se colorea por tipo de
   reunión en su lugar, que varía más seguido. */
const MEETING_TYPE_COLORS = {
  'Reunión técnica': 'bg-indigo-500',
  'Planificación': 'bg-sky-500',
  'Revisión': 'bg-rose-500',
  'Incidencia': 'bg-red-600',
  'Coordinación': 'bg-amber-500',
  'Otro': 'bg-violet-500',
};
function meetingTypeColor(type) { return MEETING_TYPE_COLORS[type] || 'bg-slate-500'; }

const WEEK_ROW_H = 48; // px por hora

/* Reparte eventos que se solapan en el tiempo en columnas lado a lado
   (como Google Calendar), para que nunca se dibujen uno encima del
   otro. Agrupa eventos en "racimos" de solapamiento consecutivo y
   dentro de cada racimo asigna la primera columna libre a cada evento
   (algoritmo greedy por orden de inicio). */
function layoutDayEvents(events) {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const placed = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (!cluster.length) return;
    const colEnds = [];
    cluster.forEach(ev => {
      let col = colEnds.findIndex(end => end <= ev.startMin);
      if (col === -1) { col = colEnds.length; colEnds.push(ev.endMin); }
      else { colEnds[col] = ev.endMin; }
      placed.push({ ev, col });
    });
    const totalCols = colEnds.length;
    placed.slice(-cluster.length).forEach(p => { p.totalCols = totalCols; });
    cluster = []; clusterEnd = -Infinity;
  };

  sorted.forEach(ev => {
    if (cluster.length && ev.startMin >= clusterEnd) flushCluster();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  });
  flushCluster();

  return placed;
}

function weekViewHtml(general) {
  const { monday, days } = weekBounds(_weekOffset);
  const hours = [];
  for (let h = WEEK_START_HOUR; h < WEEK_END_HOUR; h++) hours.push(h);
  const rangeLabel = `${monday.getDate()} de ${MONTH_LABELS[monday.getMonth()]}${monday.getMonth() !== days[6].getMonth() ? ' – ' + days[6].getDate() + ' de ' + MONTH_LABELS[days[6].getMonth()] : ' – ' + days[6].getDate()} de ${days[6].getFullYear()}`;
  const todayIso = todayISO();

  const dayCols = days.map((d, i) => {
    const iso = isoDate(d);
    const isToday = iso === todayIso;
    const dayMeetings = _meetings
      .filter(m => m.meeting_date === iso && m.visibility !== 'busy_only')
      .map(m => {
        const [sh, sm] = m.start_time.slice(0,5).split(':').map(Number);
        const [eh, em] = m.end_time.slice(0,5).split(':').map(Number);
        return {
          m,
          startMin: Math.max(0, (sh - WEEK_START_HOUR) * 60 + sm),
          endMin: Math.min((WEEK_END_HOUR - WEEK_START_HOUR) * 60, (eh - WEEK_START_HOUR) * 60 + em),
        };
      });
    const blocks = layoutDayEvents(dayMeetings).map(({ ev, col, totalCols }) => {
      const { m, startMin, endMin } = ev;
      const top = (startMin / 60) * WEEK_ROW_H;
      const height = Math.max(20, ((endMin - startMin) / 60) * WEEK_ROW_H);
      const widthPct = 100 / totalCols;
      const leftPct = col * widthPct;
      const posStyle = totalCols > 1
        ? `left:calc(${leftPct}% + 1px);width:calc(${widthPct}% - 2px)`
        : 'left:2px;right:2px';
      const internalNames = general
        ? (m.participants || []).filter(p => p.participant_type === 'internal').map(p => p.user_name).filter(Boolean)
        : [];
      return `
        <button type="button" class="cal-week-event absolute rounded-md ${meetingTypeColor(m.meeting_type)} text-white text-left px-1.5 py-0.5 overflow-hidden shadow-sm hover:brightness-110" data-id="${m.id}" style="top:${top}px;height:${height}px;${posStyle}">
          <div class="text-[10px] font-semibold leading-tight truncate">${esc(m.title)}</div>
          <div class="text-[9px] opacity-90 leading-tight">${m.start_time.slice(0,5)}–${m.end_time.slice(0,5)}</div>
          ${internalNames.length ? `<div class="text-[9px] opacity-80 leading-tight truncate">${esc(internalNames.join(', '))}</div>` : ''}
        </button>`;
    }).join('');
    return `
      <div class="relative border-l border-gray-100 ${isToday ? 'bg-primary-50/40' : ''}" style="height:${hours.length * WEEK_ROW_H}px">
        ${hours.map((_, hi) => `<div class="absolute left-0 right-0 border-t border-gray-100" style="top:${hi * WEEK_ROW_H}px"></div>`).join('')}
        ${blocks}
      </div>`;
  }).join('');

  const dayHeaders = days.map((d, i) => {
    const iso = isoDate(d);
    const isToday = iso === todayIso;
    return `
      <div class="text-center py-2 border-l border-gray-100 ${isToday ? 'bg-primary-50/40' : ''}">
        <div class="text-[11px] text-gray-400 uppercase">${WEEKDAY_LABELS[i]}</div>
        <div class="text-sm font-semibold ${isToday ? 'text-primary-700' : 'text-gray-700'}">${d.getDate()}</div>
      </div>`;
  }).join('');

  return `
  <div class="card p-0 overflow-hidden">
    ${general ? `<div class="px-4 pt-3 text-xs font-medium text-gray-500">Todas las reuniones del área OTI — eventos que se cruzan en horario se muestran lado a lado</div>` : ''}
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <button type="button" id="week-today-btn" class="btn-secondary text-xs px-3 py-1.5">Hoy</button>
      <div class="flex items-center gap-2">
        <button type="button" id="week-prev-btn" class="p-1.5 rounded hover:bg-gray-100 text-gray-500">${icon('chevron_left',18)}</button>
        <span class="text-sm font-medium text-gray-700">${rangeLabel}</span>
        <button type="button" id="week-next-btn" class="p-1.5 rounded hover:bg-gray-100 text-gray-500">${icon('chevron_right',18)}</button>
      </div>
      <div class="w-[72px]"></div>
    </div>
    <div class="overflow-x-auto">
      <div class="grid" style="grid-template-columns:56px repeat(7,minmax(110px,1fr));min-width:820px">
        <div></div>${dayHeaders}
        <div class="relative" style="height:${hours.length * WEEK_ROW_H}px">
          ${hours.map((h, hi) => `<div class="absolute left-0 right-0 text-right pr-2 text-[11px] text-gray-400 -translate-y-1/2" style="top:${hi * WEEK_ROW_H}px">${String(h).padStart(2,'0')}:00</div>`).join('')}
        </div>
        ${dayCols}
      </div>
    </div>
  </div>`;
}

function listHtml() {
  if (!_meetings.length) return '<div class="card p-12 text-center text-gray-400">No hay reuniones en este rango</div>';
  const groups = {};
  _meetings.forEach(m => { (groups[m.meeting_date] ||= []).push(m); });
  return Object.entries(groups).map(([date, items]) => `
    <div class="mb-5">
      <h4 class="text-sm font-semibold text-gray-500 mb-2">${fmtDateOnly(date)}</h4>
      <div class="space-y-2">${items.map(meetingCard).join('')}</div>
    </div>`).join('');
}

function meetingCard(m) {
  const isBusy = m.visibility === 'busy_only';
  const participantsHtml = (m.participants || []).map(p => {
    const label = p.participant_type === 'external'
      ? `${esc(p.external_name)} (${EXTERNAL_KINDS.find(k=>k[0]===p.external_kind)?.[1] || p.external_kind})`
      : `${esc(p.user_name || '—')}${p.user_area ? ' — ' + esc(p.user_area) : ''}${p.user_cargo ? ' — ' + esc(p.user_cargo) : ''}`;
    return label;
  }).join('<br>');
  const statusBadge = m.status === 'cancelled'
    ? '<span class="badge bg-red-50 text-red-600">Cancelada</span>'
    : m.status === 'completed' ? '<span class="badge bg-gray-100 text-gray-500">Finalizada</span>'
    : '<span class="badge bg-green-50 text-green-700">Programada</span>';
  const areaBadge = `<span class="badge bg-indigo-50 text-indigo-700">${esc(m.area)}</span>`;

  return `
  <div class="card p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="font-semibold text-gray-900">${esc(m.title)}</h4>
          ${areaBadge} ${statusBadge} ${modalityIconHtml(m)}
          ${isBusy ? `<span class="badge bg-gray-100 text-gray-500">${icon('lock',12)} Privada</span>` : ''}
        </div>
        <p class="text-xs text-gray-500 mt-1">${m.start_time.slice(0,5)} — ${m.end_time.slice(0,5)}${m.meeting_type ? ' · ' + esc(m.meeting_type) : ''}</p>
        ${!isBusy && m.motivo ? `<p class="text-sm text-gray-600 mt-2">${esc(m.motivo)}</p>` : ''}
        ${!isBusy && participantsHtml ? `<div class="text-xs text-gray-500 mt-2">${participantsHtml}</div>` : ''}
        ${isBusy ? '<p class="text-xs text-gray-400 mt-2">Sin acceso al detalle de esta reunión</p>' : ''}
      </div>
      ${!isBusy ? `
      <div class="flex gap-1 shrink-0">
        <button type="button" class="cal-view-btn p-1.5 rounded hover:bg-gray-100 text-gray-400" data-id="${m.id}" title="Ver detalle">${icon('visibility',16)}</button>
        <button type="button" class="cal-edit-btn p-1.5 rounded hover:bg-gray-100 text-gray-400" data-id="${m.id}" title="Editar">${icon('edit',16)}</button>
        <button type="button" class="cal-cancel-btn p-1.5 rounded hover:bg-yellow-50 text-gray-400 hover:text-yellow-600" data-id="${m.id}" title="Cancelar">${icon('event_busy',16)}</button>
        <button type="button" class="cal-del-btn p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" data-id="${m.id}" title="Eliminar">${icon('delete',16)}</button>
      </div>` : ''}
    </div>
  </div>`;
}

function formHtml() {
  const editing = _meetings.find(m => m.id === _editingId);
  const fv = (name, fallback) => esc(_draft[name] ?? fallback ?? '');
  const currentImage = _draft.image_url !== undefined ? _draft.image_url : (editing?.image_url || null);
  return `
    <form id="cal-form" class="grid lg:grid-cols-2 gap-5 items-start">
      <div id="cal-agenda"></div>
      <div class="space-y-3">
      <div>
        <label class="text-xs font-medium text-gray-600">Nombre de la reunión *</label>
        <input name="title" class="input text-sm w-full mt-1" required autocomplete="off" value="${fv('title', editing?.title)}">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-xs font-medium text-gray-600">Tipo de reunión</label>
          <select name="meeting_type" class="input text-sm w-full mt-1">
            <option value="">— Seleccionar —</option>
            ${MEETING_TYPES.map(t => `<option value="${t}" ${(_draft.meeting_type ?? editing?.meeting_type)===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Modalidad</label>
          <select name="modality" id="cal-in-modality" class="input text-sm w-full mt-1">
            <option value="presencial" ${(_draft.modality ?? editing?.modality ?? 'presencial')==='presencial'?'selected':''}>Presencial</option>
            <option value="virtual" ${(_draft.modality ?? editing?.modality)==='virtual'?'selected':''}>Virtual</option>
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Motivo</label>
        <input name="motivo" class="input text-sm w-full mt-1" autocomplete="off" value="${fv('motivo', editing?.motivo)}">
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Descripción</label>
        <textarea name="description" class="input text-sm w-full mt-1" rows="2">${fv('description', editing?.description)}</textarea>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600" id="cal-location-label">${(_draft.modality ?? editing?.modality ?? 'presencial')==='virtual' ? 'Link de la reunión' : 'Dirección'}</label>
        <input name="location" class="input text-sm w-full mt-1" placeholder="${(_draft.modality ?? editing?.modality ?? 'presencial')==='virtual' ? 'Link de Zoom, Meet, Teams...' : 'Sala de reuniones, dirección...'}" autocomplete="off" value="${fv('location', editing?.location)}">
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Imagen del evento (opcional)</label>
        ${currentImage ? `
          <div class="relative inline-block mb-1.5">
            <img src="${esc(currentImage)}" class="rounded-lg max-h-28 border border-gray-200">
            <button type="button" id="cal-image-remove" class="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow p-0.5 text-gray-500 hover:text-red-600">${icon('close',14)}</button>
          </div>` : ''}
        <input type="file" id="cal-image-input" accept="image/*" class="text-xs w-full">
        <p id="cal-image-status" class="text-[11px] text-gray-400 mt-1"></p>
      </div>

      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Participantes internos</label>
        <div class="relative">
          <input id="cal-participant-search" class="input text-sm w-full" placeholder="Buscar por nombre, cargo o área..." autocomplete="off">
          <div id="cal-dir-results" class="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto hidden"></div>
        </div>
        <div id="cal-selected-participants" class="flex flex-wrap gap-1.5 mt-2">${selectedParticipantsHtml()}</div>
      </div>

      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Participante externo (cliente, postulante, proveedor...)</label>
        <div class="flex gap-2">
          <input id="cal-ext-name" class="input text-sm flex-1" placeholder="Nombre" autocomplete="off">
          <select id="cal-ext-kind" class="input text-sm w-auto">
            ${EXTERNAL_KINDS.map(([k,l]) => `<option value="${k}">${l}</option>`).join('')}
          </select>
          <button type="button" id="cal-ext-add" class="btn-secondary text-xs px-3">${icon('add',16)}</button>
        </div>
        <div id="cal-selected-externals" class="flex flex-wrap gap-1.5 mt-2">${selectedExternalsHtml()}</div>
      </div>

      <div id="cal-conflict-banner">${conflictBannerHtml()}</div>
      <div class="flex gap-2 pt-1">
        <button type="submit" id="cal-save-btn" class="btn-primary text-sm flex-1 justify-center" ${_conflicts.length ? 'disabled' : ''}>${editing ? 'Guardar cambios' : 'Guardar reunión'}</button>
        <button type="button" id="cal-form-cancel" class="btn-secondary text-sm">Cancelar</button>
      </div>
      </div>
    </form>`;
}

function openFormModal() {
  const editing = _meetings.find(m => m.id === _editingId);
  iniciarAgenda({
    area: OWN_AREA, areaLabel: AREA_LABEL,
    fecha: _draft.date ?? editing?.meeting_date ?? '',
    inicio: _draft.start_time ?? (editing ? editing.start_time.slice(0, 5) : ''),
    fin: _draft.end_time ?? (editing ? editing.end_time.slice(0, 5) : ''),
    excluirReunion: _editingId || null,
  });
  showModal(editing ? 'Editar reunión' : 'Nueva reunión', formHtml(), '2xl');
  document.getElementById('cal-form-cancel')?.addEventListener('click', closeModal);
  wireFormExtras();
  wireFormDraftCapture();
  wireImageControls();
  mountAgenda();
}

const AREA_LABEL = (AREAS.find(a => a[0] === OWN_AREA) || [OWN_AREA, OWN_AREA])[1];

/* Agenda del área (fecha, hora y quién está libre): escribe fecha y horario
   en el formulario y permite sumar a los integrantes libres como participantes. */
function mountAgenda() {
  const cont = document.getElementById('cal-agenda');
  if (!cont) return;
  montarAgenda(cont, {
    seleccionados: () => _selectedParticipants.map(p => p.user_id),
    alCambiarHorario: ({ date, start_time, end_time }) => {
      _draft.date = date; _draft.start_time = start_time; _draft.end_time = end_time;
      liveCheck();
    },
    alMarcarPersona: (m, agregar) => {
      if (agregar) {
        if (!_selectedParticipants.some(p => String(p.user_id) === String(m.user_id))) {
          _selectedParticipants.push({ user_id: m.user_id, nombre: m.nombre, apellidos: m.apellidos, cargo: m.cargo, area: AREA_LABEL });
        }
      } else {
        _selectedParticipants = _selectedParticipants.filter(p => String(p.user_id) !== String(m.user_id));
      }
      refreshParticipants();
    },
  });
}

function refreshParticipants() {
  const box = document.getElementById('cal-selected-participants');
  if (box) box.innerHTML = selectedParticipantsHtml();
  wireRemoveParticipants();
  liveCheck();
}

function selectedParticipantsHtml() {
  if (!_selectedParticipants.length) return '<p class="text-xs text-gray-400">Sin participantes internos</p>';
  return _selectedParticipants.map(p => `
    <span class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
      ${esc(fullName(p))}${p.area ? ' — ' + esc(p.area) : ''}
      <button type="button" class="cal-remove-participant text-indigo-300 hover:text-red-500 flex items-center" data-id="${p.user_id}">${icon('close',12)}</button>
    </span>`).join('');
}

function selectedExternalsHtml() {
  if (!_externalParticipants.length) return '';
  return _externalParticipants.map((p, i) => `
    <span class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
      ${esc(p.name)} (${EXTERNAL_KINDS.find(k=>k[0]===p.kind)?.[1] || p.kind})
      <button type="button" class="cal-remove-external text-amber-300 hover:text-red-500 flex items-center" data-i="${i}">${icon('close',12)}</button>
    </span>`).join('');
}

/* _conflicts trae conflictos "hard" (misma modalidad presencial,
   bloquean guardar) y "soft" (modalidad mixta — una presencial y otra
   virtual —, solo se avisa pero sí se puede guardar e inscribir a la
   persona en ambas). Se muestran en dos bloques separados. */
function conflictBannerHtml() {
  if (!_conflicts.length) return '';
  const hard = _conflicts.filter(c => c.hard);
  const soft = _conflicts.filter(c => !c.hard);
  const item = c => `<li>${esc(c.user_name || 'Alguien')} (${esc(c.area || '—')}) ya tiene "${esc(c.meeting_name)}" (${MODALITY_LABEL[c.modality] || 'Presencial'}) de ${c.start_time.slice(0,5)} a ${c.end_time.slice(0,5)} (${fmtDateOnly(c.date)}).</li>`;
  return `
  ${hard.length ? `
  <div class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
    <p class="font-semibold flex items-center gap-1.5">${icon('warning',16)} ${hard.length > 1 ? 'Se encontraron ' + hard.length + ' conflictos de horario:' : 'Conflicto de horario'}</p>
    <ul class="mt-1.5 space-y-1 list-disc list-inside">${hard.map(item).join('')}</ul>
  </div>` : ''}
  ${soft.length ? `
  <div class="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 ${hard.length ? 'mt-2' : ''}">
    <p class="font-semibold flex items-center gap-1.5">${icon('warning',16)} ${soft.length > 1 ? 'Hay ' + soft.length + ' cruces de horario (modalidad mixta)' : 'Hay un cruce de horario (modalidad mixta)'}</p>
    <ul class="mt-1.5 space-y-1 list-disc list-inside">${soft.map(item).join('')}</ul>
    <p class="mt-1.5 text-xs">Al ser una presencial y una virtual, igual puedes guardar e inscribir a la persona en ambas.</p>
  </div>` : ''}`;
}

function wirePage() {
  document.querySelectorAll('.cal-tab').forEach(btn => btn.addEventListener('click', () => {
    _mode = btn.dataset.mode;
    if (_mode === 'week' || _mode === 'weekArea') _weekOffset = 0;
    load();
  }));

  const weekPrev = document.getElementById('week-prev-btn');
  if (weekPrev) weekPrev.addEventListener('click', () => { _weekOffset--; load(); });
  const weekNext = document.getElementById('week-next-btn');
  if (weekNext) weekNext.addEventListener('click', () => { _weekOffset++; load(); });
  const weekToday = document.getElementById('week-today-btn');
  if (weekToday) weekToday.addEventListener('click', () => { _weekOffset = 0; load(); });
  document.querySelectorAll('.cal-week-event').forEach(btn => btn.addEventListener('click', () => viewMeeting(btn.dataset.id)));

  const areaSel = document.getElementById('f-area');
  if (areaSel) areaSel.addEventListener('change', e => { _filters.area = e.target.value; load(); });

  const partInput = document.getElementById('f-participant');
  if (partInput) partInput.addEventListener('input', e => {
    clearTimeout(_filterDebounce);
    _filterDebounce = setTimeout(() => { _filters.participant = e.target.value; load(); }, 300);
  });
  const typeSel = document.getElementById('f-type');
  if (typeSel) typeSel.addEventListener('change', e => { _filters.type = e.target.value; load(); });
  const dateFrom = document.getElementById('f-date-from');
  if (dateFrom) dateFrom.addEventListener('change', e => { _filters.date_from = e.target.value; load(); });
  const dateTo = document.getElementById('f-date-to');
  if (dateTo) dateTo.addEventListener('change', e => { _filters.date_to = e.target.value; load(); });
  const statusSel = document.getElementById('f-status');
  if (statusSel) statusSel.addEventListener('change', e => { _filters.status = e.target.value; load(); });

  const addBtn = document.getElementById('cal-add-btn');
  if (addBtn) addBtn.addEventListener('click', () => {
    _editingId = null; _selectedParticipants = []; _externalParticipants = []; _conflicts = []; _draft = {};
    openFormModal();
  });

  document.querySelectorAll('.cal-view-btn').forEach(btn => btn.addEventListener('click', () => viewMeeting(btn.dataset.id)));
  document.querySelectorAll('.cal-edit-btn').forEach(btn => btn.addEventListener('click', () => editMeeting(btn.dataset.id)));
  document.querySelectorAll('.cal-cancel-btn').forEach(btn => btn.addEventListener('click', () => cancelMeeting(btn.dataset.id)));
  document.querySelectorAll('.cal-del-btn').forEach(btn => btn.addEventListener('click', () => deleteMeeting(btn.dataset.id)));
}

/* Guarda lo que se va escribiendo en un estado aparte (_draft) — si la
   lista se recarga por un filtro mientras el panel sigue abierto, el
   re-render del formulario no borra lo que ya se había tecleado. Se
   vuelve a llamar cada vez que se regenera el HTML del panel (subir
   imagen, quitar imagen), no solo en el render inicial. */
function wireFormDraftCapture() {
  const form = document.getElementById('cal-form');
  if (!form) return;
  const captureDraft = e => { if (e.target.name) _draft[e.target.name] = e.target.value; };
  form.addEventListener('input', captureDraft);
  form.addEventListener('change', captureDraft);
  ['date', 'start_time', 'end_time', 'modality'].forEach(name => {
    const el = form.elements[name];
    if (el) el.addEventListener('change', liveCheck);
  });
  form.elements.modality?.addEventListener('change', updateLocationField);
  form.addEventListener('submit', submitForm);
}

/* La Ubicación es el mismo campo para ambas modalidades, pero cambia
   de significado: en Presencial es una dirección física, en Virtual es
   el link de ingreso — solo se le cambia la etiqueta/placeholder. */
function updateLocationField() {
  const form = document.getElementById('cal-form');
  if (!form) return;
  const isVirtual = form.elements.modality.value === 'virtual';
  const label = document.getElementById('cal-location-label');
  if (label) label.textContent = isVirtual ? 'Link de la reunión' : 'Dirección';
  const input = form.elements.location;
  if (input) input.placeholder = isVirtual ? 'Link de Zoom, Meet, Teams...' : 'Sala de reuniones, dirección...';
}

function rerenderFormModal() {
  const body = document.getElementById('modal-body');
  if (!body) return;
  body.innerHTML = formHtml();
  document.getElementById('cal-form-cancel')?.addEventListener('click', closeModal);
  wireFormExtras();
  wireFormDraftCapture();
  wireImageControls();
  mountAgenda();
}

function wireImageControls() {
  const imageInput = document.getElementById('cal-image-input');
  if (imageInput) imageInput.addEventListener('change', handleImageUpload);
  const imageRemove = document.getElementById('cal-image-remove');
  if (imageRemove) imageRemove.addEventListener('click', () => {
    _draft.image_url = null;
    rerenderFormModal();
  });
}

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById('cal-image-status');
  if (status) status.textContent = 'Subiendo imagen...';
  try {
    const fd = new FormData();
    fd.append('image', file);
    const data = await api.post('/calendar/meetings/image', fd);
    _draft.image_url = data.url;
    rerenderFormModal();
    toast('Imagen subida');
  } catch (err) {
    if (status) status.textContent = '';
    toast(err.message || 'No se pudo subir la imagen', 'error');
  }
}

function wireFormExtras() {
  const search = document.getElementById('cal-participant-search');
  const results = document.getElementById('cal-dir-results');
  if (search) {
    search.addEventListener('input', () => {
      clearTimeout(_dirDebounce);
      const q = search.value.trim();
      if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
      _dirDebounce = setTimeout(async () => {
        try {
          _dirResults = await api.get('/calendar/directory', { q });
          results.innerHTML = _dirResults.length
            ? _dirResults.map(p => `
                <button type="button" class="cal-dir-pick w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between" data-id="${p.user_id}">
                  <span>${esc(fullName(p))}</span>
                  <span class="text-xs text-gray-400">${esc(p.area || '—')}${p.cargo ? ' · ' + esc(p.cargo) : ''}</span>
                </button>`).join('')
            : '<p class="px-3 py-2 text-xs text-gray-400">Sin resultados</p>';
          results.classList.remove('hidden');
          results.querySelectorAll('.cal-dir-pick').forEach(btn => btn.addEventListener('click', () => {
            const person = _dirResults.find(p => String(p.user_id) === btn.dataset.id);
            if (person && !_selectedParticipants.some(p => p.user_id === person.user_id)) {
              _selectedParticipants.push(person);
              refreshParticipants();
              repintarAgenda();
            }
            search.value = ''; results.classList.add('hidden'); results.innerHTML = '';
          }));
        } catch { /* silencioso */ }
      }, 250);
    });
  }
  wireRemoveParticipants();

  const extAdd = document.getElementById('cal-ext-add');
  if (extAdd) extAdd.addEventListener('click', () => {
    const nameEl = document.getElementById('cal-ext-name');
    const kindEl = document.getElementById('cal-ext-kind');
    const name = nameEl.value.trim();
    if (!name) return;
    _externalParticipants.push({ name, kind: kindEl.value });
    nameEl.value = '';
    document.getElementById('cal-selected-externals').innerHTML = selectedExternalsHtml();
    wireRemoveExternals();
  });
  wireRemoveExternals();
}

function wireRemoveParticipants() {
  document.querySelectorAll('.cal-remove-participant').forEach(btn => btn.addEventListener('click', () => {
    _selectedParticipants = _selectedParticipants.filter(p => String(p.user_id) !== btn.dataset.id);
    refreshParticipants();
    repintarAgenda();
  }));
}
function wireRemoveExternals() {
  document.querySelectorAll('.cal-remove-external').forEach(btn => btn.addEventListener('click', () => {
    _externalParticipants.splice(Number(btn.dataset.i), 1);
    document.getElementById('cal-selected-externals').innerHTML = selectedExternalsHtml();
    wireRemoveExternals();
  }));
}

async function liveCheck() {
  const form = document.getElementById('cal-form');
  if (!form) return;
  const date = form.elements.date.value;
  const start = form.elements.start_time.value;
  const end = form.elements.end_time.value;
  const modality = form.elements.modality?.value || 'presencial';
  const ids = _selectedParticipants.map(p => p.user_id);
  const saveBtn = document.getElementById('cal-save-btn');

  if (!date || !start || !end || !ids.length || end <= start) {
    _conflicts = [];
    const banner = document.getElementById('cal-conflict-banner');
    if (banner) banner.innerHTML = '';
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  const token = ++_checkToken;
  let conflicts = [];
  try {
    const res = await api.post('/calendar/check-availability', {
      date, start_time: start, end_time: end, participant_ids: ids, exclude_meeting_id: _editingId || undefined, modality,
    });
    conflicts = res.conflicts || [];
  } catch { conflicts = []; }
  if (token !== _checkToken) return;
  _conflicts = conflicts;
  const banner = document.getElementById('cal-conflict-banner');
  if (banner) banner.innerHTML = conflictBannerHtml();
  const saveBtnEl = document.getElementById('cal-save-btn');
  // Solo los conflictos "hard" (misma modalidad presencial) bloquean
  // guardar — los "soft" (modalidad mixta) solo avisan.
  if (saveBtnEl) saveBtnEl.disabled = _conflicts.some(c => c.hard);
}

async function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const title = form.elements.title.value.trim();
  const date = form.elements.date.value;
  const start_time = form.elements.start_time.value;
  const end_time = form.elements.end_time.value;
  const meeting_type = form.elements.meeting_type.value;
  const modality = form.elements.modality.value;
  const location = form.elements.location.value.trim();
  const motivo = form.elements.motivo.value.trim();
  const description = form.elements.description.value.trim();

  if (!title) return toast('El nombre de la reunión es requerido', 'error');
  if (!date || !start_time || !end_time) return toast('Elige en la agenda el día y el horario de la reunión', 'error');
  if (end_time <= start_time) return toast('La hora de fin debe ser posterior a la de inicio', 'error');
  if (!_selectedParticipants.length && !_externalParticipants.length) return toast('Selecciona al menos un participante', 'error');

  const editing = _meetings.find(m => m.id === _editingId);
  const image_url = _draft.image_url !== undefined ? _draft.image_url : (editing?.image_url || null);

  const payload = {
    title, date, start_time, end_time, meeting_type, modality, location, motivo, description, image_url,
    participants: _selectedParticipants.map(p => ({ user_id: p.user_id })),
    external_participants: _externalParticipants,
  };

  try {
    if (_editingId) {
      await api.put(`/calendar/meetings/${_editingId}`, payload);
      toast('Reunión actualizada');
    } else {
      await api.post('/calendar/meetings', payload);
      toast('Reunión programada');
    }
    closeModal(); _editingId = null; _conflicts = []; _draft = {};
    await load();
  } catch (err) {
    if (err.response?.data?.conflicts) {
      _conflicts = err.response.data.conflicts;
      const banner = document.getElementById('cal-conflict-banner');
      if (banner) banner.innerHTML = conflictBannerHtml();
      const saveBtn = document.getElementById('cal-save-btn');
      if (saveBtn) saveBtn.disabled = true;
    }
    toast(err.message || 'Error', 'error');
  }
}

function editMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || m.visibility === 'busy_only') return;
  _editingId = id;
  _selectedParticipants = (m.participants || [])
    .filter(p => p.participant_type === 'internal')
    .map(p => ({ user_id: p.user_id, nombre: p.user_name, area: p.user_area, cargo: p.user_cargo }));
  _externalParticipants = (m.participants || [])
    .filter(p => p.participant_type === 'external')
    .map(p => ({ name: p.external_name, kind: p.external_kind }));
  _conflicts = [];
  _draft = {};
  openFormModal();
}

async function cancelMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || !(await confirmModal(`¿Deseas cancelar la reunión "${m.title}"? Se liberará el horario de los participantes.`, { title: 'Cancelar reunión', confirmLabel: 'Sí, cancelar' }))) return;
  try {
    await api.post(`/calendar/meetings/${id}/cancel`);
    toast('Reunión cancelada');
    await load();
  } catch (err) { toast(err.message || 'Error', 'error'); }
}

async function deleteMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || !(await confirmModal(`¿Deseas eliminar la reunión "${m.title}"? Esta acción no se puede deshacer.`))) return;
  try {
    await api.delete(`/calendar/meetings/${id}`);
    toast('Reunión eliminada');
    if (_editingId === id) { closeModal(); _editingId = null; }
    await load();
  } catch (err) { toast(err.message || 'Error', 'error'); }
}

function viewMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || m.visibility === 'busy_only') return;
  const participantsHtml = (m.participants || []).map(p => {
    const label = p.participant_type === 'external'
      ? `${esc(p.external_name)} — ${EXTERNAL_KINDS.find(k=>k[0]===p.external_kind)?.[1] || p.external_kind} (externo)`
      : `${esc(p.user_name || '—')}${p.user_area ? ' — ' + esc(p.user_area) : ''}${p.user_cargo ? ' — ' + esc(p.user_cargo) : ''}`;
    return `<li>${label}</li>`;
  }).join('');
  showModal(esc(m.title), `
    <div class="space-y-3 text-sm">
      ${m.image_url ? `<img src="${esc(m.image_url)}" class="w-full max-h-64 object-cover rounded-lg border border-gray-200">` : ''}
      <p>${modalityIconHtml(m)}</p>
      <p><span class="font-medium text-gray-700">Área:</span> ${esc(m.area)}</p>
      <p><span class="font-medium text-gray-700">Fecha:</span> ${fmtDateOnly(m.meeting_date)}</p>
      <p><span class="font-medium text-gray-700">Horario:</span> ${m.start_time.slice(0,5)} — ${m.end_time.slice(0,5)}</p>
      ${m.meeting_type ? `<p><span class="font-medium text-gray-700">Tipo:</span> ${esc(m.meeting_type)}</p>` : ''}
      ${m.location ? `<p><span class="font-medium text-gray-700">${m.modality === 'virtual' ? 'Link' : 'Dirección'}:</span> ${esc(m.location)}</p>` : ''}
      ${m.motivo ? `<p><span class="font-medium text-gray-700">Motivo:</span> ${esc(m.motivo)}</p>` : ''}
      ${m.description ? `<div><span class="font-medium text-gray-700">Descripción:</span><p class="mt-1 text-gray-600" style="white-space:pre-wrap">${esc(m.description)}</p></div>` : ''}
      <div>
        <p class="font-medium text-gray-700 mb-1">Participantes:</p>
        <ul class="list-disc list-inside text-gray-600">${participantsHtml || '<li>Sin participantes</li>'}</ul>
      </div>
      <p class="text-xs text-gray-400">Programada por ${esc(m.created_by_name || '—')}</p>
    </div>
  `, 'md');
}
