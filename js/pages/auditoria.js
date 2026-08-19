import { api }        from '../api.js';
import { getUser }    from '../state.js';
import { pageHeader, spinner } from '../utils.js';

const AREAS = [['TI','TI'],['ADG','ADG'],['RRHH','RR. HH.'],['SOPORTE','Soporte']];
const QUALIFYING_CARGOS = ['SUPERVISOR', 'COORDINADOR', 'GERENTE'];
const ACTION_LABEL = { view: 'Consultó', create: 'Creó', update: 'Actualizó', delete: 'Eliminó', login: 'Inició sesión', logout: 'Cerró sesión' };
const ACTION_COLOR = {
  view: 'bg-gray-100 text-gray-600', create: 'bg-green-100 text-green-700', update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700', login: 'bg-indigo-100 text-indigo-700', logout: 'bg-amber-100 text-amber-700',
};

let _rows = [];
let _total = 0;
let _offset = 0;
const PAGE_SIZE = 50;
/* canSeeOtherAreas la decide el backend (solo ADG o nivel_acceso>=100
   pueden ver otras áreas / un rango de fechas distinto a hoy) — se lee
   de la respuesta, no se asume nada del lado del cliente. */
let _canSeeOtherAreas = false;
let _filters = { area: '', action_type: '', date_from: todayISO(), date_to: '', q: '' };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function canViewAudit() {
  const u = getUser();
  if (!u) return false;
  if ((u.nivel_acceso || 0) >= 100) return true;
  return QUALIFYING_CARGOS.includes(String(u.cargo || '').toUpperCase());
}

export function render() {
  const c = document.getElementById('main');
  if (!canViewAudit()) {
    c.innerHTML = `<div class="p-8">
      ${pageHeader('Auditoría', '')}
      <div class="card p-8 text-center text-gray-400">No tienes permiso para ver la auditoría.</div>
    </div>`;
    return;
  }
  c.innerHTML = `<div class="p-8">${pageHeader('Auditoría', 'Registro de movimientos del sistema')}<div id="audit-page">${spinner()}</div></div>`;
  _offset = 0;
  load();
}

async function load(append = false) {
  try {
    const params = {
      action_type: _filters.action_type || undefined,
      date_from: _filters.date_from || undefined,
      date_to: _filters.date_to || undefined,
      q: _filters.q || undefined,
      limit: PAGE_SIZE, offset: _offset,
    };
    if (_canSeeOtherAreas && _filters.area) params.area = _filters.area;
    const data = await api.get('/audit/logs', params);
    _rows = append ? [..._rows, ...data.rows] : data.rows;
    _total = data.total;
    _canSeeOtherAreas = !!data.canSeeOtherAreas;
    if (!_canSeeOtherAreas) { _filters.date_from = todayISO(); _filters.date_to = ''; _filters.area = ''; }
    renderPage();
  } catch (err) {
    const c = document.getElementById('audit-page');
    if (c) c.innerHTML = `<p class="text-center text-red-400 py-16">${esc(err.message || 'Error al cargar la auditoría')}</p>`;
  }
}

function renderPage() {
  const c = document.getElementById('audit-page');
  if (!c) return;
  c.innerHTML = `
  <div class="flex flex-wrap items-center gap-3 mb-5">
    ${_canSeeOtherAreas ? `
    <select id="f-area" class="input w-auto">
      <option value="">Mi área</option>
      ${AREAS.map(([k,l]) => `<option value="${k}" ${_filters.area===k?'selected':''}>${l}</option>`).join('')}
      <option value="ALL" ${_filters.area==='ALL'?'selected':''}>Todas las áreas</option>
    </select>` : ''}
    <select id="f-action" class="input w-auto">
      <option value="">Todas las acciones</option>
      ${Object.entries(ACTION_LABEL).map(([k,l]) => `<option value="${k}" ${_filters.action_type===k?'selected':''}>${l}</option>`).join('')}
    </select>
    ${_canSeeOtherAreas ? `
    <input type="date" id="f-date-from" class="input w-auto" value="${_filters.date_from}">
    <input type="date" id="f-date-to" class="input w-auto" value="${_filters.date_to}">
    ` : `<span class="text-xs text-gray-400">Solo se puede ver el día de hoy y tu propia área</span>`}
    <input id="f-q" class="input w-auto" placeholder="Buscar en la ruta..." value="${esc(_filters.q)}">
  </div>

  <div class="card divide-y divide-gray-100">
    <div class="grid grid-cols-[160px_1fr_100px_110px_1fr] gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
      <span>Fecha</span><span>Usuario</span><span>Área</span><span>Acción</span><span>Detalle</span>
    </div>
    ${_rows.length === 0 ? '<p class="text-center text-gray-400 py-10 text-sm">Sin movimientos en este rango</p>' : _rows.map(rowHtml).join('')}
  </div>

  <div class="flex items-center justify-between mt-4 text-sm text-gray-500">
    <span>${_rows.length} de ${_total}</span>
    ${_rows.length < _total ? `<button id="audit-load-more" class="btn-secondary text-xs px-3 py-1.5">Cargar más</button>` : ''}
  </div>`;
  wire();
}

function changeValueText(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function changesHtml(changes) {
  if (!changes || typeof changes !== 'object') return '';
  const entries = Object.entries(changes);
  if (!entries.length) return '';
  return `<div class="flex flex-wrap gap-1 mt-1.5">
    ${entries.map(([k, v]) => `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[11px] text-gray-600">
      <strong class="text-gray-700">${esc(k)}:</strong> ${esc(changeValueText(v))}
    </span>`).join('')}
  </div>`;
}

function rowHtml(r) {
  const badge = ACTION_COLOR[r.action_type] || 'bg-gray-100 text-gray-600';
  return `
  <div class="grid grid-cols-[160px_1fr_100px_110px_1fr] gap-3 px-4 py-2.5 text-sm items-start">
    <span class="text-gray-500 text-xs pt-0.5">${fmtDateTime(r.created_at)}</span>
    <span class="text-gray-800 truncate pt-0.5">${esc(r.user_name || r.username || '—')}</span>
    <span class="text-gray-500 text-xs pt-0.5">${esc(r.area || '—')}</span>
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge} w-fit">${esc(ACTION_LABEL[r.action_type] || r.action_type)}</span>
    <div class="min-w-0">
      <span class="text-gray-500 text-xs truncate block" title="${esc(r.full_path || r.path)}">${esc(r.description)} <span class="text-gray-300">· ${esc(r.method)} ${esc(r.full_path || r.path)}</span></span>
      ${changesHtml(r.changes)}
    </div>
  </div>`;
}

function wire() {
  document.getElementById('f-area')?.addEventListener('change', e => { _filters.area = e.target.value; _offset = 0; load(); });
  document.getElementById('f-action')?.addEventListener('change', e => { _filters.action_type = e.target.value; _offset = 0; load(); });
  document.getElementById('f-date-from')?.addEventListener('change', e => { _filters.date_from = e.target.value; _offset = 0; load(); });
  document.getElementById('f-date-to')?.addEventListener('change', e => { _filters.date_to = e.target.value; _offset = 0; load(); });
  let qDebounce;
  document.getElementById('f-q')?.addEventListener('input', e => {
    clearTimeout(qDebounce);
    qDebounce = setTimeout(() => { _filters.q = e.target.value; _offset = 0; load(); }, 350);
  });
  document.getElementById('audit-load-more')?.addEventListener('click', () => { _offset += PAGE_SIZE; load(true); });
}
