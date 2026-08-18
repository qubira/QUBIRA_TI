import { api }        from '../api.js';
import { getUser }    from '../state.js';
import { toast, showModal, closeModal, pageHeader, spinner, icon } from '../utils.js';

const OWN_AREA = 'TI';
const AREAS = [['TI','TI'],['ADG','ADG'],['RRHH','RR. HH.'],['SOPORTE','Soporte']];
const MEETING_TYPES = ['Reunión técnica','Planificación','Revisión','Incidencia','Coordinación','Otro'];
const EXTERNAL_KINDS = [['cliente','Cliente'],['postulante','Postulante'],['proveedor','Proveedor'],['consultor','Consultor'],['otro','Otro']];
const STATUS_LABEL = { scheduled:'Programada', confirmed:'Confirmada', in_progress:'En curso', completed:'Finalizada', cancelled:'Cancelada' };

let _mode = 'area';               // 'area' | 'mine'
let _filters = { area: OWN_AREA, participant: '', type: '', date_from: todayISO(), date_to: '', status: '' };
let _meetings = [];
let _formOpen = false;
let _editingId = null;
let _conflicts = [];
let _selectedParticipants = [];   // [{user_id, nombre, apellidos, area, cargo, role?}]
let _externalParticipants = [];   // [{name, kind}]
let _dirResults = [];
let _dirDebounce, _filterDebounce;
let _checkToken = 0;

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

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="cal-page">${spinner()}</div>`;
  load();
}

async function load() {
  try {
    const params = { date_from: _filters.date_from || undefined, date_to: _filters.date_to || undefined, status: _filters.status || undefined };
    if (_mode === 'mine') {
      params.mine = 'true';
    } else {
      params.area = _filters.area;
    }
    let meetings = await api.get('/calendar/meetings', params);
    if (_filters.participant) {
      const q = _filters.participant.toLowerCase();
      meetings = meetings.filter(m => (m.participants || []).some(p =>
        (p.user_name || p.external_name || '').toLowerCase().includes(q)));
    }
    if (_filters.type) {
      meetings = meetings.filter(m => (m.meeting_type || '').toLowerCase() === _filters.type.toLowerCase());
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
  ${pageHeader('Calendario — TI', `${_meetings.length} reunión${_meetings.length !== 1 ? 'es' : ''}`,
    `<button id="cal-add-btn" class="btn-primary">${icon('add',20)} Agregar reunión</button>`)}

  <div class="flex items-center gap-2 mb-4 border-b border-gray-200">
    <button type="button" class="cal-tab px-4 py-2 text-sm font-medium border-b-2 ${_mode==='area' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-mode="area">Calendario — TI</button>
    <button type="button" class="cal-tab px-4 py-2 text-sm font-medium border-b-2 ${_mode==='mine' ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}" data-mode="mine">Mi agenda</button>
  </div>

  <div class="flex flex-wrap gap-3 mb-5">
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
  </div>

  <div class="grid grid-cols-1 ${_formOpen ? 'lg:grid-cols-[1fr_380px]' : ''} gap-5 items-start">
    <div id="cal-list">${listHtml()}</div>
    ${_formOpen ? `<div id="cal-form-panel">${formHtml()}</div>` : ''}
  </div>`;

  wirePage();
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
          ${areaBadge} ${statusBadge}
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
  return `
  <div class="card p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-gray-900">${editing ? 'Editar reunión' : 'Nueva reunión'}</h3>
      <button type="button" id="cal-form-close" class="p-1 rounded hover:bg-gray-100 text-gray-400">${icon('close',18)}</button>
    </div>
    <form id="cal-form" class="space-y-3">
      <div>
        <label class="text-xs font-medium text-gray-600">Nombre de la reunión *</label>
        <input name="title" class="input text-sm w-full mt-1" required value="${esc(editing?.title || '')}">
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="text-xs font-medium text-gray-600">Fecha *</label>
          <input type="date" name="date" class="input text-sm w-full mt-1" required value="${editing?.meeting_date || ''}">
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Inicio *</label>
          <input type="time" name="start_time" class="input text-sm w-full mt-1" required value="${editing ? editing.start_time.slice(0,5) : ''}">
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Fin *</label>
          <input type="time" name="end_time" class="input text-sm w-full mt-1" required value="${editing ? editing.end_time.slice(0,5) : ''}">
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Tipo de reunión</label>
        <select name="meeting_type" class="input text-sm w-full mt-1">
          <option value="">— Seleccionar —</option>
          ${MEETING_TYPES.map(t => `<option value="${t}" ${editing?.meeting_type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Motivo</label>
        <input name="motivo" class="input text-sm w-full mt-1" value="${esc(editing?.motivo || '')}">
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Descripción</label>
        <textarea name="description" class="input text-sm w-full mt-1" rows="2">${esc(editing?.description || '')}</textarea>
      </div>

      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Participantes internos</label>
        <div class="relative">
          <input id="cal-participant-search" class="input text-sm w-full" placeholder="Buscar por nombre, cargo o área...">
          <div id="cal-dir-results" class="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto hidden"></div>
        </div>
        <div id="cal-selected-participants" class="flex flex-wrap gap-1.5 mt-2">${selectedParticipantsHtml()}</div>
      </div>

      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Participante externo (cliente, postulante, proveedor...)</label>
        <div class="flex gap-2">
          <input id="cal-ext-name" class="input text-sm flex-1" placeholder="Nombre">
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
    </form>
  </div>`;
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

function conflictBannerHtml() {
  if (!_conflicts.length) return '';
  return `
  <div class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
    <p class="font-semibold flex items-center gap-1.5">${icon('warning',16)} ${_conflicts.length > 1 ? 'Se encontraron ' + _conflicts.length + ' conflictos:' : 'Conflicto de horario'}</p>
    <ul class="mt-1.5 space-y-1 list-disc list-inside">
      ${_conflicts.map(c => `<li>${esc(c.user_name || 'Alguien')} (${esc(c.area || '—')}) ya tiene "${esc(c.meeting_name)}" de ${c.start_time.slice(0,5)} a ${c.end_time.slice(0,5)} (${fmtDateOnly(c.date)}).</li>`).join('')}
    </ul>
  </div>`;
}

function wirePage() {
  document.querySelectorAll('.cal-tab').forEach(btn => btn.addEventListener('click', () => {
    _mode = btn.dataset.mode;
    load();
  }));

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
    _editingId = null; _selectedParticipants = []; _externalParticipants = []; _conflicts = [];
    _formOpen = true; renderPage();
  });

  ['cal-form-close', 'cal-form-cancel'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => { _formOpen = false; _editingId = null; renderPage(); });
  });

  wireFormExtras();

  const form = document.getElementById('cal-form');
  if (form) {
    ['date', 'start_time', 'end_time'].forEach(name => {
      const el = form.elements[name];
      if (el) el.addEventListener('change', liveCheck);
    });
    form.addEventListener('submit', submitForm);
  }

  document.querySelectorAll('.cal-view-btn').forEach(btn => btn.addEventListener('click', () => viewMeeting(btn.dataset.id)));
  document.querySelectorAll('.cal-edit-btn').forEach(btn => btn.addEventListener('click', () => editMeeting(btn.dataset.id)));
  document.querySelectorAll('.cal-cancel-btn').forEach(btn => btn.addEventListener('click', () => cancelMeeting(btn.dataset.id)));
  document.querySelectorAll('.cal-del-btn').forEach(btn => btn.addEventListener('click', () => deleteMeeting(btn.dataset.id)));
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
              document.getElementById('cal-selected-participants').innerHTML = selectedParticipantsHtml();
              wireRemoveParticipants();
              liveCheck();
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
    document.getElementById('cal-selected-participants').innerHTML = selectedParticipantsHtml();
    wireRemoveParticipants();
    liveCheck();
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
      date, start_time: start, end_time: end, participant_ids: ids, exclude_meeting_id: _editingId || undefined,
    });
    conflicts = res.conflicts || [];
  } catch { conflicts = []; }
  if (token !== _checkToken) return;
  _conflicts = conflicts;
  const banner = document.getElementById('cal-conflict-banner');
  if (banner) banner.innerHTML = conflictBannerHtml();
  const saveBtnEl = document.getElementById('cal-save-btn');
  if (saveBtnEl) saveBtnEl.disabled = _conflicts.length > 0;
}

async function submitForm(e) {
  e.preventDefault();
  const form = e.target;
  const title = form.elements.title.value.trim();
  const date = form.elements.date.value;
  const start_time = form.elements.start_time.value;
  const end_time = form.elements.end_time.value;
  const meeting_type = form.elements.meeting_type.value;
  const motivo = form.elements.motivo.value.trim();
  const description = form.elements.description.value.trim();

  if (!title) return toast('El nombre de la reunión es requerido', 'error');
  if (!date || !start_time || !end_time) return toast('Fecha y horario son requeridos', 'error');
  if (end_time <= start_time) return toast('La hora de fin debe ser posterior a la de inicio', 'error');
  if (!_selectedParticipants.length && !_externalParticipants.length) return toast('Selecciona al menos un participante', 'error');

  const payload = {
    title, date, start_time, end_time, meeting_type, motivo, description,
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
    _formOpen = false; _editingId = null; _conflicts = [];
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
  _formOpen = true;
  renderPage();
}

async function cancelMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || !confirm(`¿Deseas cancelar la reunión "${m.title}"? Se liberará el horario de los participantes.`)) return;
  try {
    await api.post(`/calendar/meetings/${id}/cancel`);
    toast('Reunión cancelada');
    await load();
  } catch (err) { toast(err.message || 'Error', 'error'); }
}

async function deleteMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || !confirm(`¿Deseas eliminar la reunión "${m.title}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api.delete(`/calendar/meetings/${id}`);
    toast('Reunión eliminada');
    if (_editingId === id) { _formOpen = false; _editingId = null; }
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
      <p><span class="font-medium text-gray-700">Área:</span> ${esc(m.area)}</p>
      <p><span class="font-medium text-gray-700">Fecha:</span> ${fmtDateOnly(m.meeting_date)}</p>
      <p><span class="font-medium text-gray-700">Horario:</span> ${m.start_time.slice(0,5)} — ${m.end_time.slice(0,5)}</p>
      ${m.meeting_type ? `<p><span class="font-medium text-gray-700">Tipo:</span> ${esc(m.meeting_type)}</p>` : ''}
      ${m.motivo ? `<p><span class="font-medium text-gray-700">Motivo:</span> ${esc(m.motivo)}</p>` : ''}
      ${m.description ? `<p><span class="font-medium text-gray-700">Descripción:</span> ${esc(m.description)}</p>` : ''}
      <div>
        <p class="font-medium text-gray-700 mb-1">Participantes:</p>
        <ul class="list-disc list-inside text-gray-600">${participantsHtml || '<li>Sin participantes</li>'}</ul>
      </div>
      <p class="text-xs text-gray-400">Programada por ${esc(m.created_by_name || '—')}</p>
    </div>
  `, 'md');
}
