import { api }                                         from '../api.js';
import { toast, showModal, closeModal, pageHeader,
         projectStatusBadge, priorityBadge, progressBar,
         spinner, icon, fmtDateTime, isOverdue, overdueBadge } from '../utils.js';

let _projects = [], _users = [], _filter = { status: '', search: '' };
let _reqs = [], _reqProjectId = null;

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="projects-page">${spinner()}</div>`;
  load();
  api.get('/users').then(u => { _users = u; }).catch(() => {});
}

function load() {
  api.get('/projects', _filter).then(data => {
    _projects = data;
    renderPage();
  }).catch(() => {
    document.getElementById('projects-page').innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar proyectos</p>';
  });
}

function renderPage() {
  const container = document.getElementById('projects-page');
  if (!container) return;

  container.innerHTML = `
    ${pageHeader('Proyectos',
      `${_projects.length} proyecto${_projects.length !== 1 ? 's' : ''}`,
      `<button id="new-project-btn" class="btn-primary">${icon('add', 20)} Nuevo Proyecto</button>`)}

    <div class="flex flex-wrap gap-3 mb-5">
      <div class="relative flex-1 min-w-[200px]">
        <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">search</span>
        <input id="search-input" class="input pl-9" placeholder="Buscar por nombre, cliente o código..." value="${_filter.search}">
      </div>
      <select id="status-filter" class="input w-auto">
        <option value="">Todos los estados</option>
        <option value="pending"   ${_filter.status==='pending'   ?'selected':''}>Pendientes</option>
        <option value="active"    ${_filter.status==='active'    ?'selected':''}>Activos</option>
        <option value="paused"    ${_filter.status==='paused'    ?'selected':''}>Pausados</option>
        <option value="completed" ${_filter.status==='completed' ?'selected':''}>Completados</option>
        <option value="cancelled" ${_filter.status==='cancelled' ?'selected':''}>Cancelados</option>
      </select>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="projects-grid">
      ${_projects.length === 0
        ? `<div class="col-span-3 card p-12 text-center">
             <span class="material-icons text-gray-300" style="font-size:48px">folder</span>
             <p class="text-gray-500 mt-3">No se encontraron proyectos</p>
             <button class="btn-primary mt-4" id="empty-new-btn">${icon('add',20)} Crear primer proyecto</button>
           </div>`
        : _projects.map(projectCard).join('')}
    </div>`;

  document.getElementById('new-project-btn')?.addEventListener('click', () => openModal());
  document.getElementById('empty-new-btn')?.addEventListener('click',  () => openModal());

  document.getElementById('search-input').addEventListener('input', e => {
    _filter.search = e.target.value;
    load();
  });
  document.getElementById('status-filter').addEventListener('change', e => {
    _filter.status = e.target.value;
    load();
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const id = btn.dataset.id;
      const p = _projects.find(x => String(x.id) === id);
      if (p) openModal(p);
    });
  });

  document.querySelectorAll('.history-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const id = btn.dataset.id;
      const p = _projects.find(x => String(x.id) === id);
      if (p) openHistoryModal(p);
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      const id = btn.dataset.id;
      const p = _projects.find(x => String(x.id) === id);
      if (!p) return;
      if (!confirm(`¿Eliminar el proyecto "${p.name}"? Esta acción no se puede deshacer.`)) return;
      try {
        await api.delete(`/projects/${id}`);
        toast('Proyecto eliminado');
        load();
      } catch { toast('Error al eliminar', 'error'); }
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
        <button class="history-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" data-id="${p.id}" title="Ver historial de cambios">
          ${icon('visibility', 16)}
        </button>
        <button class="edit-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" data-id="${p.id}">
          ${icon('edit', 16)}
        </button>
        <button class="delete-btn p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" data-id="${p.id}">
          ${icon('delete', 16)}
        </button>
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

const DOC_TYPES = [['dni','DNI'],['ce','CE'],['pasaporte','Pasaporte']];
const CURRENCIES = [['USD','USD - Dólares'],['EUR','EUR - Euros'],['JPY','JPY - Yenes'],['PEN','PEN - Soles']];

function openModal(editing = null) {
  const title = editing ? 'Editar Proyecto' : 'Nuevo Proyecto';
  const f = editing || { name:'', client:'', description:'', status:'pending', progress:0, budget:'', currency:'USD',
    start_date:'', end_date:'', responsible_id:'', priority:'medium', company_name:'', company_logo:'',
    id_document_type:'dni', id_document_number:'' };

  const userOpts = _users.map(u => `<option value="${u.id}" ${String(f.responsible_id)===String(u.id)?'selected':''}>${esc(u.name)}</option>`).join('');
  const docOpts = DOC_TYPES.map(([v,l]) => `<option value="${v}" ${f.id_document_type===v?'selected':''}>${l}</option>`).join('');
  const currencyOpts = CURRENCIES.map(([v,l]) => `<option value="${v}" ${f.currency===v?'selected':''}>${l}</option>`).join('');

  const sectionTitle = label => `<p class="text-xs font-bold text-gray-500 uppercase tracking-wide pb-2 mb-3 border-b border-gray-100">${label}</p>`;

  showModal(title, `
  <form id="project-form">
    <div class="grid gap-8" style="grid-template-columns: 260px 1fr 280px">
      <!-- Columna 1: Imagen -->
      <div>
        ${sectionTitle('Imagen')}
        <div id="logo-dropzone" class="relative w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors">
          <img id="logo-preview" src="${esc(f.company_logo||'')}" class="absolute inset-0 w-full h-full object-contain bg-white ${f.company_logo?'':'hidden'}">
          <div id="logo-placeholder" class="flex flex-col items-center gap-1.5 text-gray-400 ${f.company_logo?'hidden':''}">
            ${icon('add_photo_alternate', 36)}
            <span class="text-sm font-medium">Subir imagen</span>
            <span class="text-xs">Click o arrastra aquí</span>
          </div>
          <input type="file" name="logo_file" id="logo-file-input" accept="image/*" class="hidden">
        </div>
        <input type="text" name="company_logo_url" id="logo-url-input" placeholder="o pega una URL de imagen" class="input text-xs py-1.5 mt-2" value="${esc(f.company_logo||'')}">
        <div class="mt-3">
          <label class="label">Nombre de la Empresa</label>
          <input class="input" name="company_name" value="${esc(f.company_name||'')}" placeholder="Razón social">
        </div>
      </div>

      <!-- Columna 2: Formulario -->
      <div>
        ${sectionTitle('Información Básica')}
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div class="col-span-2">
            <label class="label">Nombre del Proyecto *</label>
            <input class="input" name="name" required value="${esc(f.name)}" placeholder="Ej: Instalación Red Eléctrica">
          </div>
          <div class="col-span-2">
            <label class="label">Cliente *</label>
            <input class="input" name="client" required value="${esc(f.client)}" placeholder="Nombre del cliente o empresa">
          </div>
          <div>
            <label class="label">Tipo de Documento</label>
            <select class="input" name="id_document_type">${docOpts}</select>
          </div>
          <div>
            <label class="label">Número de Documento</label>
            <input class="input" name="id_document_number" value="${esc(f.id_document_number||'')}" placeholder="Ej: 1234567890">
          </div>
          <div>
            <label class="label">Estado</label>
            <select class="input" name="status">${statusOpts(f.status)}</select>
          </div>
          <div>
            <label class="label">Prioridad</label>
            <select class="input" name="priority">
              <option value="low"    ${f.priority==='low'   ?'selected':''}>Baja</option>
              <option value="medium" ${f.priority==='medium'?'selected':''}>Media</option>
              <option value="high"   ${f.priority==='high'  ?'selected':''}>Alta</option>
              <option value="urgent" ${f.priority==='urgent'?'selected':''}>Urgente</option>
            </select>
          </div>
        </div>

        ${sectionTitle('Presupuesto, Fechas y Avance')}
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label class="label">Presupuesto</label>
            <input class="input" type="number" name="budget" min="0" step="0.01" value="${f.budget || ''}" placeholder="0.00">
          </div>
          <div>
            <label class="label">Moneda</label>
            <select class="input" name="currency">${currencyOpts}</select>
          </div>
          <div>
            <label class="label">Fecha de Inicio</label>
            <input class="input" type="date" name="start_date" value="${f.start_date||''}">
          </div>
          <div>
            <label class="label">Fecha de Entrega</label>
            <input class="input" type="date" name="end_date" value="${f.end_date||''}">
          </div>
          <div>
            <label class="label">Avance (%)</label>
            <input class="input" type="number" name="progress" min="0" max="100" value="${f.progress}">
          </div>
          <div>
            <label class="label">Responsable</label>
            <select class="input" name="responsible_id">
              <option value="">Sin asignar</option>
              ${userOpts}
            </select>
          </div>
        </div>

        ${sectionTitle('Información Adicional')}
        <div>
          <label class="label">Descripción</label>
          <textarea class="input resize-none" name="description" rows="3" placeholder="Descripción del proyecto...">${esc(f.description)}</textarea>
        </div>
      </div>

      <!-- Columna 3: Requerimientos -->
      <div>
        ${sectionTitle('Requerimientos')}
        ${editing ? `
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Funcionales</p>
          <div id="req-list-functional" class="space-y-2 mb-2">${spinnerSmall()}</div>
          <div class="flex gap-2 mb-5">
            <input id="req-desc-functional" class="input text-xs flex-1" placeholder="Nuevo requerimiento...">
            <button type="button" id="req-add-functional" class="btn-secondary text-xs px-3">${icon('add',16)}</button>
          </div>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">No Funcionales</p>
          <div id="req-list-nonfunctional" class="space-y-2 mb-2"></div>
          <div class="flex gap-2">
            <input id="req-desc-nonfunctional" class="input text-xs flex-1" placeholder="Nuevo requerimiento...">
            <button type="button" id="req-add-nonfunctional" class="btn-secondary text-xs px-3">${icon('add',16)}</button>
          </div>
        ` : `
          <div class="text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg p-4 text-center">
            Guarda el proyecto primero para poder agregar los requerimientos.
          </div>
        `}
      </div>
    </div>
  </form>`, '2xl', `
    <div class="flex justify-end gap-3">
      <button type="button" id="modal-cancel" class="btn-secondary">Cancelar</button>
      <button type="submit" form="project-form" class="btn-primary">${editing ? 'Guardar Cambios' : 'Crear Proyecto'}</button>
    </div>
  `);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  document.getElementById('logo-dropzone').addEventListener('click', () => {
    document.getElementById('logo-file-input').click();
  });
  document.getElementById('logo-dropzone').addEventListener('dragover', e => {
    e.preventDefault();
    e.currentTarget.classList.add('border-primary-400', 'bg-primary-50/40');
  });
  document.getElementById('logo-dropzone').addEventListener('dragleave', e => {
    e.currentTarget.classList.remove('border-primary-400', 'bg-primary-50/40');
  });
  document.getElementById('logo-dropzone').addEventListener('drop', e => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-primary-400', 'bg-primary-50/40');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    const input = document.getElementById('logo-file-input');
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });

  document.getElementById('logo-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      document.getElementById('logo-preview').src = ev.target.result;
      document.getElementById('logo-preview').classList.remove('hidden');
      document.getElementById('logo-placeholder').classList.add('hidden');
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('logo-url-input').addEventListener('input', e => {
    const url = e.target.value.trim();
    const img = document.getElementById('logo-preview');
    const placeholder = document.getElementById('logo-placeholder');
    if (url) { img.src = url; img.classList.remove('hidden'); placeholder.classList.add('hidden'); }
    else { img.classList.add('hidden'); placeholder.classList.remove('hidden'); }
  });

  if (editing) {
    loadRequirements(editing.id);
    document.getElementById('req-add-functional').addEventListener('click', () => addRequirement('functional'));
    document.getElementById('req-desc-functional').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addRequirement('functional'); }
    });
    document.getElementById('req-add-nonfunctional').addEventListener('click', () => addRequirement('non_functional'));
    document.getElementById('req-desc-nonfunctional').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addRequirement('non_functional'); }
    });
  }

  document.getElementById('project-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      if (editing) {
        await api.put(`/projects/${editing.id}`, fd);
        toast('Proyecto actualizado');
      } else {
        await api.post('/projects', fd);
        toast('Proyecto creado');
      }
      closeModal();
      load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

async function loadRequirements(projectId) {
  _reqProjectId = projectId;
  _reqs = await api.get('/requirements', { project_id: projectId });
  renderRequirementsList();
}

function renderRequirementsList() {
  const cf = document.getElementById('req-list-functional');
  const cn = document.getElementById('req-list-nonfunctional');
  if (!cf || !cn) return;

  const functional = _reqs.filter(r => r.type !== 'non_functional');
  const nonFunctional = _reqs.filter(r => r.type === 'non_functional');

  cf.innerHTML = functional.length === 0
    ? '<p class="text-xs text-gray-400 text-center py-2">Sin requerimientos</p>'
    : functional.map(reqRow).join('');
  cn.innerHTML = nonFunctional.length === 0
    ? '<p class="text-xs text-gray-400 text-center py-2">Sin requerimientos</p>'
    : nonFunctional.map(reqRow).join('');

  document.querySelectorAll('.req-progress-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const value = Math.max(0, Math.min(100, parseInt(inp.value) || 0));
      inp.value = value;
      await api.put(`/requirements/${inp.dataset.id}`, { progress: value });
      const r = _reqs.find(x => x.id === inp.dataset.id);
      if (r) r.progress = value;
    });
  });
  document.querySelectorAll('.req-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.delete(`/requirements/${btn.dataset.id}`);
      _reqs = _reqs.filter(x => x.id !== btn.dataset.id);
      renderRequirementsList();
    });
  });
}

function reqRow(r) {
  return `
  <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-white">
    <p class="flex-1 text-xs text-gray-700 truncate" title="${esc(r.description)}">${esc(r.description)}</p>
    <input type="number" min="0" max="100" value="${r.progress ?? 0}" class="req-progress-input input text-xs text-center" style="width:52px;padding:2px 4px" data-id="${r.id}">
    <span class="text-xs text-gray-400">%</span>
    <button class="req-del text-gray-300 hover:text-red-500 shrink-0" data-id="${r.id}">${icon('delete',14)}</button>
  </div>`;
}

async function addRequirement(type) {
  const input = document.getElementById(type === 'non_functional' ? 'req-desc-nonfunctional' : 'req-desc-functional');
  const description = input.value.trim();
  if (!description || !_reqProjectId) return;
  try {
    const r = await api.post('/requirements', { project_id: _reqProjectId, type, description });
    _reqs.push({ id: r.id, project_id: _reqProjectId, type, description, progress: 0 });
    input.value = '';
    renderRequirementsList();
  } catch (err) { toast(err.message || 'Error', 'error'); }
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

function statusOpts(current) {
  return [['pending','Pendiente'],['active','Activo'],['paused','Pausado'],['completed','Completado'],['cancelled','Cancelado']]
    .map(([v,l]) => `<option value="${v}" ${current===v?'selected':''}>${l}</option>`).join('');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
