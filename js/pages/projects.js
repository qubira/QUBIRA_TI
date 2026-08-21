import { api }                                         from '../api.js';
import { toast, showModal, closeModal, pageHeader,
         projectStatusBadge, priorityBadge, projectTypeBadge, progressBar,
         spinner, icon, fmtDateTime, isOverdue, overdueBadge,
         sanitizeRichText, richTextToolbar, wireRichEditor } from '../utils.js';

let _projects = [], _users = [], _docTypes = [], _families = [], _filter = { status: '', search: '', family: '' };
let _reqs = [], _reqProjectId = null;
let _groupByFamily = false;

/* Un solo listener delegado (no uno por apertura de modal) para cerrar
   el desplegable de familia al hacer clic fuera — mismo patrón que el
   selector de tecnologías de project-detail.js. */
document.addEventListener('click', e => {
  document.querySelectorAll('.family-dropdown:not(.hidden)').forEach(dd => {
    if (!dd.closest('[data-family-wrap]')?.contains(e.target)) dd.classList.add('hidden');
  });
});

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="projects-page">${spinner()}</div>`;
  load();
  api.get('/users').then(u => { _users = u; }).catch(() => {});
  api.get('/document-types').then(d => { _docTypes = d; }).catch(() => {});
  api.get('/projects/families').then(f => { _families = f; }).catch(() => {});
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
    ${pageHeader('Proyectos', `${_projects.length} proyecto${_projects.length !== 1 ? 's' : ''}`,
      `<button id="new-project-btn" class="btn-primary">${icon('add', 20)} Nuevo Proyecto</button>`)}

    <div class="flex flex-wrap gap-3 mb-5">
      <div class="relative flex-1 min-w-[200px]">
        <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">search</span>
        <input id="search-input" class="input pl-9" placeholder="Buscar por nombre, cliente o código..." value="${_filter.search}">
      </div>
      <select id="status-filter" class="input w-auto">
        <option value="">Todos los estados</option>
        <option value="pending_approval" ${_filter.status==='pending_approval'?'selected':''}>Mis solicitudes por aprobar</option>
        <option value="observed"       ${_filter.status==='observed'      ?'selected':''}>Observados</option>
        <option value="pending"        ${_filter.status==='pending'       ?'selected':''}>Pendientes de reclamar</option>
        <option value="active"         ${_filter.status==='active'        ?'selected':''}>Activos</option>
        <option value="paused"         ${_filter.status==='paused'        ?'selected':''}>Pausados</option>
        <option value="finished_by_ti" ${_filter.status==='finished_by_ti'?'selected':''}>Finalizados (por revisar)</option>
        <option value="completed"      ${_filter.status==='completed'     ?'selected':''}>Completados</option>
        <option value="cancelled"      ${_filter.status==='cancelled'     ?'selected':''}>Cancelados</option>
      </select>
      <select id="family-filter" class="input w-auto">
        <option value="">Todas las familias</option>
        ${_families.map(f => `<option value="${esc(f.family)}" ${_filter.family===f.family?'selected':''}>${esc(f.family)} (${f.count})</option>`).join('')}
      </select>
      <button id="group-family-btn" class="btn-secondary ${_groupByFamily ? 'bg-primary-50 text-primary-700 border-primary-200' : ''}">
        ${icon('workspaces', 18)} Agrupar por familia
      </button>
    </div>

    ${renderProjectsSection()}`;

  document.getElementById('new-project-btn').addEventListener('click', () => openModal());

  document.getElementById('search-input').addEventListener('input', e => {
    _filter.search = e.target.value;
    load();
  });
  document.getElementById('status-filter').addEventListener('change', e => {
    _filter.status = e.target.value;
    load();
  });
  document.getElementById('family-filter').addEventListener('change', e => {
    _filter.family = e.target.value;
    load();
  });
  document.getElementById('group-family-btn').addEventListener('click', () => {
    _groupByFamily = !_groupByFamily;
    renderPage();
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

function emptyState() {
  return `<div class="card p-12 text-center">
    <span class="material-icons text-gray-300" style="font-size:48px">folder</span>
    <p class="text-gray-500 mt-3">No hay proyectos para mostrar</p>
  </div>`;
}

function projectGrid(items) {
  return `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${items.map(projectCard).join('')}</div>`;
}

function renderProjectsSection() {
  if (_projects.length === 0) return `<div id="projects-grid">${emptyState()}</div>`;

  if (!_groupByFamily) {
    return `<div id="projects-grid">${projectGrid(_projects)}</div>`;
  }

  const groups = new Map();
  const noFamily = [];
  for (const p of _projects) {
    if (p.family) {
      if (!groups.has(p.family)) groups.set(p.family, []);
      groups.get(p.family).push(p);
    } else {
      noFamily.push(p);
    }
  }

  let html = '<div id="projects-grid">';
  for (const fam of [...groups.keys()].sort()) {
    const items = groups.get(fam);
    html += `
    <div class="mb-6">
      <h2 class="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
        ${icon('workspaces', 16)} ${esc(fam)} <span class="text-gray-400 font-normal normal-case">(${items.length})</span>
      </h2>
      ${projectGrid(items)}
    </div>`;
  }
  if (noFamily.length > 0) {
    html += `
    <div class="mb-6">
      <h2 class="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Sin familia (${noFamily.length})</h2>
      ${projectGrid(noFamily)}
    </div>`;
  }
  html += '</div>';
  return html;
}

function observationDaysBadge(p) {
  if (p.status !== 'observed' || !p.observation_deadline) return '';
  const daysLeft = Math.ceil((new Date(p.observation_deadline) - new Date()) / 86400000);
  return `<span class="badge ${daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'} inline-flex items-center gap-1">
    ${icon('schedule', 12)} ${daysLeft > 0 ? `${daysLeft} día${daysLeft === 1 ? '' : 's'}` : 'Vencido'}
  </span>`;
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
      ${projectTypeBadge(p.project_type)}
      ${overdue ? overdueBadge() : ''}
      ${observationDaysBadge(p)}
    </div>
    ${p.origin_area && p.origin_area !== 'TI' ? `<div class="mb-2 -mt-1 text-xs text-gray-400 flex items-center gap-1">${icon('call_made', 12)} Enviado por <strong class="text-gray-600">${esc(p.origin_area)}</strong> · ${esc(p.created_by_name || 'usuario eliminado')}</div>` : ''}
    ${p.family ? `<div class="mb-3 -mt-1"><span class="badge bg-pink-50 text-pink-700 inline-flex items-center gap-1">${icon('workspaces', 12)} ${esc(p.family)}</span></div>` : ''}
    <div class="mb-3">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>Avance</span><span>${p.progress}%</span>
      </div>
      ${progressBar(p.progress)}
    </div>
    <div class="flex items-center justify-between text-xs text-gray-400">
      <span>${esc(p.responsible_name || 'Sin responsable')}</span>
      <div class="flex gap-3">
        ${p.documents_count > 0 ? `<span>📁 ${p.documents_count}</span>` : ''}
        ${p.messages_count  > 0 ? `<span>💬 ${p.messages_count}</span>` : ''}
      </div>
    </div>
  </a>`;
}

const DOC_TYPES = [['dni','DNI'],['ce','CE'],['pasaporte','Pasaporte'],['ruc','RUC']];
const CURRENCIES = [['USD','USD - Dólares'],['EUR','EUR - Euros'],['JPY','JPY - Yenes'],['PEN','PEN - Soles']];
const PROJECT_TYPES = [['web','Web'],['mobile','Aplicativo Móvil'],['desktop','Aplicativo de Escritorio']];

/* Solicitar un proyecto propio de TI — misma ficha completa que usa
   ADG. Queda como "por aprobar" hasta que ADG lo revise (ver el
   estado inicial que decide el backend en POST /projects). */
function openModal() {
  const f = { name:'', client:'', description:'', status:'pending', progress:0, budget:'', currency:'USD',
    start_date:'', end_date:'', responsible_id:'', priority:'medium', company_name:'', company_logo:'',
    id_document_type:'dni', id_document_number:'', project_type:'web', github_url:'', website_url:'', family:'' };

  const userOpts = _users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  const docOpts = buildDocOpts(f.id_document_type);
  const currencyOpts = CURRENCIES.map(([v,l]) => `<option value="${v}" ${f.currency===v?'selected':''}>${l}</option>`).join('');
  const projectTypeOpts = PROJECT_TYPES.map(([v,l]) => `<option value="${v}" ${(f.project_type||'web')===v?'selected':''}>${l}</option>`).join('');

  const sectionTitle = label => `<p class="text-xs font-bold text-gray-500 uppercase tracking-wide pb-2 mb-3 border-b border-gray-100">${label}</p>`;

  showModal('Solicitar Proyecto', `
  <form id="project-form">
    <div class="grid gap-8" style="grid-template-columns: 260px 1fr 280px">
      <!-- Columna 1: Imagen -->
      <div>
        ${sectionTitle('Imagen')}
        <div id="logo-dropzone" class="relative w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary-400 hover:bg-primary-50/40 transition-colors">
          <img id="logo-preview" src="" class="absolute inset-0 w-full h-full object-contain bg-white hidden">
          <div id="logo-placeholder" class="flex flex-col items-center gap-1.5 text-gray-400">
            ${icon('add_photo_alternate', 36)}
            <span class="text-sm font-medium">Subir imagen</span>
            <span class="text-xs">Click o arrastra aquí</span>
          </div>
          <input type="file" name="logo_file" id="logo-file-input" accept="image/*" class="hidden">
        </div>
        <input type="text" name="company_logo_url" id="logo-url-input" placeholder="o pega una URL de imagen" class="input text-xs py-1.5 mt-2" value="">
        <div class="mt-3">
          <label class="label">Nombre de la Empresa</label>
          <input class="input" name="company_name" value="" placeholder="Razón social">
        </div>
      </div>

      <!-- Columna 2: Formulario -->
      <div>
        ${sectionTitle('Información Básica')}
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div class="col-span-2">
            <label class="label">Nombre del Proyecto *</label>
            <input class="input" name="name" required value="" placeholder="Ej: Migración de servidores">
          </div>
          <div class="col-span-2">
            <label class="label">Cliente *</label>
            <input class="input" name="client" required value="" placeholder="Nombre del cliente, o 'Interno' si es para uso propio">
          </div>
          <div>
            <label class="label">Tipo de Documento</label>
            <div class="flex gap-1.5">
              <select class="input" name="id_document_type" id="doc-type-select">${docOpts}</select>
              <button type="button" id="doc-type-add" class="btn-secondary px-2.5 shrink-0" title="Agregar tipo de documento">${icon('add',16)}</button>
            </div>
          </div>
          <div>
            <label class="label">Número de Documento</label>
            <input class="input" name="id_document_number" value="" placeholder="Ej: 1234567890">
          </div>
          <div>
            <label class="label">Tipo de Proyecto</label>
            <select class="input" name="project_type">${projectTypeOpts}</select>
          </div>
          <div>
            <label class="label">Prioridad</label>
            <select class="input" name="priority">
              <option value="low">Baja</option>
              <option value="medium" selected>Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="label">Familia de Proyecto</label>
            <div class="relative" data-family-wrap>
              <input class="input" name="family" id="family-input" autocomplete="off" value="" placeholder="Ej: GEOVS">
              <div id="family-dropdown" class="family-dropdown hidden absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-20"></div>
            </div>
            <p class="text-xs text-gray-400 mt-1">Vincula proyectos que son variantes del mismo producto (web, móvil, escritorio)</p>
          </div>
        </div>

        ${sectionTitle('Enlaces')}
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label class="label">Link de GitHub</label>
            <input class="input" type="url" name="github_url" value="" placeholder="https://github.com/...">
          </div>
          <div>
            <label class="label">Link de la Página</label>
            <input class="input" type="url" name="website_url" value="" placeholder="https://...">
          </div>
        </div>

        ${sectionTitle('Presupuesto y Fechas')}
        <div class="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label class="label">Presupuesto</label>
            <input class="input" type="number" name="budget" min="0" step="0.01" value="" placeholder="0.00">
          </div>
          <div>
            <label class="label">Moneda</label>
            <select class="input" name="currency">${currencyOpts}</select>
          </div>
          <div>
            <label class="label">Fecha de Inicio</label>
            <input class="input" type="date" name="start_date" value="">
          </div>
          <div>
            <label class="label">Fecha de Entrega</label>
            <input class="input" type="date" name="end_date" value="">
          </div>
          <div class="col-span-2">
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
          <textarea class="input resize-none" name="description" rows="3" placeholder="Qué se necesita y por qué...">${esc(f.description)}</textarea>
        </div>
      </div>

      <!-- Columna 3: Requerimientos -->
      <div>
        ${sectionTitle('Requerimientos')}
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Funcionales</p>
        <div id="req-list-functional" class="space-y-2 mb-2 max-h-40 overflow-y-auto pr-1"></div>
        <div class="mb-2">
          ${richTextToolbar('req-desc-functional')}
          <div id="req-desc-functional" class="rte-input" contenteditable="true" data-placeholder="Nuevo requerimiento..." style="font-size:0.75rem;min-height:32px"></div>
        </div>
        <div class="flex justify-end mb-5">
          <button type="button" id="req-add-functional" class="btn-secondary text-xs px-3">${icon('add',16)} Agregar</button>
        </div>
        <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">No Funcionales</p>
        <div id="req-list-nonfunctional" class="space-y-2 mb-2 max-h-40 overflow-y-auto pr-1"></div>
        <div class="mb-2">
          ${richTextToolbar('req-desc-nonfunctional')}
          <div id="req-desc-nonfunctional" class="rte-input" contenteditable="true" data-placeholder="Nuevo requerimiento..." style="font-size:0.75rem;min-height:32px"></div>
        </div>
        <div class="flex justify-end">
          <button type="button" id="req-add-nonfunctional" class="btn-secondary text-xs px-3">${icon('add',16)} Agregar</button>
        </div>
      </div>
    </div>
  </form>`, '2xl', `
    <div class="flex justify-end gap-3">
      <button type="button" id="modal-cancel" class="btn-secondary">Cancelar</button>
      <button type="submit" form="project-form" class="btn-primary">Enviar Solicitud</button>
    </div>
  `);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('doc-type-add').addEventListener('click', () => addCustomDocType(document.getElementById('doc-type-select')));

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

  wireFamilyPicker();

  _reqProjectId = null;
  _reqs = [];
  renderRequirementsList();
  wireRichEditor('req-desc-functional');
  wireRichEditor('req-desc-nonfunctional');
  document.getElementById('req-add-functional').addEventListener('click', () => addRequirement('functional'));
  document.getElementById('req-add-nonfunctional').addEventListener('click', () => addRequirement('non_functional'));

  document.getElementById('project-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const created = await api.post('/projects', fd);
      for (const r of _reqs) {
        await api.post('/requirements', { project_id: created.id, type: r.type, description: r.description });
      }
      toast('Solicitud enviada — queda a la espera de que ADG la apruebe');
      closeModal();
      load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

/* Reemplaza el <input list>+<datalist> nativo (su desplegable lo
   dibuja el navegador/SO y no se puede re-estilar) por un combobox
   propio, mismo patrón que el selector de tecnologías. */
function wireFamilyPicker() {
  const input = document.getElementById('family-input');
  const dropdown = document.getElementById('family-dropdown');
  if (!input || !dropdown) return;

  const closeDropdown = () => dropdown.classList.add('hidden');
  const openDropdown = () => {
    const q = input.value.trim().toLowerCase();
    const options = _families
      .filter(fm => !q || fm.family.toLowerCase().includes(q))
      .slice(0, 8);
    if (!options.length) { closeDropdown(); return; }
    dropdown.innerHTML = options.map(fm => `
      <button type="button" class="family-option w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left" data-name="${esc(fm.family)}">
        <span class="truncate">${esc(fm.family)}</span>
        <span class="ml-auto text-xs text-gray-400">${fm.count}</span>
      </button>`).join('');
    dropdown.querySelectorAll('.family-option').forEach(opt => {
      opt.addEventListener('click', () => {
        input.value = opt.dataset.name;
        closeDropdown();
      });
    });
    dropdown.classList.remove('hidden');
  };

  input.addEventListener('input', openDropdown);
  input.addEventListener('focus', openDropdown);
  input.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });
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

  document.querySelectorAll('.req-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.id;
      _reqs = _reqs.filter(x => String(x._localId) !== key);
      renderRequirementsList();
    });
  });
}

function reqRow(r) {
  return `
  <div class="flex items-start gap-2 p-2 rounded-lg border border-gray-100 bg-white">
    <div class="flex-1 text-xs text-gray-700 break-words rte-display">${sanitizeRichText(r.description || '')}</div>
    <button type="button" class="req-del text-gray-300 hover:text-red-500 shrink-0" data-id="${r._localId}">${icon('delete',14)}</button>
  </div>`;
}

let _localReqSeq = 0;
function addRequirement(type) {
  const input = document.getElementById(type === 'non_functional' ? 'req-desc-nonfunctional' : 'req-desc-functional');
  if (!input.textContent.trim()) return;
  const description = sanitizeRichText(input.innerHTML);
  _reqs.push({ _localId: `local-${++_localReqSeq}`, type, description });
  input.innerHTML = '';
  renderRequirementsList();
}

function buildDocOpts(current) {
  const fixed = DOC_TYPES.map(([v]) => v);
  const custom = _docTypes.map(d => d.label);
  const opts = DOC_TYPES.map(([v,l]) => [v,l]).concat(_docTypes.map(d => [d.label, d.label]));
  if (current && !fixed.includes(current) && !custom.includes(current)) opts.push([current, current]);
  return opts.map(([v,l]) => `<option value="${esc(v)}" ${current===v?'selected':''}>${esc(l)}</option>`).join('');
}

async function addCustomDocType(selectEl) {
  const label = prompt('Nombre del nuevo tipo de documento (ej: Carné de Extranjería):');
  if (!label || !label.trim()) return;
  try {
    const created = await api.post('/document-types', { label: label.trim() });
    _docTypes.push(created);
    selectEl.innerHTML = buildDocOpts(created.label);
    toast('Tipo de documento agregado');
  } catch (err) { toast(err.message || 'Error al agregar', 'error'); }
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
