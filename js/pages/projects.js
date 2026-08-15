import { api }                                         from '../api.js';
import { toast, showModal, pageHeader,
         projectStatusBadge, priorityBadge, progressBar,
         spinner, icon, fmtDateTime, isOverdue, overdueBadge } from '../utils.js';

let _projects = [], _filter = { status: '', search: '' };

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="projects-page">${spinner()}</div>`;
  load();
}

function load() {
  api.get('/projects', _filter).then(data => {
    _projects = data;
    renderPage();
  }).catch(() => {
    const c = document.getElementById('projects-page');
    if (c) c.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar proyectos</p>';
  });
}

function renderPage() {
  const container = document.getElementById('projects-page');
  if (!container) return;

  container.innerHTML = `
    ${pageHeader('Proyectos', `${_projects.length} proyecto${_projects.length !== 1 ? 's' : ''} · los crea y aprueba ADG, acá se reclaman y se trabajan`)}

    <div class="flex flex-wrap gap-3 mb-5">
      <div class="relative flex-1 min-w-[200px]">
        <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">search</span>
        <input id="search-input" class="input pl-9" placeholder="Buscar por nombre, cliente o código..." value="${_filter.search}">
      </div>
      <select id="status-filter" class="input w-auto">
        <option value="">Todos los estados</option>
        <option value="pending"        ${_filter.status==='pending'       ?'selected':''}>Pendientes de reclamar</option>
        <option value="active"         ${_filter.status==='active'        ?'selected':''}>Activos</option>
        <option value="paused"         ${_filter.status==='paused'        ?'selected':''}>Pausados</option>
        <option value="finished_by_ti" ${_filter.status==='finished_by_ti'?'selected':''}>Finalizados (por revisar)</option>
        <option value="completed"      ${_filter.status==='completed'     ?'selected':''}>Completados</option>
        <option value="cancelled"      ${_filter.status==='cancelled'     ?'selected':''}>Cancelados</option>
      </select>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="projects-grid">
      ${_projects.length === 0
        ? `<div class="col-span-3 card p-12 text-center">
             <span class="material-icons text-gray-300" style="font-size:48px">folder</span>
             <p class="text-gray-500 mt-3">No hay proyectos para mostrar</p>
           </div>`
        : _projects.map(projectCard).join('')}
    </div>`;

  document.getElementById('search-input').addEventListener('input', e => {
    _filter.search = e.target.value;
    load();
  });
  document.getElementById('status-filter').addEventListener('change', e => {
    _filter.status = e.target.value;
    load();
  });

  document.querySelectorAll('.history-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const id = btn.dataset.id;
      const p = _projects.find(x => String(x.id) === id);
      if (p) openHistoryModal(p);
    });
  });

  document.querySelectorAll('.claim-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      const id = btn.dataset.id;
      try {
        await api.post(`/projects/${id}/claim`);
        toast('Proyecto anexado a tu área');
        load();
      } catch (err) { toast(err.message || 'Error al reclamar', 'error'); }
    });
  });
}

function projectCard(p) {
  const overdue = isOverdue(p);
  return `
  <a href="#/projects/${p.id}" class="card p-5 hover:shadow-md transition-shadow block ${overdue ? 'border-l-4 border-l-red-400' : ''}">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-11 h-11 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
          ${p.company_logo
            ? `<img src="${esc(p.company_logo)}" class="w-full h-full object-contain">`
            : icon('apartment', 20)}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-gray-400 font-mono">${esc(p.code)}</p>
          <h3 class="font-semibold text-gray-900 truncate mt-0.5">${esc(p.name)}</h3>
          <p class="text-sm text-gray-500 truncate">${esc(p.client)}</p>
        </div>
      </div>
      <div class="flex gap-1 ml-2 shrink-0">
        ${p.status === 'pending' ? `
          <button class="claim-btn btn-primary text-xs py-1 px-2" data-id="${p.id}" onclick="event.preventDefault()">
            ${icon('add_task', 14)} Reclamar
          </button>
        ` : `
          <button class="history-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" data-id="${p.id}" title="Ver historial de cambios">
            ${icon('visibility', 16)}
          </button>
        `}
      </div>
    </div>
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      ${projectStatusBadge(p.status)}
      ${priorityBadge(p.priority)}
      ${overdue ? overdueBadge() : ''}
    </div>
    <div class="mb-3">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>Avance</span><span>${p.progress}%</span>
      </div>
      ${progressBar(p.progress)}
    </div>
    <div class="flex items-center justify-between text-xs text-gray-400">
      <span>${esc(p.responsible_name || 'Sin responsable')}</span>
      <div class="flex gap-3">
        ${p.contracts_count > 0 ? `<span>📄 ${p.contracts_count}</span>` : ''}
        ${p.documents_count > 0 ? `<span>📁 ${p.documents_count}</span>` : ''}
        ${p.messages_count  > 0 ? `<span>💬 ${p.messages_count}</span>` : ''}
      </div>
    </div>
  </a>`;
}

function spinnerSmall() {
  return '<div class="flex justify-center py-3"><div class="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>';
}

function openHistoryModal(p) {
  showModal(`Historial de Cambios — ${esc(p.name)}`, `<div id="history-list">${spinnerSmall()}</div>`, 'lg');

  api.get('/activities', { project_id: p.id, limit: 200 }).then(activities => {
    const c = document.getElementById('history-list');
    if (!c) return;
    c.innerHTML = activities.length === 0
      ? '<p class="text-center text-gray-400 py-8 text-sm">Sin cambios registrados todavía</p>'
      : `<div class="space-y-4">
          ${activities.map(a => `
            <div class="flex gap-3">
              <div class="flex flex-col items-center shrink-0">
                <div class="w-2.5 h-2.5 bg-primary-400 rounded-full mt-1.5"></div>
                <div class="flex-1 w-px bg-gray-200 mt-1"></div>
              </div>
              <div class="pb-3">
                <p class="text-sm text-gray-800">${esc(a.description)}</p>
                <p class="text-xs text-gray-400 mt-1">${fmtDateTime(a.created_at)}</p>
              </div>
            </div>`).join('')}
        </div>`;
  }).catch(() => {
    const c = document.getElementById('history-list');
    if (c) c.innerHTML = '<p class="text-center text-red-400 py-8 text-sm">Error al cargar el historial</p>';
  });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
