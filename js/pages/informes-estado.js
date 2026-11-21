import { api } from '../api.js';
import { navigate } from '../state.js';
import { toast, showModal, closeModal, confirmModal, spinner, icon, pageHeader, fmtDate } from '../utils.js';

// --- Constantes -----------------------------------------------------------
const ESTADOS_INFORME = {
  borrador:    { label: 'Borrador',       color: 'bg-gray-100 text-gray-700 border-gray-300' },
  en_revision: { label: 'En revisi\u00f3n', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  emitido:     { label: 'Emitido',        color: 'bg-blue-100 text-blue-800 border-blue-300' },
  cerrado:     { label: 'Cerrado',        color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

const ESTADOS_RF = {
  operativo_maqueta: 'Operativo en maqueta',
  operativo_local:   'Operativo (solo local)',
  simulado:          'Simulado',
  pendiente:         'Pendiente',
};

const COLORES_RF = {
  operativo_maqueta: 'bg-green-100 text-green-800',
  operativo_local:   'bg-blue-100 text-blue-800',
  simulado:          'bg-yellow-100 text-yellow-800',
  pendiente:         'bg-gray-100 text-gray-600',
};

const ESTADOS_MODULO = {
  terminado: 'Terminado',
  parcial:   'Parcial',
  simulado:  'Simulado',
  pendiente: 'Pendiente',
};

const COLORES_MODULO = {
  terminado: 'bg-emerald-100 text-emerald-800',
  parcial:   'bg-blue-100 text-blue-800',
  simulado:  'bg-yellow-100 text-yellow-800',
  pendiente: 'bg-gray-100 text-gray-600',
};

const EVAL_RNF = ['Cumple', 'Cumple con reserva', 'Limitaci\u00f3n', 'Brecha cr\u00edtica', 'Pendiente'];
const COLORES_RNF = {
  'Cumple':             'bg-emerald-100 text-emerald-800',
  'Cumple con reserva': 'bg-blue-100 text-blue-800',
  'Limitaci\u00f3n':    'bg-yellow-100 text-yellow-800',
  'Brecha cr\u00edtica':'bg-red-100 text-red-800',
  'Pendiente':          'bg-gray-100 text-gray-600',
};

const PRIORIDADES_BRECHA = ['Alta', 'Media', 'Baja'];
const COLORES_PRIORIDAD = {
  Alta:  'bg-red-100 text-red-800',
  Media: 'bg-amber-100 text-amber-800',
  Baja:  'bg-gray-100 text-gray-600',
};

const ESTADO_GENERAL_OPTS = ['INCONCLUSO', 'EN DESARROLLO', 'COMPLETADO', 'PAUSADO'];
const AREAS_PREDETERMINADAS = ['OTI', 'ODN', 'OPP'];
const AREAS_DISPONIBLES = [...AREAS_PREDETERMINADAS, 'ADG', 'GG', 'DST', 'OCOS', 'ODACL', 'ORH', 'OCM'];

const TABS = [
  { id: 'portada',      label: 'Portada' },
  { id: 'componentes',  label: 'Componentes' },
  { id: 'estado',       label: 'Estado del Proyecto' },
  { id: 'rf',           label: 'Req. Funcionales' },
  { id: 'rnf',          label: 'Req. No Funcionales' },
  { id: 'observaciones',label: 'Observaciones' },
  { id: 'brechas',      label: 'Brechas' },
  { id: 'escenarios',   label: 'Escenarios' },
  { id: 'conclusiones', label: 'Conclusiones' },
];

// --- Helpers --------------------------------------------------------------
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stateBadge(estado) {
  const cfg = ESTADOS_INFORME[estado] || { label: estado, color: 'bg-gray-100 text-gray-700 border-gray-300' };
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}">${cfg.label}</span>`;
}

function miniSelect(opts, val, cls = '') {
  return `<select class="input text-sm ${cls}">${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
}

// --- Estado local ---------------------------------------------------------
let _informes  = [];
let _projects  = [];
let _currentInforme = null;
let _tab       = 'portada';
let _saveQueue = Promise.resolve();
let _saveTimer = null;

// --- Punto de entrada p\u00fablico -----------------------------------------------
export function render(params = {}) {
  flushAutosave();
  _currentInforme = null;
  _tab = 'portada';
  if (params.id) {
    renderDetalle(params.id);
  } else {
    renderLista();
  }
}

// ==========================================================================
// LISTA
// ==========================================================================
function mountPage() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="informes-page p-4 sm:p-6 max-w-7xl mx-auto"></div>';
  const page = main.firstElementChild;
  page.innerHTML = spinner();
  return page;
}

async function renderLista() {
  const app = mountPage();

  try {
    const [informes, projects] = await Promise.all([
      api.get('/informes-estado'),
      api.get('/projects'),
    ]);
    if (!app.isConnected) return;
    _informes = informes;
    _projects = projects;
  } catch (e) {
    app.innerHTML = `<div class="card p-6 text-center">
      <p class="text-red-700 mb-4" role="alert">Error al cargar informes: ${esc(e.message)}</p>
      <button class="btn-secondary">Reintentar</button>
    </div>`;
    app.querySelector('button').addEventListener('click', renderLista);
    return;
  }

  const total       = _informes.length;
  const borradores  = _informes.filter(i => i.estado === 'borrador').length;
  const enRevision  = _informes.filter(i => i.estado === 'en_revision').length;
  const emitidos    = _informes.filter(i => i.estado === 'emitido').length;

  app.innerHTML = `
    <div class="[&>div]:flex-wrap [&>div]:gap-3">
      ${pageHeader(
        'Informes de Estado del Proyecto',
        'IT-IE \u00b7 \u00c1rea emisora: OTI \u00b7 Revisores: ODN y OPP \u00b7 Aprueba: ADG',
        `<button data-action="nuevo" class="btn-primary whitespace-nowrap">${icon('add', 18)} Nuevo informe</button>`
      )}
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      ${kpiCard('Total de informes', total, 'summarize', 'bg-primary-50 text-primary-700')}
      ${kpiCard('Borradores', borradores, 'edit_note', 'bg-gray-100 text-gray-500')}
      ${kpiCard('En revisi\u00f3n', enRevision, 'rate_review', 'bg-amber-50 text-amber-600')}
      ${kpiCard('Emitidos', emitidos, 'check_circle', 'bg-blue-50 text-blue-600')}
    </div>

    <section class="card overflow-hidden" aria-labelledby="informes-list-title">
      <div class="flex flex-wrap items-end justify-between gap-4 px-4 sm:px-5 py-4 border-b border-gray-200">
        <div>
          <h2 id="informes-list-title" class="font-semibold text-gray-900">Registro de informes</h2>
          <p id="informes-count" class="text-sm text-gray-500 mt-1" aria-live="polite"></p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full sm:w-auto">
          <label class="label mb-0">Estado
            <select id="filter-estado" class="input mt-1">
              <option value="">Todos los estados</option>
              ${Object.entries(ESTADOS_INFORME).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </label>
          <label class="label mb-0 min-w-0">Proyecto
            <select id="filter-project" class="input mt-1 sm:max-w-64">
              <option value="">Todos los proyectos</option>
              ${_projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>

      <div id="informes-table" class="overflow-x-auto">
        <table class="w-full text-sm" aria-labelledby="informes-list-title">
          <thead>
            <tr class="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
              <th class="px-4 py-3 text-left">C\u00f3digo</th>
              <th class="px-4 py-3 text-left">T\u00edtulo</th>
              <th class="px-4 py-3 text-left">Proyecto</th>
              <th class="px-4 py-3 text-left">Estado</th>
              <th class="px-4 py-3 text-left">Fecha</th>
              <th class="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody id="tabla-informes"></tbody>
        </table>
      </div>
      <div id="informes-empty" hidden></div>
    </section>
  `;

  // Eventos
  document.getElementById('filter-estado').addEventListener('change', aplicarFiltros);
  document.getElementById('filter-project').addEventListener('change', aplicarFiltros);

  app.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'nuevo') openNuevoModal();
    if (action === 'limpiar') {
      document.getElementById('filter-estado').value = '';
      document.getElementById('filter-project').value = '';
      aplicarFiltros();
      document.getElementById('filter-estado').focus();
    }
    if (action === 'eliminar') await eliminarInforme(id);
  });
  aplicarFiltros();
}

function kpiCard(label, value, iconName, colors) {
  return `
    <div class="card p-4 sm:p-5">
      <div class="w-9 h-9 rounded-lg ${colors} flex items-center justify-center" aria-hidden="true">${icon(iconName, 20)}</div>
      <p class="mt-3 text-sm font-medium text-gray-500">${label}</p>
      <p class="mt-1 text-2xl font-bold text-gray-900 tabular-nums">${value}</p>
    </div>`;
}

function emptyState(hasFilters) {
  return `<div class="px-5 py-12 text-center">
    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700" aria-hidden="true">
      ${icon(hasFilters ? 'search_off' : 'description', 24)}
    </div>
    <p class="mt-4 font-semibold text-gray-900">${hasFilters ? 'No hay informes con estos filtros' : 'A\u00fan no hay informes de estado'}</p>
    <p class="mt-1 text-sm text-gray-500">${hasFilters ? 'Prueba con otro estado o proyecto.' : 'Crea un informe para documentar el avance de un proyecto.'}</p>
    <button class="mt-4 ${hasFilters ? 'btn-secondary' : 'btn-primary'}" data-action="${hasFilters ? 'limpiar' : 'nuevo'}">
      ${icon(hasFilters ? 'filter_alt_off' : 'add', 18)} ${hasFilters ? 'Limpiar filtros' : 'Nuevo informe'}
    </button>
  </div>`;
}

function renderFilasInformes(list) {
  if (!list.length) return '';
  return list.map(inf => `
    <tr class="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
      <td class="px-4 py-3">
        <span class="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">${esc(inf.codigo)}</span>
      </td>
      <td class="px-4 py-3 font-medium text-gray-900"><a class="text-primary-700 hover:underline break-words" href="#/informes-estado/${encodeURIComponent(inf.id)}">${esc(inf.titulo)}</a></td>
      <td class="px-4 py-3 text-gray-600 text-sm">${esc(inf.project_name || '\u2014')}</td>
      <td class="px-4 py-3">${stateBadge(inf.estado)}</td>
      <td class="px-4 py-3 text-gray-500 text-sm">${fmtDate(inf.fecha_emision || inf.created_at)}</td>
      <td class="px-4 py-3 text-right">
        <div class="flex items-center justify-end gap-1">
          <a href="#/informes-estado/${encodeURIComponent(inf.id)}" class="p-2 rounded-lg hover:bg-primary-50 text-primary-700" title="Editar informe" aria-label="Editar informe">
            ${icon('edit', 16)}
          </a>
          ${inf.estado === 'borrador' ? `<button data-action="eliminar" data-id="${esc(inf.id)}" class="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Eliminar borrador" aria-label="Eliminar borrador">
            ${icon('delete', 16)}
          </button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

function aplicarFiltros() {
  const estado    = document.getElementById('filter-estado').value;
  const projectId = document.getElementById('filter-project').value;
  let lista = _informes;
  if (estado)    lista = lista.filter(i => i.estado === estado);
  if (projectId) lista = lista.filter(i => String(i.project_id) === projectId);
  document.getElementById('tabla-informes').innerHTML = renderFilasInformes(lista);
  document.getElementById('informes-count').textContent = `${lista.length} ${lista.length === 1 ? 'informe' : 'informes'}`;
  document.getElementById('informes-table').hidden = !lista.length;
  const empty = document.getElementById('informes-empty');
  empty.hidden = !!lista.length;
  empty.innerHTML = lista.length ? '' : emptyState(!!(estado || projectId));
}

async function eliminarInforme(id) {
  const inf = _informes.find(i => String(i.id) === id);
  if (!inf) return;
  const ok = await confirmModal(
    `\u00bfEliminar el informe <strong>${esc(inf.codigo)}</strong>? Esta acci\u00f3n no se puede deshacer.`,
    { title: 'Eliminar informe', confirmLabel: 'Eliminar', danger: true }
  );
  if (!ok) return;
  try {
    await api.delete(`/informes-estado/${id}`);
    toast('Informe eliminado');
    if (location.hash === '#/informes-estado') renderLista();
  } catch (e) {
    toast('Error al eliminar: ' + e.message, 'error');
  }
}

// ==========================================================================
// MODAL NUEVO INFORME
// ==========================================================================
function openNuevoModal() {
  showModal('Nuevo Informe de Estado', `
    <div class="space-y-4">
      <div>
        <label class="label" for="ni-titulo">T\u00edtulo del informe *</label>
        <input id="ni-titulo" class="input w-full" placeholder="Ej: Informe de Estado \u2013 Sistema de Gesti\u00f3n Qubira" />
      </div>
      <div>
        <label class="label" for="ni-project">Proyecto vinculado</label>
        <select id="ni-project" class="input w-full">
          <option value="">\u2014 Sin proyecto \u2014</option>
          ${_projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label" for="ni-fecha">Fecha l\u00edmite de respuesta</label>
        <input id="ni-fecha" type="date" class="input w-full" />
      </div>
    </div>
  `, 'md', `
    <div class="flex justify-end gap-3">
      <button id="ni-cancel" class="btn-secondary">Cancelar</button>
      <button id="ni-crear" class="btn-primary inline-flex items-center gap-1.5">${icon('save', 16)} Crear Informe</button>
    </div>
  `);

  document.getElementById('ni-cancel').addEventListener('click', closeModal);
  const create = document.getElementById('ni-crear');
  create.addEventListener('click', async () => {
    const titulo  = document.getElementById('ni-titulo').value.trim();
    const projId  = document.getElementById('ni-project').value;
    const fecha   = document.getElementById('ni-fecha').value;

    if (!titulo) {
      document.getElementById('ni-titulo').classList.add('border-red-500');
      toast('El t\u00edtulo es obligatorio', 'error');
      return;
    }

    create.disabled = true;
    try {
      const nuevo = await api.post('/informes-estado', {
        titulo, project_id: projId || null, fecha_limite: fecha || null,
        datos: { areas_participantes: AREAS_PREDETERMINADAS },
      });
      toast('Informe creado');
      if (create.isConnected) {
        closeModal();
        navigate(`/informes-estado/${nuevo.id}`);
      }
    } catch (e) {
      toast('Error al crear: ' + e.message, 'error');
    } finally {
      create.disabled = false;
    }
  });
}

// ==========================================================================
// DETALLE / EDICI\u00d3N
// ==========================================================================
async function renderDetalle(id) {
  const app = mountPage();

  try {
    await _saveQueue;
    if (!app.isConnected) return;
    const [informe, projects] = await Promise.all([
      api.get(`/informes-estado/${id}`),
      api.get('/projects'),
    ]);
    if (!app.isConnected) return;
    _currentInforme = { ...informe, datos: informe.datos || {} };
    _projects = projects;
  } catch (e) {
    app.innerHTML = `<p class="text-red-600 p-6">Error al cargar informe: ${esc(e.message)}</p>`;
    return;
  }

  const inf  = _currentInforme;
  const dat  = inf.datos || {};

  mountDetalle(inf, dat);
}

function mountDetalle(inf, dat) {
  const app = document.querySelector('#main > .informes-page');

  app.innerHTML = `
    <!-- Header -->
    <div class="card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
      <div class="flex items-start gap-3">
        <button id="btn-back" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mt-0.5" title="Volver">
          ${icon('arrow_back', 20)}
        </button>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded">${esc(inf.codigo)}</span>
            ${stateBadge(inf.estado)}
            <span class="text-xs text-gray-400">${fmtDate(inf.created_at)}</span>
          </div>
          <h1 id="informe-title" class="text-2xl font-bold text-gray-900 mt-1 break-words">${esc(inf.titulo)}</h1>
          ${inf.project_name ? `<p class="text-sm text-gray-500">${icon('folder_open',14)} ${esc(inf.project_name)}</p>` : ''}
        </div>
      </div>
      <div class="flex flex-wrap gap-2 items-center">
        <span id="save-status" role="status" class="text-xs text-gray-400 italic hidden">Guardando\u2026</span>
        <button id="btn-estado" class="btn-secondary text-sm inline-flex items-center gap-1.5">${icon('swap_horiz',16)} Cambiar estado</button>
        <button id="btn-preview" class="btn-secondary text-sm inline-flex items-center gap-1.5">${icon('print',16)} Vista previa</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="card flex gap-1 overflow-x-auto p-2 mb-4" aria-label="Secciones del informe">
      ${TABS.map(t => `
        <button data-tab="${t.id}" aria-pressed="${_tab === t.id}" class="tab-btn shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${_tab === t.id ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}">
          ${t.label}
        </button>`).join('')}
    </div>

    <!-- Panel de tab -->
    <div id="tab-panel" class="card p-4 sm:p-6 overflow-x-auto">
      ${renderTab(_tab, inf, dat)}
    </div>
  `;

  // Volver
  document.getElementById('btn-back').addEventListener('click', () => {
    flushAutosave();
    navigate('/informes-estado');
  });

  // Cambiar tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        const active = b.dataset.tab === _tab;
        b.setAttribute('aria-pressed', String(active));
        b.className = `tab-btn shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${active ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`;
      });
      document.getElementById('tab-panel').innerHTML = renderTab(_tab, _currentInforme, _currentInforme.datos || {});
      wireTab(_tab);
    });
  });

  // Cambiar estado
  document.getElementById('btn-estado').addEventListener('click', openCambiarEstadoModal);

  // Preview
  document.getElementById('btn-preview').addEventListener('click', openPreview);

  // Wire primer tab
  wireTab(_tab);
}

// ==========================================================================
// RENDER DE TABS
// ==========================================================================
function renderTab(tab, inf, dat) {
  switch (tab) {
    case 'portada':       return renderTabPortada(inf, dat);
    case 'componentes':   return renderTabComponentes(dat);
    case 'estado':        return renderTabEstado(dat);
    case 'rf':            return renderTabRF(dat);
    case 'rnf':           return renderTabRNF(dat);
    case 'observaciones': return renderTabObservaciones(dat);
    case 'brechas':       return renderTabBrechas(dat);
    case 'escenarios':    return renderTabEscenarios(dat);
    case 'conclusiones':  return renderTabConclusiones(inf, dat);
    default:              return '';
  }
}

// -- Tab: Portada ------------------------------------------------------------
function areasParticipantes(dat) {
  return dat.areas_participantes ?? AREAS_PREDETERMINADAS;
}

function renderTabPortada(inf, dat) {
  const seleccionadas = areasParticipantes(dat);
  const opciones = [...new Set([...AREAS_DISPONIBLES, ...seleccionadas])];
  return `
    <h2 class="text-base font-bold text-gray-800 mb-4 pb-2 border-b">1. Portada / Identificaci\u00f3n</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        <label class="label">T\u00edtulo del informe</label>
        <input id="f-titulo" class="input w-full" value="${esc(inf.titulo)}" data-field="titulo" data-root="1" />
      </div>
      <div>
        <label class="label">Versi\u00f3n</label>
        <input id="f-version" class="input w-full" value="${esc(inf.version || '1.0')}" data-field="version" data-root="1" />
      </div>
      <div>
        <label class="label">Dirigido a</label>
        <input id="f-dirigido-a" class="input w-full" value="${esc(dat.dirigido_a || 'Alta Direcci\u00f3n Gerencial (ADG)')}" data-field="dirigido_a" />
      </div>
      <div>
        <label class="label">Ubicaci\u00f3n</label>
        <input id="f-ubicacion" class="input w-full" value="${esc(dat.ubicacion || 'Lima, Per\u00fa')}" data-field="ubicacion" />
      </div>
      <fieldset id="f-areas" class="min-w-0 md:col-span-2">
        <legend class="label">\u00c1reas participantes</legend>
        <div class="flex flex-wrap gap-2">
          ${opciones.map(area => `
            <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <input type="checkbox" class="h-4 w-4 accent-blue-600" value="${esc(area)}" ${seleccionadas.includes(area) ? 'checked' : ''} />
              ${esc(area)}
            </label>`).join('')}
        </div>
      </fieldset>
      <div>
        <label class="label">URL del sitio publicado</label>
        <input id="f-url-sitio" class="input w-full" value="${esc(dat.url_sitio_publicado || '')}" data-field="url_sitio_publicado" />
      </div>
      <div>
        <label class="label">Tecnolog\u00edas usadas</label>
        <input id="f-tecnologias" class="input w-full" value="${esc(dat.tecnologias_usadas || '')}" data-field="tecnologias_usadas" />
      </div>
      <div>
        <label class="label">L\u00edneas de c\u00f3digo (aprox.)</label>
        <input id="f-lineas" type="number" class="input w-full" value="${esc(dat.lineas_codigo || 0)}" data-field="lineas_codigo" />
      </div>
      <div>
        <label class="label">Fecha de emisi\u00f3n</label>
        <input id="f-fecha-emision" type="date" class="input w-full" value="${inf.fecha_emision ? inf.fecha_emision.slice(0,10) : ''}" data-field="fecha_emision" data-root="1" />
      </div>
      <div>
        <label class="label">Fecha l\u00edmite de respuesta</label>
        <input id="f-fecha-limite" type="date" class="input w-full" value="${inf.fecha_limite ? inf.fecha_limite.slice(0,10) : ''}" data-field="fecha_limite" data-root="1" />
      </div>
    </div>
    <h3 class="text-sm font-bold text-gray-700 mt-6 mb-3">2. Resumen Ejecutivo</h3>
    <textarea id="f-resumen" class="input w-full" rows="5" data-field="resumen_ejecutivo">${esc(dat.resumen_ejecutivo || '')}</textarea>
    <h3 class="text-sm font-bold text-gray-700 mt-6 mb-3">3. Antecedentes y Alcance</h3>
    <textarea id="f-antecedentes" class="input w-full" rows="5" data-field="antecedentes">${esc(dat.antecedentes || '')}</textarea>

    <!-- Firmas -->
    <h3 class="text-sm font-bold text-gray-700 mt-8 mb-3">Firmas del documento</h3>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${firmaCard('OTI', 'Elabor\u00f3', inf.elaborado_nombre)}
      ${firmaCard('ODN', 'Revis\u00f3', inf.revisado_por_odn_nombre || '\u2014')}
      ${firmaCard('OPP', 'Revis\u00f3', inf.revisado_por_opp_nombre || '\u2014')}
      ${firmaCard('ADG', 'Aprob\u00f3', inf.aprobado_nombre || '\u2014')}
    </div>
  `;
}

function firmaCard(area, rol, nombre) {
  return `
    <div class="border border-gray-200 rounded-xl p-3 text-center bg-gray-50/50">
      <span class="text-xs font-bold text-gray-500 uppercase">${area}</span>
      <p class="text-xs text-gray-400 mt-0.5">${rol}</p>
      <p class="text-sm font-medium text-gray-700 mt-1">${esc(nombre || '\u2014')}</p>
    </div>`;
}

// -- Tab: Componentes --------------------------------------------------------
function renderTabComponentes(dat) {
  const rows = (dat.componentes || []);
  return `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-bold text-gray-800">Componentes del Proyecto</h2>
      <button id="btn-add-comp" class="btn-primary text-sm inline-flex items-center gap-1.5">${icon('add',16)} Agregar componente</button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
            <th class="px-3 py-2 text-left">Nombre</th>
            <th class="px-3 py-2 text-left">Descripci\u00f3n</th>
            <th class="px-3 py-2 text-left">URL de la p\u00e1gina</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody id="tbody-comp">
          ${rows.map((c, i) => rowComponente(c, i)).join('')}
        </tbody>
      </table>
      ${rows.length === 0 ? `<p class="text-sm text-gray-400 py-6 text-center">Sin componentes registrados.</p>` : ''}
    </div>`;
}

function rowComponente(c, i) {
  return `
    <tr data-ci="${i}" class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="input w-full text-sm comp-nombre" value="${esc(c.nombre || '')}" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm comp-descripcion" value="${esc(c.descripcion || '')}" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm comp-url" value="${esc(c.pagina_url || '')}" /></td>
      <td class="px-3 py-2 text-right">
        <button data-rm-comp="${i}" class="p-1.5 rounded hover:bg-red-50 text-red-400">${icon('delete',15)}</button>
      </td>
    </tr>`;
}

// -- Tab: Estado del Proyecto ------------------------------------------------
function renderTabEstado(dat) {
  const modulos = dat.modulos || [];
  return `
    <h2 class="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Estado Actual del Proyecto</h2>
    <div class="mb-5">
      <label class="label">Estado general</label>
      <select id="f-estado-general" class="input w-full md:w-64" data-field="estado_general">
        ${ESTADO_GENERAL_OPTS.map(o => `<option value="${o}" ${dat.estado_general === o ? 'selected' : ''}>${o}</option>`).join('')}
      </select>
    </div>

    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-gray-700">M\u00f3dulos / Componentes</h3>
      <button id="btn-add-mod" class="btn-primary text-sm inline-flex items-center gap-1.5">${icon('add',16)} Agregar m\u00f3dulo</button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
            <th class="px-3 py-2 text-left">M\u00f3dulo</th>
            <th class="px-3 py-2 text-left">Estado</th>
            <th class="px-3 py-2 text-left">Detalle</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody id="tbody-mod">
          ${modulos.map((m, i) => rowModulo(m, i)).join('')}
        </tbody>
      </table>
      ${modulos.length === 0 ? `<p class="text-sm text-gray-400 py-6 text-center">Sin m\u00f3dulos registrados.</p>` : ''}
    </div>`;
}

function rowModulo(m, i) {
  return `
    <tr data-mi="${i}" class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="input w-full text-sm mod-nombre" value="${esc(m.nombre || '')}" /></td>
      <td class="px-3 py-2">
        <select class="input text-sm mod-estado">
          ${Object.entries(ESTADOS_MODULO).map(([k,v]) => `<option value="${k}" ${m.estado_modulo === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </td>
      <td class="px-3 py-2"><input class="input w-full text-sm mod-detalle" value="${esc(m.detalle || '')}" /></td>
      <td class="px-3 py-2 text-right">
        <button data-rm-mod="${i}" class="p-1.5 rounded hover:bg-red-50 text-red-400">${icon('delete',15)}</button>
      </td>
    </tr>`;
}

// -- Tab: Requerimientos Funcionales -----------------------------------------
function renderTabRF(dat) {
  const reqs = dat.requerimientos || [];
  const total = dat.reqs_funcionales_total || 0;
  return `
    <div class="flex items-center justify-between mb-2">
      <h2 class="text-base font-bold text-gray-800">Requerimientos Funcionales (RF)</h2>
      <div class="flex gap-2 items-center">
        <span class="text-xs text-gray-500">Total declarado:</span>
        <input id="f-rf-total" type="number" class="input w-20 text-sm" value="${total}" data-field="reqs_funcionales_total" min="0" />
        <button id="btn-add-rf" class="btn-primary text-sm inline-flex items-center gap-1.5">${icon('add',16)} Agregar RF</button>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
            <th class="px-3 py-2 text-left w-24">C\u00f3digo</th>
            <th class="px-3 py-2 text-left">Descripci\u00f3n</th>
            <th class="px-3 py-2 text-left w-48">Estado</th>
            <th class="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody id="tbody-rf">
          ${reqs.map((r, i) => rowRF(r, i)).join('')}
        </tbody>
      </table>
      ${reqs.length === 0 ? `<p class="text-sm text-gray-400 py-6 text-center">Sin requerimientos funcionales.</p>` : ''}
    </div>`;
}

function rowRF(r, i) {
  return `
    <tr data-rfi="${i}" class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="input w-full text-sm rf-codigo font-mono" value="${esc(r.codigo || '')}" placeholder="RF-01" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm rf-desc" value="${esc(r.descripcion || '')}" /></td>
      <td class="px-3 py-2">
        <select class="input text-sm rf-estado">
          ${Object.entries(ESTADOS_RF).map(([k,v]) => `<option value="${k}" ${r.estado_rf === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </td>
      <td class="px-3 py-2 text-right">
        <button data-rm-rf="${i}" class="p-1.5 rounded hover:bg-red-50 text-red-400">${icon('delete',15)}</button>
      </td>
    </tr>`;
}

// -- Tab: Requerimientos No Funcionales --------------------------------------
function renderTabRNF(dat) {
  const rnfs = dat.req_no_funcionales || [];
  return `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-bold text-gray-800">Requerimientos No Funcionales (RNF)</h2>
      <button id="btn-add-rnf" class="btn-primary text-sm inline-flex items-center gap-1.5">${icon('add',16)} Agregar RNF</button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50/60">
            <th class="px-3 py-2 text-left w-32">Categor\u00eda</th>
            <th class="px-3 py-2 text-left w-24">C\u00f3digo</th>
            <th class="px-3 py-2 text-left">Descripci\u00f3n</th>
            <th class="px-3 py-2 text-left w-48">Evaluaci\u00f3n</th>
            <th class="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody id="tbody-rnf">
          ${rnfs.map((r, i) => rowRNF(r, i)).join('')}
        </tbody>
      </table>
      ${rnfs.length === 0 ? `<p class="text-sm text-gray-400 py-6 text-center">Sin requerimientos no funcionales.</p>` : ''}
    </div>`;
}

function rowRNF(r, i) {
  return `
    <tr data-rnfi="${i}" class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="input w-full text-sm rnf-cat" value="${esc(r.categoria || '')}" placeholder="Rendimiento" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm rnf-codigo font-mono" value="${esc(r.codigo || '')}" placeholder="RNF-01" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm rnf-desc" value="${esc(r.descripcion || '')}" /></td>
      <td class="px-3 py-2">
        <select class="input text-sm rnf-eval">
          ${EVAL_RNF.map(o => `<option value="${o}" ${r.evaluacion === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </td>
      <td class="px-3 py-2 text-right">
        <button data-rm-rnf="${i}" class="p-1.5 rounded hover:bg-red-50 text-red-400">${icon('delete',15)}</button>
      </td>
    </tr>`;
}

// -- Tab: Observaciones ------------------------------------------------------
function renderTabObservaciones(dat) {
  return `
    <h2 class="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Observaciones por \u00c1rea</h2>
    <div class="space-y-5">
      <div>
        <label class="label flex items-center gap-1.5">${icon('computer',16)} OTI \u2013 Jefatura de Tecnolog\u00edas de Informaci\u00f3n</label>
        <textarea id="f-obs-oti" class="input w-full" rows="4" data-field="obs_oti">${esc(dat.obs_oti || '')}</textarea>
      </div>
      <div>
        <label class="label flex items-center gap-1.5">${icon('business',16)} ODN \u2013 Oficina de Desarrollo de Negocios</label>
        <textarea id="f-obs-odn" class="input w-full" rows="4" data-field="obs_odn">${esc(dat.obs_odn || '')}</textarea>
      </div>
      <div>
        <label class="label flex items-center gap-1.5">${icon('analytics',16)} OPP \u2013 Oficina de Planeamiento y Presupuesto</label>
        <textarea id="f-obs-opp" class="input w-full" rows="4" data-field="obs_opp">${esc(dat.obs_opp || '')}</textarea>
      </div>
    </div>`;
}

// -- Tab: Brechas ------------------------------------------------------------
function renderTabBrechas(dat) {
  const brechas = dat.brechas || [];
  return `
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-bold text-gray-800">Brechas Identificadas</h2>
      <button id="btn-add-brecha" class="btn-primary text-sm inline-flex items-center gap-1.5">${icon('add',16)} Agregar brecha</button>
    </div>
    <div class="space-y-4" id="list-brechas">
      ${brechas.map((b, i) => cardBrecha(b, i)).join('')}
      ${brechas.length === 0 ? `<p class="text-sm text-gray-400 py-6 text-center">Sin brechas registradas.</p>` : ''}
    </div>`;
}

function cardBrecha(b, i) {
  return `
    <div data-bi="${i}" class="border border-gray-200 rounded-xl p-4 bg-gray-50/40 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-gray-500">BRECHA ${i + 1}</span>
        <div class="flex items-center gap-2">
          <select class="input text-xs brecha-prioridad w-28">
            ${PRIORIDADES_BRECHA.map(p => `<option value="${p}" ${b.prioridad === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <button data-rm-brecha="${i}" class="p-1.5 rounded hover:bg-red-50 text-red-400">${icon('delete',15)}</button>
        </div>
      </div>
      <div>
        <label class="label text-xs">Necesidad</label>
        <input class="input w-full text-sm brecha-necesidad" value="${esc(b.necesidad || '')}" placeholder="Qu\u00e9 se necesita" />
      </div>
      <div>
        <label class="label text-xs">Qu\u00e9 implica</label>
        <input class="input w-full text-sm brecha-implica" value="${esc(b.que_implica || '')}" placeholder="Implicaciones t\u00e9cnicas u organizacionales" />
      </div>
      <div>
        <label class="label text-xs">Criterio de aceptaci\u00f3n</label>
        <input class="input w-full text-sm brecha-criterio" value="${esc(b.criterio_aceptacion || '')}" placeholder="Condici\u00f3n para cerrar esta brecha" />
      </div>
    </div>`;
}

// -- Tab: Escenarios de Decisi\u00f3n -------------------------------------------
function renderTabEscenarios(dat) {
  const fasesA = dat.escenario_a_fases || [];
  return `
    <h2 class="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Escenarios de Decisi\u00f3n</h2>

    <!-- Escenario A -->
    <div class="bg-blue-50/50 border border-blue-200 rounded-2xl p-5 mb-5">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">A</span>
        <input id="f-esc-a-titulo" class="input flex-1 font-semibold" value="${esc(dat.escenario_a_titulo || 'La marca contin\u00faa con el proyecto')}" data-field="escenario_a_titulo" />
      </div>
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-gray-600">Fases propuestas</span>
        <button id="btn-add-fase" class="btn-secondary text-xs inline-flex items-center gap-1">${icon('add',14)} Agregar fase</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-blue-200 bg-blue-50/60">
              <th class="px-3 py-2 text-left">Fase</th>
              <th class="px-3 py-2 text-left">Entregable</th>
              <th class="px-3 py-2 text-left">Requerimientos</th>
              <th class="px-3 py-2 text-left w-24">Duraci\u00f3n</th>
              <th class="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody id="tbody-fases">
            ${fasesA.map((f, i) => rowFase(f, i)).join('')}
          </tbody>
        </table>
        ${fasesA.length === 0 ? `<p class="text-xs text-gray-400 py-4 text-center">Sin fases.</p>` : ''}
      </div>
    </div>

    <!-- Escenario B -->
    <div class="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 mb-5">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-7 h-7 rounded-full bg-amber-500 text-white text-sm font-bold flex items-center justify-center">B</span>
        <input id="f-esc-b-titulo" class="input flex-1 font-semibold" value="${esc(dat.escenario_b_titulo || 'La marca no contin\u00faa')}" data-field="escenario_b_titulo" />
      </div>
      <label class="label text-xs">Descripci\u00f3n</label>
      <textarea id="f-esc-b-desc" class="input w-full" rows="4" data-field="escenario_b_descripcion">${esc(dat.escenario_b_descripcion || '')}</textarea>
    </div>

    <!-- Plazo -->
    <div class="flex items-center gap-3">
      <label class="label shrink-0">Plazo de respuesta (d\u00edas)</label>
      <input id="f-plazo" type="number" class="input w-32" value="${dat.plazo_respuesta_dias || 15}" data-field="plazo_respuesta_dias" min="1" />
    </div>`;
}

function rowFase(f, i) {
  return `
    <tr data-fi="${i}" class="border-b border-blue-100">
      <td class="px-3 py-2"><input class="input w-full text-sm fase-fase" value="${esc(f.fase || '')}" placeholder="Fase 1" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm fase-entregable" value="${esc(f.entregable || '')}" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm fase-reqs" value="${esc(f.requerimientos || '')}" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm fase-dur" value="${esc(f.duracion || '')}" placeholder="2 semanas" /></td>
      <td class="px-3 py-2 text-right">
        <button data-rm-fase="${i}" class="p-1.5 rounded hover:bg-red-50 text-red-400">${icon('delete',15)}</button>
      </td>
    </tr>`;
}

// -- Tab: Conclusiones -------------------------------------------------------
function renderTabConclusiones(inf, dat) {
  return `
    <h2 class="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Conclusiones y Recomendaciones</h2>
    <div class="space-y-5">
      <div>
        <label class="label">Conclusiones</label>
        <textarea id="f-conclusiones" class="input w-full" rows="6" data-field="conclusiones">${esc(dat.conclusiones || '')}</textarea>
      </div>
      <div>
        <label class="label">Recomendaci\u00f3n</label>
        <textarea id="f-recomendacion" class="input w-full" rows="4" data-field="recomendacion">${esc(dat.recomendacion || '')}</textarea>
      </div>
      <div>
        <label class="label">Hoja de respuesta (texto de respuesta esperado del ADG)</label>
        <textarea id="f-hoja-respuesta" class="input w-full" rows="4" data-field="hoja_respuesta">${esc(dat.hoja_respuesta || '')}</textarea>
      </div>
    </div>`;
}

// ==========================================================================
// WIRE TABS (eventos interactivos)
// ==========================================================================
function wireTab(tab) {
  switch (tab) {
    case 'portada':       wirePortada(); break;
    case 'componentes':   wireComponentes(); break;
    case 'estado':        wireEstado(); break;
    case 'rf':            wireRF(); break;
    case 'rnf':           wireRNF(); break;
    case 'observaciones': wireObservaciones(); break;
    case 'brechas':       wireBrechas(); break;
    case 'escenarios':    wireEscenarios(); break;
    case 'conclusiones':  wireConclusiones(); break;
  }
}

// -- Wire: Portada -----------------------------------------------------------
function wirePortada() {
  const fields = ['f-titulo', 'f-version', 'f-dirigido-a', 'f-ubicacion',
                  'f-url-sitio', 'f-tecnologias', 'f-lineas', 'f-fecha-emision', 'f-fecha-limite',
                  'f-resumen', 'f-antecedentes'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => scheduleAutosave());
  });
  document.getElementById('f-areas').addEventListener('change', scheduleAutosave);
}

// -- Wire: Componentes -------------------------------------------------------
function wireComponentes() {
  document.getElementById('btn-add-comp')?.addEventListener('click', () => {
    const dat = _currentInforme.datos || {};
    if (!dat.componentes) dat.componentes = [];
    dat.componentes.push({ nombre: '', descripcion: '', pagina_url: '' });
    _currentInforme.datos = dat;
    document.getElementById('tab-panel').innerHTML = renderTab('componentes', _currentInforme, dat);
    wireTab('componentes');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-comp]');
    if (!btn) return;
    const i = parseInt(btn.dataset.rmComp);
    const dat = _currentInforme.datos || {};
    dat.componentes.splice(i, 1);
    document.getElementById('tab-panel').innerHTML = renderTab('componentes', _currentInforme, dat);
    wireTab('componentes');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('input', e => {
    if (!e.target.matches('.comp-nombre,.comp-descripcion,.comp-url')) return;
    const row  = e.target.closest('[data-ci]');
    if (!row) return;
    const i    = parseInt(row.dataset.ci);
    const dat  = _currentInforme.datos;
    const c    = dat.componentes[i];
    if (e.target.classList.contains('comp-nombre'))      c.nombre      = e.target.value;
    if (e.target.classList.contains('comp-descripcion')) c.descripcion = e.target.value;
    if (e.target.classList.contains('comp-url'))         c.pagina_url  = e.target.value;
    scheduleAutosave();
  });
}

// -- Wire: Estado ------------------------------------------------------------
function wireEstado() {
  document.getElementById('f-estado-general')?.addEventListener('change', e => {
    _currentInforme.datos.estado_general = e.target.value;
    scheduleAutosave();
  });

  document.getElementById('btn-add-mod')?.addEventListener('click', () => {
    const dat = _currentInforme.datos || {};
    if (!dat.modulos) dat.modulos = [];
    dat.modulos.push({ nombre: '', estado_modulo: 'pendiente', detalle: '' });
    document.getElementById('tab-panel').innerHTML = renderTab('estado', _currentInforme, dat);
    wireTab('estado');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-mod]');
    if (!btn) return;
    const i = parseInt(btn.dataset.rmMod);
    _currentInforme.datos.modulos.splice(i, 1);
    document.getElementById('tab-panel').innerHTML = renderTab('estado', _currentInforme, _currentInforme.datos);
    wireTab('estado');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('input', e => {
    if (!e.target.matches('.mod-nombre,.mod-estado,.mod-detalle')) return;
    const row = e.target.closest('[data-mi]');
    if (!row) return;
    const i = parseInt(row.dataset.mi);
    const m = _currentInforme.datos.modulos[i];
    if (e.target.classList.contains('mod-nombre'))  m.nombre       = e.target.value;
    if (e.target.classList.contains('mod-estado'))  m.estado_modulo = e.target.value;
    if (e.target.classList.contains('mod-detalle')) m.detalle      = e.target.value;
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('change', e => {
    if (!e.target.classList.contains('mod-estado')) return;
    const row = e.target.closest('[data-mi]');
    if (!row) return;
    const i = parseInt(row.dataset.mi);
    _currentInforme.datos.modulos[i].estado_modulo = e.target.value;
    scheduleAutosave();
  });
}

// -- Wire: RF ----------------------------------------------------------------
function wireRF() {
  document.getElementById('btn-add-rf')?.addEventListener('click', () => {
    const dat = _currentInforme.datos;
    if (!dat.requerimientos) dat.requerimientos = [];
    const n = dat.requerimientos.length + 1;
    dat.requerimientos.push({ codigo: `RF-${String(n).padStart(2,'0')}`, descripcion: '', estado_rf: 'pendiente' });
    document.getElementById('tab-panel').innerHTML = renderTab('rf', _currentInforme, dat);
    wireTab('rf');
    scheduleAutosave();
  });

  document.getElementById('f-rf-total')?.addEventListener('input', e => {
    _currentInforme.datos.reqs_funcionales_total = parseInt(e.target.value) || 0;
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-rf]');
    if (!btn) return;
    const i = parseInt(btn.dataset.rmRf);
    _currentInforme.datos.requerimientos.splice(i, 1);
    document.getElementById('tab-panel').innerHTML = renderTab('rf', _currentInforme, _currentInforme.datos);
    wireTab('rf');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('input', e => {
    if (!e.target.matches('.rf-codigo,.rf-desc')) return;
    const row = e.target.closest('[data-rfi]');
    if (!row) return;
    const i = parseInt(row.dataset.rfi);
    const r = _currentInforme.datos.requerimientos[i];
    if (e.target.classList.contains('rf-codigo')) r.codigo      = e.target.value;
    if (e.target.classList.contains('rf-desc'))   r.descripcion = e.target.value;
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('change', e => {
    if (!e.target.classList.contains('rf-estado')) return;
    const row = e.target.closest('[data-rfi]');
    if (!row) return;
    const i = parseInt(row.dataset.rfi);
    _currentInforme.datos.requerimientos[i].estado_rf = e.target.value;
    scheduleAutosave();
  });
}

// -- Wire: RNF ---------------------------------------------------------------
function wireRNF() {
  document.getElementById('btn-add-rnf')?.addEventListener('click', () => {
    const dat = _currentInforme.datos;
    if (!dat.req_no_funcionales) dat.req_no_funcionales = [];
    const n = dat.req_no_funcionales.length + 1;
    dat.req_no_funcionales.push({ categoria: '', codigo: `RNF-${String(n).padStart(2,'0')}`, descripcion: '', evaluacion: 'Pendiente' });
    document.getElementById('tab-panel').innerHTML = renderTab('rnf', _currentInforme, dat);
    wireTab('rnf');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-rnf]');
    if (!btn) return;
    const i = parseInt(btn.dataset.rmRnf);
    _currentInforme.datos.req_no_funcionales.splice(i, 1);
    document.getElementById('tab-panel').innerHTML = renderTab('rnf', _currentInforme, _currentInforme.datos);
    wireTab('rnf');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('input', e => {
    if (!e.target.matches('.rnf-cat,.rnf-codigo,.rnf-desc')) return;
    const row = e.target.closest('[data-rnfi]');
    if (!row) return;
    const i = parseInt(row.dataset.rnfi);
    const r = _currentInforme.datos.req_no_funcionales[i];
    if (e.target.classList.contains('rnf-cat'))    r.categoria  = e.target.value;
    if (e.target.classList.contains('rnf-codigo')) r.codigo     = e.target.value;
    if (e.target.classList.contains('rnf-desc'))   r.descripcion = e.target.value;
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('change', e => {
    if (!e.target.classList.contains('rnf-eval')) return;
    const row = e.target.closest('[data-rnfi]');
    if (!row) return;
    const i = parseInt(row.dataset.rnfi);
    _currentInforme.datos.req_no_funcionales[i].evaluacion = e.target.value;
    scheduleAutosave();
  });
}

// -- Wire: Observaciones -----------------------------------------------------
function wireObservaciones() {
  ['f-obs-oti', 'f-obs-odn', 'f-obs-opp'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', e => {
      const field = e.target.dataset.field;
      _currentInforme.datos[field] = e.target.value;
      scheduleAutosave();
    });
  });
}

// -- Wire: Brechas -----------------------------------------------------------
function wireBrechas() {
  document.getElementById('btn-add-brecha')?.addEventListener('click', () => {
    const dat = _currentInforme.datos;
    if (!dat.brechas) dat.brechas = [];
    dat.brechas.push({ necesidad: '', que_implica: '', prioridad: 'Media', criterio_aceptacion: '' });
    document.getElementById('tab-panel').innerHTML = renderTab('brechas', _currentInforme, dat);
    wireTab('brechas');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-brecha]');
    if (!btn) return;
    const i = parseInt(btn.dataset.rmBrecha);
    _currentInforme.datos.brechas.splice(i, 1);
    document.getElementById('tab-panel').innerHTML = renderTab('brechas', _currentInforme, _currentInforme.datos);
    wireTab('brechas');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('input', e => {
    if (!e.target.matches('.brecha-necesidad,.brecha-implica,.brecha-criterio')) return;
    const card = e.target.closest('[data-bi]');
    if (!card) return;
    const i = parseInt(card.dataset.bi);
    const b = _currentInforme.datos.brechas[i];
    if (e.target.classList.contains('brecha-necesidad')) b.necesidad         = e.target.value;
    if (e.target.classList.contains('brecha-implica'))   b.que_implica       = e.target.value;
    if (e.target.classList.contains('brecha-criterio'))  b.criterio_aceptacion = e.target.value;
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('change', e => {
    if (!e.target.classList.contains('brecha-prioridad')) return;
    const card = e.target.closest('[data-bi]');
    if (!card) return;
    const i = parseInt(card.dataset.bi);
    _currentInforme.datos.brechas[i].prioridad = e.target.value;
    scheduleAutosave();
  });
}

// -- Wire: Escenarios --------------------------------------------------------
function wireEscenarios() {
  document.getElementById('f-esc-a-titulo')?.addEventListener('input', e => {
    _currentInforme.datos.escenario_a_titulo = e.target.value;
    scheduleAutosave();
  });
  document.getElementById('f-esc-b-titulo')?.addEventListener('input', e => {
    _currentInforme.datos.escenario_b_titulo = e.target.value;
    scheduleAutosave();
  });
  document.getElementById('f-esc-b-desc')?.addEventListener('input', e => {
    _currentInforme.datos.escenario_b_descripcion = e.target.value;
    scheduleAutosave();
  });
  document.getElementById('f-plazo')?.addEventListener('input', e => {
    _currentInforme.datos.plazo_respuesta_dias = parseInt(e.target.value) || 15;
    scheduleAutosave();
  });

  document.getElementById('btn-add-fase')?.addEventListener('click', () => {
    const dat = _currentInforme.datos;
    if (!dat.escenario_a_fases) dat.escenario_a_fases = [];
    dat.escenario_a_fases.push({ fase: '', entregable: '', requerimientos: '', duracion: '' });
    document.getElementById('tab-panel').innerHTML = renderTab('escenarios', _currentInforme, dat);
    wireTab('escenarios');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-fase]');
    if (!btn) return;
    const i = parseInt(btn.dataset.rmFase);
    _currentInforme.datos.escenario_a_fases.splice(i, 1);
    document.getElementById('tab-panel').innerHTML = renderTab('escenarios', _currentInforme, _currentInforme.datos);
    wireTab('escenarios');
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('input', e => {
    if (!e.target.matches('.fase-fase,.fase-entregable,.fase-reqs,.fase-dur')) return;
    const row = e.target.closest('[data-fi]');
    if (!row) return;
    const i = parseInt(row.dataset.fi);
    const f = _currentInforme.datos.escenario_a_fases[i];
    if (e.target.classList.contains('fase-fase'))       f.fase           = e.target.value;
    if (e.target.classList.contains('fase-entregable')) f.entregable     = e.target.value;
    if (e.target.classList.contains('fase-reqs'))       f.requerimientos = e.target.value;
    if (e.target.classList.contains('fase-dur'))        f.duracion       = e.target.value;
    scheduleAutosave();
  });
}

// -- Wire: Conclusiones ------------------------------------------------------
function wireConclusiones() {
  ['f-conclusiones', 'f-recomendacion', 'f-hoja-respuesta'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', e => {
      const field = e.target.dataset.field;
      _currentInforme.datos[field] = e.target.value;
      scheduleAutosave();
    });
  });
}

// ==========================================================================
// AUTOGUARDADO (debounce 1s)
// ==========================================================================
function scheduleAutosave() {
  clearTimeout(_saveTimer);
  collectPortadaFields();
  _saveTimer = setTimeout(flushAutosave, 1000);
  const st = document.getElementById('save-status');
  if (st) { st.textContent = 'Guardando\u2026'; st.classList.remove('hidden'); }
}

function flushAutosave() {
  if (!_saveTimer) return _saveQueue;
  clearTimeout(_saveTimer);
  _saveTimer = null;
  const informe = _currentInforme;
  const payload = structuredClone(buildPayload());
  const status = document.getElementById('save-status');

  _saveQueue = _saveQueue.then(async () => {
    try {
      await api.put(`/informes-estado/${informe.id}`, payload);
      if (_currentInforme === informe && !_saveTimer && status?.isConnected) {
        status.textContent = 'Guardado';
        const title = document.getElementById('informe-title');
        if (title) title.textContent = informe.titulo;
      }
    } catch (e) {
      if (status?.isConnected) status.textContent = 'Error al guardar';
      toast('Error al guardar: ' + e.message, 'error');
    }
  });
  return _saveQueue;
}

function collectPortadaFields() {
  if (_tab !== 'portada') return;
  const dat = _currentInforme.datos || {};

  const get = id => document.getElementById(id)?.value ?? null;

  if (get('f-titulo') !== null) _currentInforme.titulo = get('f-titulo');
  if (get('f-version') !== null) _currentInforme.version = get('f-version');
  if (get('f-fecha-emision') !== null) _currentInforme.fecha_emision = get('f-fecha-emision') || null;
  if (get('f-fecha-limite') !== null) _currentInforme.fecha_limite = get('f-fecha-limite') || null;

  if (get('f-dirigido-a') !== null) dat.dirigido_a = get('f-dirigido-a');
  if (get('f-ubicacion') !== null) dat.ubicacion = get('f-ubicacion');
  const areaSelector = document.getElementById('f-areas');
  if (areaSelector) {
    dat.areas_participantes = Array.from(areaSelector.querySelectorAll('input:checked'), input => input.value);
  }
  if (get('f-url-sitio') !== null) dat.url_sitio_publicado = get('f-url-sitio');
  if (get('f-tecnologias') !== null) dat.tecnologias_usadas = get('f-tecnologias');
  if (get('f-lineas') !== null) dat.lineas_codigo = parseInt(get('f-lineas')) || 0;
  if (get('f-resumen') !== null) dat.resumen_ejecutivo = get('f-resumen');
  if (get('f-antecedentes') !== null) dat.antecedentes = get('f-antecedentes');

  _currentInforme.datos = dat;
}

function buildPayload() {
  const inf = _currentInforme;
  return {
    titulo:          inf.titulo,
    version:         inf.version,
    fecha_emision:   inf.fecha_emision || null,
    fecha_limite:    inf.fecha_limite  || null,
    datos:           inf.datos || {},
  };
}

// ==========================================================================
// CAMBIAR ESTADO
// ==========================================================================
function openCambiarEstadoModal() {
  const orden = ['borrador', 'en_revision', 'emitido', 'cerrado'];
  const informe = _currentInforme;
  const actual = informe.estado;
  const idx = orden.indexOf(actual);

  showModal('Cambiar estado del informe', `
    <p class="text-sm text-gray-600 mb-4">Estado actual: ${stateBadge(actual)}</p>
    <div class="space-y-2">
      ${orden.map((e, i) => {
        const cfg = ESTADOS_INFORME[e];
        const isCurrent = e === actual;
        const isPrev = i < idx;
        return `
          <button data-new-estado="${e}" class="w-full text-left px-4 py-3 rounded-xl border ${isCurrent ? 'border-primary-400 bg-primary-50 cursor-default' : isPrev ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50 cursor-pointer'} flex items-center justify-between transition-colors">
            <span class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${isCurrent ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-300'}">${isCurrent ? '\u2713' : i + 1}</span>
              <span class="text-sm font-medium">${cfg.label}</span>
            </span>
            ${isCurrent ? `<span class="text-xs text-primary-600 font-semibold">Actual</span>` : !isPrev ? `<span class="text-xs text-gray-400">\u2192 Siguiente</span>` : ''}
          </button>`;
      }).join('')}
    </div>
  `, 'sm');

  const buttons = [...document.querySelectorAll('[data-new-estado]')];
  buttons.forEach(btn => {
    const e = btn.dataset.newEstado;
    const i = orden.indexOf(e);
    btn.disabled = i <= idx;
    if (btn.disabled) return;
    btn.addEventListener('click', async () => {
      buttons.forEach(button => { button.disabled = true; });
      try {
        await flushAutosave();
        await api.patch(`/informes-estado/${informe.id}/estado`, { estado: e });
        informe.estado = e;
        toast(`Estado cambiado a: ${ESTADOS_INFORME[e].label}`);
        if (btn.isConnected) closeModal();
        if (_currentInforme === informe && location.hash === `#/informes-estado/${informe.id}`) {
          mountDetalle(informe, informe.datos);
        }
      } catch (err) {
        buttons.slice(idx + 1).forEach(button => { button.disabled = false; });
        toast('Error: ' + err.message, 'error');
      }
    });
  });
}

// ==========================================================================
// VISTA PREVIA / PREVIEW COMPLETO
// ==========================================================================
function openPreview() {
  const inf = _currentInforme;
  const dat = inf.datos || {};

  showModal(
    `${esc(inf.codigo)} \u2013 Vista previa`,
    buildPreviewHTML(inf, dat),
    '2xl'
  );
}

function buildPreviewHTML(inf, dat) {
  const reqs = dat.requerimientos || [];
  const rnfs = dat.req_no_funcionales || [];
  const modulos = dat.modulos || [];
  const componentes = dat.componentes || [];
  const brechas = dat.brechas || [];
  const fasesA = dat.escenario_a_fases || [];

  const rfTotal = reqs.length;
  const rfOpMaqueta = reqs.filter(r => r.estado_rf === 'operativo_maqueta').length;
  const rfSimulado  = reqs.filter(r => r.estado_rf === 'simulado').length;
  const rfPendiente = reqs.filter(r => r.estado_rf === 'pendiente').length;

  return `
    <div class="max-w-3xl mx-auto font-sans text-sm text-gray-800 space-y-6" id="preview-content">

      <!-- Encabezado institucional -->
      <div class="text-center border-b-2 border-gray-800 pb-4">
        <div class="text-xs text-gray-500 uppercase tracking-widest">QUBIRA S.A.C.</div>
        <h1 class="text-xl font-bold uppercase mt-1">INFORME DE ESTADO DEL PROYECTO</h1>
        <div class="font-mono font-bold text-base mt-1">${esc(inf.codigo)}</div>
        <p class="text-xs text-gray-500 mt-1">Versi\u00f3n ${esc(inf.version || '1.0')} \u00b7 ${fmtDate(inf.fecha_emision || inf.created_at)}</p>
      </div>

      <!-- Portada info -->
      <table class="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
        <tbody>
          <tr class="bg-gray-50"><td class="px-3 py-2 font-semibold w-40">T\u00edtulo</td><td class="px-3 py-2">${esc(inf.titulo)}</td></tr>
          <tr><td class="px-3 py-2 font-semibold">Dirigido a</td><td class="px-3 py-2">${esc(dat.dirigido_a || 'ADG')}</td></tr>
          <tr class="bg-gray-50"><td class="px-3 py-2 font-semibold">\u00c1reas</td><td class="px-3 py-2">${esc(areasParticipantes(dat).join(', '))}</td></tr>
          <tr><td class="px-3 py-2 font-semibold">Ubicaci\u00f3n</td><td class="px-3 py-2">${esc(dat.ubicacion || '')}</td></tr>
          <tr class="bg-gray-50"><td class="px-3 py-2 font-semibold">Estado general</td><td class="px-3 py-2 font-bold">${esc(dat.estado_general || '\u2014')}</td></tr>
          <tr><td class="px-3 py-2 font-semibold">Tecnolog\u00edas</td><td class="px-3 py-2">${esc(dat.tecnologias_usadas || '\u2014')}</td></tr>
          <tr class="bg-gray-50"><td class="px-3 py-2 font-semibold">L\u00edneas de c\u00f3digo</td><td class="px-3 py-2">${dat.lineas_codigo || 0}</td></tr>
        </tbody>
      </table>

      <!-- Resumen Ejecutivo -->
      ${dat.resumen_ejecutivo ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">1. Resumen Ejecutivo</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.resumen_ejecutivo)}</p>
        </div>` : ''}

      <!-- Antecedentes -->
      ${dat.antecedentes ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">2. Antecedentes y Alcance</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.antecedentes)}</p>
        </div>` : ''}

      <!-- Componentes -->
      ${componentes.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Componentes del Proyecto</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left">Nombre</th><th class="px-3 py-1.5 text-left">Descripci\u00f3n</th><th class="px-3 py-1.5 text-left">URL</th></tr></thead>
            <tbody>${componentes.map((c,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5">${esc(c.nombre)}</td><td class="px-3 py-1.5">${esc(c.descripcion)}</td><td class="px-3 py-1.5 font-mono text-xs">${esc(c.pagina_url)}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- M\u00f3dulos -->
      ${modulos.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">3. Estado de M\u00f3dulos</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left">M\u00f3dulo</th><th class="px-3 py-1.5 text-left">Estado</th><th class="px-3 py-1.5 text-left">Detalle</th></tr></thead>
            <tbody>${modulos.map((m,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-medium">${esc(m.nombre)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_MODULO[m.estado_modulo] || ''}">${ESTADOS_MODULO[m.estado_modulo] || m.estado_modulo}</span></td><td class="px-3 py-1.5">${esc(m.detalle)}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- RF -->
      ${reqs.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">4. Requerimientos Funcionales (${rfTotal} total \u2013 ${rfOpMaqueta} operativos, ${rfSimulado} simulados, ${rfPendiente} pendientes)</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left w-20">C\u00f3digo</th><th class="px-3 py-1.5 text-left">Descripci\u00f3n</th><th class="px-3 py-1.5 text-left w-40">Estado</th></tr></thead>
            <tbody>${reqs.map((r,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-mono font-bold">${esc(r.codigo)}</td><td class="px-3 py-1.5">${esc(r.descripcion)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_RF[r.estado_rf] || ''}">${ESTADOS_RF[r.estado_rf] || r.estado_rf}</span></td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- RNF -->
      ${rnfs.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">5. Requerimientos No Funcionales</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left">Categor\u00eda</th><th class="px-3 py-1.5 text-left w-20">C\u00f3digo</th><th class="px-3 py-1.5 text-left">Descripci\u00f3n</th><th class="px-3 py-1.5 text-left w-40">Evaluaci\u00f3n</th></tr></thead>
            <tbody>${rnfs.map((r,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-medium">${esc(r.categoria)}</td><td class="px-3 py-1.5 font-mono font-bold">${esc(r.codigo)}</td><td class="px-3 py-1.5">${esc(r.descripcion)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_RNF[r.evaluacion] || ''}">${esc(r.evaluacion)}</span></td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- Observaciones -->
      ${(dat.obs_oti || dat.obs_odn || dat.obs_opp) ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">6. Observaciones por \u00c1rea</h2>
          ${dat.obs_oti ? `<div class="mb-3"><p class="font-semibold text-xs text-gray-600 mb-1">OTI \u2013 Jefatura de TI</p><p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.obs_oti)}</p></div>` : ''}
          ${dat.obs_odn ? `<div class="mb-3"><p class="font-semibold text-xs text-gray-600 mb-1">ODN \u2013 Desarrollo de Negocios</p><p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.obs_odn)}</p></div>` : ''}
          ${dat.obs_opp ? `<div><p class="font-semibold text-xs text-gray-600 mb-1">OPP \u2013 Planeamiento y Presupuesto</p><p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.obs_opp)}</p></div>` : ''}
        </div>` : ''}

      <!-- Brechas -->
      ${brechas.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">7. Brechas Identificadas</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left">#</th><th class="px-3 py-1.5 text-left">Necesidad</th><th class="px-3 py-1.5 text-left">Qu\u00e9 implica</th><th class="px-3 py-1.5 text-left w-20">Prioridad</th><th class="px-3 py-1.5 text-left">Criterio aceptaci\u00f3n</th></tr></thead>
            <tbody>${brechas.map((b,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-bold text-gray-500">${i+1}</td><td class="px-3 py-1.5">${esc(b.necesidad)}</td><td class="px-3 py-1.5">${esc(b.que_implica)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_PRIORIDAD[b.prioridad] || ''}">${esc(b.prioridad)}</span></td><td class="px-3 py-1.5">${esc(b.criterio_aceptacion)}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- Escenarios -->
      <div>
        <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">8. Escenarios de Decisi\u00f3n</h2>
        <div class="mb-4">
          <p class="font-bold mb-2">Escenario A: ${esc(dat.escenario_a_titulo || '')}</p>
          ${fasesA.length ? `
            <table class="w-full text-xs border border-gray-200">
              <thead><tr class="bg-blue-50 font-semibold"><th class="px-3 py-1.5 text-left">Fase</th><th class="px-3 py-1.5 text-left">Entregable</th><th class="px-3 py-1.5 text-left">Requerimientos</th><th class="px-3 py-1.5 text-left">Duraci\u00f3n</th></tr></thead>
              <tbody>${fasesA.map((f,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-medium">${esc(f.fase)}</td><td class="px-3 py-1.5">${esc(f.entregable)}</td><td class="px-3 py-1.5">${esc(f.requerimientos)}</td><td class="px-3 py-1.5">${esc(f.duracion)}</td></tr>`).join('')}</tbody>
            </table>` : '<p class="text-xs text-gray-400">Sin fases definidas.</p>'}
        </div>
        <div>
          <p class="font-bold mb-1">Escenario B: ${esc(dat.escenario_b_titulo || '')}</p>
          ${dat.escenario_b_descripcion ? `<p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.escenario_b_descripcion)}</p>` : ''}
        </div>
        <p class="mt-3 text-xs text-gray-500">Plazo de respuesta: <strong>${dat.plazo_respuesta_dias || 15} d\u00edas h\u00e1biles</strong></p>
      </div>

      <!-- Conclusiones -->
      ${dat.conclusiones ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">9. Conclusiones</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.conclusiones)}</p>
        </div>` : ''}
      ${dat.recomendacion ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Recomendaci\u00f3n</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.recomendacion)}</p>
        </div>` : ''}

      <!-- Firmas -->
      <div class="border-t-2 border-gray-800 pt-4">
        <h2 class="font-bold text-sm uppercase mb-3">Firmas</h2>
        <div class="grid grid-cols-4 gap-3">
          ${['OTI \u00b7 Elabor\u00f3', 'ODN \u00b7 Revis\u00f3', 'OPP \u00b7 Revis\u00f3', 'ADG \u00b7 Aprob\u00f3'].map(f => `
            <div class="text-center border border-gray-300 rounded p-3">
              <div class="h-10 border-b border-gray-400 mb-2"></div>
              <p class="text-xs font-semibold">${f}</p>
            </div>`).join('')}
        </div>
      </div>

      <!-- Hoja de respuesta -->
      ${dat.hoja_respuesta ? `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 class="font-bold text-sm uppercase mb-2">10. Hoja de Respuesta</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${esc(dat.hoja_respuesta)}</p>
        </div>` : ''}
    </div>`;
}
