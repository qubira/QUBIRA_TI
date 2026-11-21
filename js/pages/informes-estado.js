import { api } from '../api.js';
import { navigate } from '../state.js';
import { toast, showModal, closeModal, confirmModal, spinner, icon, pageHeader, fmtDate, ESTADOS_IMPLEMENTACION as ESTADOS_RF } from '../utils.js';

// --- Constantes -----------------------------------------------------------
const ESTADOS_INFORME = {
  borrador:    { label: 'Borrador',       color: 'bg-gray-100 text-gray-700 border-gray-300' },
  en_revision: { label: 'En revisi\u00f3n', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  emitido:     { label: 'Emitido',        color: 'bg-blue-100 text-blue-800 border-blue-300' },
  cerrado:     { label: 'Cerrado',        color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
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

const EVAL_RNF = [...new Set([
  'Cumple', 'Cumple con reserva', 'Limitaci\u00f3n', 'Brecha cr\u00edtica', ...Object.values(ESTADOS_RF),
])];
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
  { id: 'anexos',       label: 'Anexos' },
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
async function leerProyectoParaInforme(id) {
  const [proyecto, requisitos, tecnologias] = await Promise.all([
    api.get(`/projects/${encodeURIComponent(id)}`),
    api.get('/requirements', { project_id: id }),
    api.get('/technologies', { project_id: id }),
  ]);
  const plantilla = document.createElement('template');
  const convertir = (req, indice, funcional) => {
    plantilla.innerHTML = req.description || '';
    plantilla.content.querySelectorAll('script, style').forEach(node => node.remove());
    plantilla.content.querySelectorAll('br').forEach(node => node.replaceWith(' '));
    let descripcion = plantilla.content.textContent.trim().replace(/^\[(?:RF|RNF)-\d+\]\s*/i, '');
    const separador = descripcion.lastIndexOf(' \u2014 ');
    const etiqueta = separador >= 0 ? descripcion.slice(separador + 3).trim().replace(/\.$/, '') : '';
    const estado = funcional ? Object.keys(ESTADOS_RF).find(key => ESTADOS_RF[key] === etiqueta) : EVAL_RNF.find(value => value === etiqueta);
    if (estado) descripcion = descripcion.slice(0, separador).trim();
    const codigo = `${funcional ? 'RF' : 'RNF'}-${String(indice + 1).padStart(2, '0')}`;
    const implementacion = Object.hasOwn(ESTADOS_RF, req.implementation_status) ? req.implementation_status : null;
    const comun = { codigo, descripcion, requisito_proyecto_id: req.id, implementation_status: implementacion };
    if (funcional) return { ...comun, estado_rf: implementacion || estado || 'pendiente' };
    return { ...comun, evaluacion: ESTADOS_RF[implementacion] || estado || 'Pendiente' };
  };
  const requerimientos = requisitos.filter(req => req.type !== 'non_functional').map((req, i) => convertir(req, i, true));
  const req_no_funcionales = requisitos.filter(req => req.type === 'non_functional').map((req, i) => convertir(req, i, false));
  return {
    proyecto_origen: {
      codigo: proyecto.code, nombre: proyecto.name, cliente: proyecto.client,
      responsable: proyecto.responsible_name, avance: proyecto.progress,
      inicio: proyecto.start_date, entrega: proyecto.end_date, repositorio: proyecto.github_url,
    },
    antecedentes: proyecto.description?.trim() || '',
    url_sitio_publicado: proyecto.website_url || '',
    tecnologias_usadas: [...new Set(tecnologias.map(t => t.name?.trim()).filter(Boolean))].join(', '),
    estado_general: {
      pending: 'INCONCLUSO', active: 'EN DESARROLLO', paused: 'PAUSADO',
      finished_by_ti: 'EN DESARROLLO', completed: 'COMPLETADO', cancelled: 'INCONCLUSO',
    }[proyecto.status],
    requerimientos,
    req_no_funcionales,
    reqs_funcionales_total: requerimientos.length,
  };
}

function actualizarEstadosRequisitos(actuales, origen, funcional) {
  const normalizar = req => (req.descripcion || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  const porId = new Map(origen.filter(r => r.requisito_proyecto_id != null).map(r => [String(r.requisito_proyecto_id), r]));
  const porDescripcion = new Map();
  const frecuencias = new Map();
  for (const req of origen) {
    const clave = normalizar(req);
    if (clave) porDescripcion.set(clave, porDescripcion.has(clave) ? null : req);
  }
  for (const req of actuales) {
    const clave = normalizar(req);
    frecuencias.set(clave, (frecuencias.get(clave) || 0) + 1);
  }
  return actuales.map(req => {
    const clave = normalizar(req);
    const fuente = req.requisito_proyecto_id != null
      ? porId.get(String(req.requisito_proyecto_id))
      : frecuencias.get(clave) === 1 ? porDescripcion.get(clave) : null;
    if (!fuente) return req;
    const estado = fuente.implementation_status;
    const actualizado = { ...req, requisito_proyecto_id: fuente.requisito_proyecto_id };
    if (estado) {
      actualizado.implementation_status = estado;
      if (funcional) actualizado.estado_rf = estado;
      else actualizado.evaluacion = ESTADOS_RF[estado];
    }
    return actualizado;
  });
}

function completarDesdeProyecto(actual, origen) {
  const datos = { ...actual, proyecto_origen: origen.proyecto_origen };
  for (const campo of ['url_sitio_publicado', 'tecnologias_usadas', 'estado_general']) {
    if (!datos[campo] && origen[campo]) datos[campo] = origen[campo];
  }
  if (!datos.antecedentes?.trim() && !datos.antecedentes_tablas?.length && origen.antecedentes) {
    datos.antecedentes = origen.antecedentes;
    delete datos.antecedentes_segmentos;
  }
  if (!datos.requerimientos?.length) {
    datos.requerimientos = origen.requerimientos;
    if (!datos.reqs_funcionales_total) datos.reqs_funcionales_total = origen.reqs_funcionales_total;
  } else datos.requerimientos = actualizarEstadosRequisitos(datos.requerimientos, origen.requerimientos, true);
  datos.req_no_funcionales = datos.req_no_funcionales?.length
    ? actualizarEstadosRequisitos(datos.req_no_funcionales, origen.req_no_funcionales, false)
    : origen.req_no_funcionales;
  return datos;
}

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
        <p class="mt-1 text-xs text-gray-500">Se copiar\u00e1n los datos disponibles y los requisitos del proyecto.</p>
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
  const proyecto = document.getElementById('ni-project');
  const tituloInput = document.getElementById('ni-titulo');
  let tituloSugerido = '';
  proyecto.addEventListener('change', () => {
    const seleccionado = _projects.find(p => String(p.id) === proyecto.value);
    const sugerencia = seleccionado ? `Informe de estado del proyecto ${seleccionado.name}` : '';
    if (!tituloInput.value.trim() || tituloInput.value === tituloSugerido) tituloInput.value = sugerencia;
    tituloSugerido = sugerencia;
  });
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
      const datos = { areas_participantes: AREAS_PREDETERMINADAS };
      if (projId) Object.assign(datos, await leerProyectoParaInforme(projId));
      if (!create.isConnected) return;
      const nuevo = await api.post('/informes-estado', {
        titulo, project_id: projId || null, fecha_limite: fecha || null,
        datos,
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
    <div class="sticky top-0 z-20 -mt-2 space-y-2 bg-gray-50 pt-2 pb-3">
    <header class="card flex flex-col justify-between gap-3 border-l-4 border-l-primary-500 px-3 py-3 sm:px-4 lg:flex-row lg:items-center">
      <div class="flex min-w-0 items-start gap-3">
        <button id="btn-back" class="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200" aria-label="Volver a informes" title="Volver a informes">
          ${icon('arrow_back', 20)}
        </button>
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono text-sm font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded">${esc(inf.codigo)}</span>
            ${stateBadge(inf.estado)}
            <span class="text-xs text-gray-400">${fmtDate(inf.created_at)}</span>
          </div>
          <h1 id="informe-title" class="mt-1 line-clamp-2 break-words text-base font-bold leading-snug text-gray-900 sm:text-xl" title="${esc(inf.titulo)}">${esc(inf.titulo)}</h1>
          ${inf.project_name ? `<p class="text-sm text-gray-500">${icon('folder_open',14)} ${esc(inf.project_name)}</p>` : ''}
        </div>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        ${inf.project_id ? `<button id="btn-importar-proyecto" class="btn-secondary whitespace-nowrap">${icon('sync', 16)} Completar desde proyecto</button>` : ''}
        <button id="btn-estado" class="btn-secondary whitespace-nowrap">${icon('swap_horiz',16)} Cambiar estado</button>
        <button id="btn-preview" class="btn-primary whitespace-nowrap">${icon('print',16)} Vista previa</button>
        <span id="save-status" role="status" class="min-h-4 basis-full text-xs text-gray-500 lg:text-right"></span>
      </div>
    </header>

    <nav class="card flex gap-1 overflow-x-auto p-1.5" aria-label="Secciones del informe">
      ${TABS.map(t => `
        <button data-tab="${t.id}" aria-pressed="${_tab === t.id}" class="tab-btn shrink-0 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 aria-pressed:bg-primary-50 aria-pressed:text-primary-700">
          ${t.label}
        </button>`).join('')}
    </nav>
    <div id="acciones-brechas" class="card items-center justify-between gap-3 px-3 py-2 ${_tab === 'brechas' ? 'flex' : 'hidden'}">
      <div>
        <h2 class="text-sm font-semibold text-gray-900">Brechas identificadas</h2>
        <p id="conteo-brechas" class="text-xs text-gray-500" aria-live="polite"></p>
      </div>
      <button type="button" id="btn-add-brecha" class="btn-primary whitespace-nowrap">${icon('add', 16)} Agregar brecha</button>
    </div>
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
      const accionesBrechas = document.getElementById('acciones-brechas');
      accionesBrechas.classList.toggle('hidden', _tab !== 'brechas');
      accionesBrechas.classList.toggle('flex', _tab === 'brechas');
      document.querySelectorAll('.tab-btn').forEach(b => {
        const active = b.dataset.tab === _tab;
        b.setAttribute('aria-pressed', String(active));
      });
      document.getElementById('tab-panel').innerHTML = renderTab(_tab, _currentInforme, _currentInforme.datos || {});
      wireTab(_tab);
      document.getElementById('main').scrollTop = 0;
    });
  });

  // Cambiar estado
  document.getElementById('btn-estado').addEventListener('click', openCambiarEstadoModal);

  // Preview
  document.getElementById('btn-preview').addEventListener('click', openPreview);
  document.getElementById('btn-add-brecha').addEventListener('click', agregarBrecha);
  const importar = document.getElementById('btn-importar-proyecto');
  importar?.addEventListener('click', async () => {
    importar.disabled = true;
    try {
      const origen = await leerProyectoParaInforme(inf.project_id);
      if (!importar.isConnected) return;
      collectPortadaFields();
      inf.datos = completarDesdeProyecto(inf.datos, origen);
      document.getElementById('tab-panel').innerHTML = renderTab(_tab, inf, inf.datos);
      wireTab(_tab);
      scheduleAutosave();
      await flushAutosave();
    } catch (e) {
      toast('Error al cargar los datos del proyecto: ' + e.message, 'error');
    } finally {
      importar.disabled = false;
    }
  });

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
    case 'anexos':        return renderTabAnexos();
    default:              return '';
  }
}

// -- Tab: Portada ------------------------------------------------------------
function areasParticipantes(dat) {
  return dat.areas_participantes ?? AREAS_PREDETERMINADAS;
}

function renderProyectoOrigen(proyecto) {
  if (!proyecto) return '';
  const campos = [
    ['Proyecto', [proyecto.codigo, proyecto.nombre].filter(Boolean).join(' \u00b7 ')],
    ['Cliente', proyecto.cliente],
    ['Responsable', proyecto.responsable],
    ['Avance del proyecto', proyecto.avance == null ? '' : `${proyecto.avance}%`],
    ['Inicio', proyecto.inicio && fmtDate(proyecto.inicio)],
    ['Entrega del proyecto', proyecto.entrega && fmtDate(proyecto.entrega)],
    ['Repositorio', proyecto.repositorio],
  ].filter(([, valor]) => valor);
  return `<section class="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
    <h3 class="mb-3 font-semibold text-gray-900">Proyecto vinculado</h3>
    <dl class="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
      ${campos.map(([etiqueta, valor]) => `<div class="min-w-0">
        <dt class="text-xs text-gray-500">${etiqueta}</dt>
        <dd class="break-words font-medium text-gray-900">${esc(valor)}</dd>
      </div>`).join('')}
    </dl>
  </section>`;
}

function renderTabPortada(inf, dat) {
  const seleccionadas = areasParticipantes(dat);
  const opciones = [...new Set([...AREAS_DISPONIBLES, ...seleccionadas])];
  return `
    <h2 class="text-lg font-bold text-gray-900 mb-5">Portada del informe</h2>
    ${renderProyectoOrigen(dat.proyecto_origen)}
    <section class="rounded-xl border border-gray-200 p-4 sm:p-5 mb-4" aria-labelledby="portada-identificacion">
      <h3 id="portada-identificacion" class="font-semibold text-gray-900 mb-4">Identificaci\u00f3n</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="label" for="f-titulo">T\u00edtulo del informe</label>
          <input id="f-titulo" class="input w-full" value="${esc(inf.titulo)}" data-field="titulo" data-root="1" />
        </div>
        <div>
          <label class="label" for="f-version">Versi\u00f3n</label>
          <input id="f-version" class="input w-full" value="${esc(inf.version || '1.0')}" data-field="version" data-root="1" />
        </div>
        <div>
          <label class="label" for="f-dirigido-a">Dirigido a</label>
          <input id="f-dirigido-a" class="input w-full" value="${esc(dat.dirigido_a || 'Alta Direcci\u00f3n Gerencial (ADG)')}" data-field="dirigido_a" />
        </div>
        <div>
          <label class="label" for="f-ubicacion">Ubicaci\u00f3n</label>
          <input id="f-ubicacion" class="input w-full" value="${esc(dat.ubicacion || 'Lima, Per\u00fa')}" data-field="ubicacion" />
        </div>
        <div>
          <label class="label" for="f-fecha-emision">Fecha de emisi\u00f3n</label>
          <input id="f-fecha-emision" type="date" class="input w-full" value="${inf.fecha_emision ? inf.fecha_emision.slice(0,10) : ''}" data-field="fecha_emision" data-root="1" />
        </div>
        <div>
          <label class="label" for="f-fecha-limite">Fecha l\u00edmite de respuesta</label>
          <input id="f-fecha-limite" type="date" class="input w-full" value="${inf.fecha_limite ? inf.fecha_limite.slice(0,10) : ''}" data-field="fecha_limite" data-root="1" />
        </div>
      </div>
    </section>
    <fieldset id="f-areas" class="min-w-0 rounded-xl border border-gray-200 p-4 sm:p-5 mb-4">
        <legend class="px-2 font-semibold text-gray-900">\u00c1reas participantes</legend>
        <div class="flex flex-wrap gap-2">
          ${opciones.map(area => `
            <label class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <input type="checkbox" class="h-4 w-4 accent-blue-600" value="${esc(area)}" ${seleccionadas.includes(area) ? 'checked' : ''} />
              ${esc(area)}
            </label>`).join('')}
        </div>
    </fieldset>
    <section class="rounded-xl border border-gray-200 p-4 sm:p-5 mb-4" aria-labelledby="portada-tecnica">
      <h3 id="portada-tecnica" class="font-semibold text-gray-900 mb-4">Informaci\u00f3n t\u00e9cnica</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="label" for="f-url-sitio">URL del sitio publicado</label>
          <input id="f-url-sitio" class="input w-full" value="${esc(dat.url_sitio_publicado || '')}" data-field="url_sitio_publicado" />
        </div>
        <div>
          <label class="label" for="f-tecnologias">Tecnolog\u00edas usadas</label>
          <input id="f-tecnologias" class="input w-full" value="${esc(dat.tecnologias_usadas || '')}" placeholder="Ej. HTML, CSS, JavaScript" aria-describedby="f-tecnologias-ayuda" data-field="tecnologias_usadas" />
          <p id="f-tecnologias-ayuda" class="mt-1 text-xs text-gray-500">Usa el an\u00e1lisis del repositorio para completar este campo o escr\u00edbelo manualmente.</p>
        </div>
        <div class="md:col-span-2">
          <label class="label" for="f-lineas">L\u00edneas de c\u00f3digo (aprox.)</label>
          <div class="flex flex-wrap items-center gap-2">
            <input id="f-lineas" type="number" min="0" step="1" class="input sm:w-40" value="${esc(dat.lineas_codigo ?? '')}" placeholder="Sin calcular" aria-describedby="f-lineas-ayuda" data-field="lineas_codigo" />
            <button type="button" id="f-calcular-lineas" class="btn-secondary">${icon('calculate', 18)} Analizar repositorio</button>
          </div>
          <p id="f-lineas-ayuda" class="text-xs text-gray-500 mt-2">Selecciona la carpeta local para detectar tecnolog\u00edas y calcular el tama\u00f1o del c\u00f3digo. Se cuentan las l\u00edneas no vac\u00edas, incluidos los comentarios, y se omiten las dependencias y los directorios de compilaci\u00f3n habituales.</p>
          <p id="f-lineas-estado" class="text-sm text-gray-600 mt-2 empty:hidden" role="status"></p>
        </div>
      </div>
    </section>
    <h3 class="text-sm font-bold text-gray-700 mt-6 mb-3">2. Resumen Ejecutivo</h3>
    <textarea id="f-resumen" class="input w-full" rows="5" data-field="resumen_ejecutivo">${esc(dat.resumen_ejecutivo || '')}</textarea>
    <h3 class="text-sm font-bold text-gray-700 mt-6 mb-3">3. Antecedentes y Alcance</h3>
    <div class="overflow-hidden rounded-xl border border-gray-300 bg-white focus-within:border-primary-500">
      <div class="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <button type="button" id="antecedentes-insertar-tabla" class="btn-secondary">${icon('table_chart', 18)} Insertar tabla</button>
        <p id="antecedentes-tablas-ayuda" class="text-sm text-gray-500">Pega o inserta una tabla donde est\u00e9 el cursor.</p>
      </div>
      <div id="antecedentes-editor" class="space-y-2 p-3">${renderContenidoAntecedentes(dat, true)}</div>
    </div>

    <section id="firmas-documento" class="mt-8 space-y-4" aria-labelledby="firmas-titulo">
      <h3 id="firmas-titulo" class="font-semibold text-gray-900">Firmas del documento</h3>
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-xl border border-gray-200 p-4">
          <p class="label">Elaborado por</p>
          <p class="font-medium text-gray-900">${esc(inf.elaborado_nombre || 'Sin autor registrado')}</p>
        </div>
        <div class="rounded-xl border border-gray-200 p-4">
          ${selectorUsuarioFirma('f-envio-firma', 'Responsable de enviar el informe final a firma', dat.responsable_envio_firma)}
        </div>
      </div>
      <div>
        <h4 class="label">Revisi\u00f3n y firma por \u00e1rea</h4>
        <div id="firmas-areas">${renderFirmasAreas(inf, dat)}</div>
      </div>
    </section>
  `;
}

function responsableFirma(inf, dat, area) {
  const responsables = dat.responsables_revision || {};
  if (Object.hasOwn(responsables, area)) return responsables[area];
  if (area === 'ODN') return inf.revisado_por_odn_nombre || '';
  if (area === 'OPP') return inf.revisado_por_opp_nombre || '';
  return '';
}

function selectorUsuarioFirma(id, etiqueta, nombre, area = '') {
  return `<div data-selector-firma data-area-firma="${esc(area)}">
    <label for="${id}" class="label">${esc(etiqueta)}</label>
    <input id="${id}" type="search" autocomplete="off" class="input" data-buscar-firma aria-controls="${id}-usuarios" placeholder="Buscar usuario de ORH" />
    <div id="${id}-usuarios" data-resultados-firma class="mt-2 max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white" hidden></div>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-1 text-sm">
      <span data-nombre-firma class="font-medium text-gray-700" aria-live="polite">${esc(nombre || 'Sin asignar')}</span>
      <button type="button" data-quitar-firma class="text-xs font-medium text-gray-500 hover:text-red-600" ${nombre ? '' : 'hidden'}>Quitar</button>
    </div>
  </div>`;
}

function renderFirmasAreas(inf, dat) {
  const areas = areasParticipantes(dat);
  if (!areas.length) return '<p class="text-sm text-gray-500">Selecciona un \u00e1rea participante para habilitar su firma.</p>';
  return `<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    ${areas.map((area, indice) => `
      <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
        ${selectorUsuarioFirma(`f-firmante-${indice}`, `Revisa y firma \u00b7 ${area}`, responsableFirma(inf, dat, area), area)}
      </div>
    `).join('')}
  </div>`;
}

function segmentosAntecedentes(dat) {
  return dat.antecedentes_segmentos || [dat.antecedentes || '', ...(dat.antecedentes_tablas || []).map(() => '')];
}

function renderContenidoAntecedentes(dat, editar = false, citar = esc) {
  const tablas = dat.antecedentes_tablas || [];
  return segmentosAntecedentes(dat).map((texto, indice) => {
    const bloque = editar
      ? `<textarea data-segmento="${indice}" rows="${tablas.length ? 2 : 5}" class="block w-full resize-y rounded-md border-0 px-2 py-1 text-sm text-gray-900 [field-sizing:content] min-h-10 focus:ring-2 focus:ring-primary-200" aria-label="Texto de antecedentes ${indice + 1}" aria-describedby="antecedentes-tablas-ayuda" placeholder="Escribe o pega contenido\u2026">${esc(texto)}</textarea>`
      : texto ? `<p class="text-sm leading-relaxed whitespace-pre-wrap">${citar(texto)}</p>` : '';
    return bloque + (tablas[indice] ? renderTablaAntecedentes(tablas[indice], indice, editar) : '');
  }).join('');
}

function renderTablaAntecedentes(filas, indice, editar) {
  return `
    <div class="rounded-lg border border-gray-200">
      ${editar ? `<div class="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <span class="text-sm font-medium text-gray-700">Tabla ${indice + 1}</span>
        <button type="button" class="btn-secondary" data-quitar-tabla="${indice}">${icon('delete', 16)} Quitar tabla</button>
      </div>` : ''}
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-sm" aria-label="Tabla ${indice + 1} de antecedentes">
          <tbody>${filas.map((fila, f) => `
            <tr class="${f === 0 ? 'bg-gray-50 font-semibold' : ''}">
              ${fila.map((valor, c) => {
                const tag = f === 0 ? 'th' : 'td';
                return `<${tag} ${f === 0 ? 'scope="col"' : ''} class="border border-gray-200 p-2 text-left align-top whitespace-pre-wrap">${editar
                  ? `<textarea rows="2" class="input min-w-32 resize-y" data-celda="${indice}:${f}:${c}" aria-label="Tabla ${indice + 1}, fila ${f + 1}, columna ${c + 1}">${esc(valor)}</textarea>`
                  : esc(valor)}</${tag}>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
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
      <label for="f-detalle-estado-general" class="label mt-3">Detalle del estado para la portada</label>
      <input id="f-detalle-estado-general" class="input w-full" value="${esc(dat.detalle_estado_general)}" placeholder="Ej. Maqueta funcional publicada. Falta implementar servidor y base de datos." />
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

function evaluacionRNF(req) {
  if (req.evaluacion_manual || (req.evaluacion && req.evaluacion !== 'Pendiente')) {
    return req.evaluacion;
  }
  return ESTADOS_RF[req.implementation_status] || 'Pendiente';
}

function rowRNF(r, i) {
  const evaluacion = evaluacionRNF(r);
  return `
    <tr data-rnfi="${i}" class="border-b border-gray-100">
      <td class="px-3 py-2"><input class="input w-full text-sm rnf-codigo font-mono" value="${esc(r.codigo || '')}" placeholder="RNF-01" /></td>
      <td class="px-3 py-2"><input class="input w-full text-sm rnf-desc" value="${esc(r.descripcion || '')}" /></td>
      <td class="px-3 py-2">
        <select class="input text-sm rnf-eval">
          ${EVAL_RNF.map(o => `<option value="${o}" ${evaluacion === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </td>
      <td class="px-3 py-2 text-right">
        <button data-rm-rnf="${i}" class="p-1.5 rounded hover:bg-red-50 text-red-400">${icon('delete',15)}</button>
      </td>
    </tr>`;
}

// -- Tab: Observaciones ------------------------------------------------------
const NOMBRES_AREAS_OBSERVACIONES = {
  OTI: 'Jefatura de Tecnolog\u00edas de Informaci\u00f3n',
  ODN: 'Oficina de Desarrollo de Negocios',
  OPP: 'Oficina de Planeamiento y Presupuesto',
  ADG: 'Alta Direcci\u00f3n Gerencial',
  GG: 'Gerencia General',
};

function nombreAreaObservaciones(area) {
  return Object.hasOwn(NOMBRES_AREAS_OBSERVACIONES, area)
    ? `${area} \u2013 ${NOMBRES_AREAS_OBSERVACIONES[area]}`
    : area;
}

function observacionArea(dat, area) {
  const observaciones = dat.observaciones_por_area || {};
  if (Object.hasOwn(observaciones, area)) return observaciones[area];
  const camposAnteriores = { OTI: 'obs_oti', ODN: 'obs_odn', OPP: 'obs_opp' };
  return Object.hasOwn(camposAnteriores, area) ? dat[camposAnteriores[area]] || '' : '';
}

function renderTabObservaciones(dat) {
  const areas = areasParticipantes(dat);
  return `
    <h2 class="text-base font-bold text-gray-800 mb-4 pb-2 border-b">Observaciones por \u00c1rea</h2>
    <div id="observaciones-areas" class="space-y-4">
      ${areas.length ? areas.map((area, indice) => `
        <div class="rounded-xl border border-gray-200 p-4">
          <label for="f-obs-area-${indice}" class="label font-semibold">${esc(nombreAreaObservaciones(area))}</label>
          <textarea id="f-obs-area-${indice}" class="input w-full resize-y" rows="4" data-observacion-area="${esc(area)}" placeholder="Escribe las observaciones del \u00e1rea">${esc(observacionArea(dat, area))}</textarea>
        </div>`).join('') : '<p class="text-sm text-gray-500">Selecciona las \u00e1reas participantes en Portada.</p>'}
    </div>`;
}

// -- Tab: Brechas ------------------------------------------------------------
function renderTabBrechas(dat) {
  const brechas = dat.brechas || [];
  return `
    <div class="grid gap-3" id="list-brechas">
      ${renderListaBrechas(brechas)}
    </div>
    <div class="mt-4 flex justify-end">
      <button type="button" id="btn-add-brecha-final" class="btn-secondary">${icon('add', 16)} Agregar brecha</button>
    </div>`;
}

function renderListaBrechas(brechas) {
  return brechas.length ? brechas.map(cardBrecha).join('') : `
    <p id="brechas-vacio" class="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Sin brechas registradas.</p>`;
}

function cardBrecha(b, i) {
  return `
    <article data-bi="${i}" class="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
        <h3 class="font-semibold text-gray-900">Brecha ${i + 1}</h3>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-xs font-medium text-gray-600">Prioridad
          <select class="input text-xs brecha-prioridad w-24">
            ${PRIORIDADES_BRECHA.map(p => `<option value="${p}" ${b.prioridad === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          </label>
          <button type="button" data-rm-brecha="${i}" class="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Eliminar brecha ${i + 1}">${icon('delete', 16)}</button>
        </div>
      </div>
      <div class="grid gap-3 p-4 lg:grid-cols-2">
      <div class="lg:col-span-2">
        <label class="label text-xs" for="brecha-necesidad-${i}">Necesidad</label>
        <input id="brecha-necesidad-${i}" class="input w-full text-sm brecha-necesidad" value="${esc(b.necesidad || '')}" placeholder="Qu\u00e9 se necesita" />
      </div>
      <div>
        <label class="label text-xs" for="brecha-implica-${i}">Qu\u00e9 implica</label>
        <textarea id="brecha-implica-${i}" rows="2" class="input w-full resize-y text-sm brecha-implica" placeholder="Implicaciones t\u00e9cnicas u organizacionales">${esc(b.que_implica || '')}</textarea>
      </div>
      <div>
        <label class="label text-xs" for="brecha-criterio-${i}">Criterio de aceptaci\u00f3n</label>
        <textarea id="brecha-criterio-${i}" rows="2" class="input w-full resize-y text-sm brecha-criterio" placeholder="Condici\u00f3n para cerrar esta brecha">${esc(b.criterio_aceptacion || '')}</textarea>
      </div>
      </div>
    </article>`;
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
    case 'anexos':        wireAnexos(); break;
  }
}

// -- Wire: Portada -----------------------------------------------------------
function wirePortada() {
  const fields = ['f-titulo', 'f-version', 'f-dirigido-a', 'f-ubicacion',
                  'f-url-sitio', 'f-tecnologias', 'f-lineas', 'f-fecha-emision', 'f-fecha-limite',
                  'f-resumen'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => scheduleAutosave());
  });
  wireTablasAntecedentes();
  wireFirmasDocumento();
  const firmas = document.getElementById('firmas-areas');
  document.getElementById('f-areas').addEventListener('change', () => {
    scheduleAutosave();
    firmas.innerHTML = renderFirmasAreas(_currentInforme, _currentInforme.datos);
  });
  const boton = document.getElementById('f-calcular-lineas');
  boton.addEventListener('click', () => abrirSelectorRepositorio(boton));
}

function wireFirmasDocumento() {
  const seccion = document.getElementById('firmas-documento');
  const datos = _currentInforme.datos;
  const normalizar = texto => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  let cargaUsuarios;

  seccion.addEventListener('input', async event => {
    const campo = event.target;
    if (!campo.matches('[data-buscar-firma]')) return;
    const resultados = campo.closest('[data-selector-firma]').querySelector('[data-resultados-firma]');
    const consulta = normalizar(campo.value);
    resultados.hidden = !consulta;
    if (!consulta) return;
    resultados.innerHTML = '<p class="px-3 py-2 text-sm text-gray-500">Buscando usuarios\u2026</p>';
    cargaUsuarios ??= api.get('/users').catch(error => {
      cargaUsuarios = null;
      throw error;
    });
    try {
      const usuarios = await cargaUsuarios;
      if (!campo.isConnected || normalizar(campo.value) !== consulta) return;
      const palabras = consulta.split(/\s+/);
      const coincidencias = usuarios.filter(u => u.name && palabras.every(palabra => normalizar(u.name).includes(palabra))).slice(0, 12);
      resultados.innerHTML = coincidencias.map(u => `
        <button type="button" data-elegir-firma="${esc(u.id)}" class="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-primary-50 focus:bg-primary-50">${esc(u.name)}</button>`).join('')
        || '<p class="px-3 py-2 text-sm text-gray-500">Sin coincidencias.</p>';
    } catch {
      if (campo.isConnected && normalizar(campo.value) === consulta) {
        resultados.innerHTML = '<p class="px-3 py-2 text-sm text-red-700" role="status">No se pudo cargar el directorio. Vuelve a escribir para reintentar.</p>';
      }
    }
  });

  seccion.addEventListener('click', async event => {
    const boton = event.target.closest('[data-elegir-firma], [data-quitar-firma]');
    if (!boton) return;
    const selector = boton.closest('[data-selector-firma]');
    const area = selector.dataset.areaFirma;
    let elegido = null;
    if (boton.dataset.elegirFirma !== undefined) {
      elegido = (await cargaUsuarios).find(u => String(u.id) === boton.dataset.elegirFirma);
      if (!elegido || !boton.isConnected) return;
    }
    const nombre = elegido?.name || '';
    const id = elegido?.id ?? null;
    if (area) {
      datos.responsables_revision = { ...datos.responsables_revision, [area]: nombre };
      datos.responsables_revision_ids = { ...datos.responsables_revision_ids, [area]: id };
    } else {
      datos.responsable_envio_firma = nombre;
      datos.responsable_envio_firma_id = id;
    }
    const campo = selector.querySelector('[data-buscar-firma]');
    campo.value = '';
    selector.querySelector('[data-resultados-firma]').hidden = true;
    selector.querySelector('[data-nombre-firma]').textContent = nombre || 'Sin asignar';
    selector.querySelector('[data-quitar-firma]').hidden = !nombre;
    campo.focus();
    scheduleAutosave();
  });
}

function leerTablaPortapapeles(portapapeles) {
  const html = portapapeles.getData('text/html');
  if (html) {
    const plantilla = document.createElement('template');
    plantilla.innerHTML = html;
    const tabla = plantilla.content.querySelector('table');
    if (tabla?.rows.length) {
      const filas = Array.from(tabla.rows, fila => Array.from(fila.cells, celda => celda.textContent.trim()));
      if (filas.some(fila => fila.length)) return filas;
    }
  }

  const texto = portapapeles.getData('text/plain');
  if (!texto.includes('\t')) return null;
  return texto.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(fila => fila.split('\t'));
}

function wireTablasAntecedentes() {
  const contenedor = document.getElementById('antecedentes-editor');
  const datos = _currentInforme.datos;
  const tablas = datos.antecedentes_tablas || [];
  const segmentos = segmentosAntecedentes(datos);
  let ultimoTexto = null;

  const guardar = () => {
    datos.antecedentes_tablas = tablas;
    datos.antecedentes_segmentos = segmentos;
    datos.antecedentes = segmentos.join('');
    scheduleAutosave();
  };
  const actualizar = indice => {
    guardar();
    contenedor.innerHTML = renderContenidoAntecedentes(datos, true);
    ultimoTexto = contenedor.querySelector(`[data-segmento="${indice}"]`);
  };
  const agregar = (filas, texto) => {
    const indice = Number(texto.dataset.segmento);
    const ancho = filas.reduce((max, fila) => Math.max(max, fila.length), 0);
    segmentos.splice(indice, 1, texto.value.slice(0, texto.selectionStart), texto.value.slice(texto.selectionEnd));
    tablas.splice(indice, 0, filas.map(fila => Array.from({ length: ancho }, (_, c) => fila[c] ?? '')));
    actualizar(indice + 1);
    contenedor.querySelector(`[data-celda="${indice}:0:0"]`)?.focus();
  };

  contenedor.addEventListener('focusin', event => {
    if (event.target.dataset.segmento !== undefined) ultimoTexto = event.target;
  });
  contenedor.addEventListener('paste', event => {
    if (event.target.dataset.segmento === undefined || !event.clipboardData) return;
    const filas = leerTablaPortapapeles(event.clipboardData);
    if (!filas) return;
    event.preventDefault();
    agregar(filas, event.target);
  });
  contenedor.addEventListener('input', event => {
    const { segmento, celda } = event.target.dataset;
    if (segmento !== undefined) {
      segmentos[Number(segmento)] = event.target.value;
    } else if (celda) {
      const [t, f, c] = celda.split(':').map(Number);
      tablas[t][f][c] = event.target.value;
    } else return;
    guardar();
  });
  contenedor.addEventListener('click', async event => {
    const boton = event.target.closest('[data-quitar-tabla]');
    if (!boton) return;
    const ok = await confirmModal('Se quitar\u00e1 la tabla de Antecedentes y Alcance.', {
      title: 'Quitar tabla', confirmLabel: 'Quitar tabla', danger: true,
    });
    if (!ok || !boton.isConnected) return;
    const indice = Number(boton.dataset.quitarTabla);
    tablas.splice(indice, 1);
    segmentos.splice(indice, 2, segmentos[indice] + segmentos[indice + 1]);
    actualizar(indice);
    ultimoTexto?.focus();
  });
  document.getElementById('antecedentes-insertar-tabla').addEventListener('click', () => {
    showModal('Insertar tabla', `
      <form id="antecedentes-dimensiones" class="grid grid-cols-2 gap-3">
        <label class="label">Filas <input name="filas" class="input mt-1" type="number" min="1" max="30" value="3" required /></label>
        <label class="label">Columnas <input name="columnas" class="input mt-1" type="number" min="1" max="12" value="3" required /></label>
        <p class="col-span-2 text-sm text-gray-500">La primera fila se muestra como encabezado.</p>
      </form>
    `, 'sm', `<div class="flex justify-end">
      <button type="submit" form="antecedentes-dimensiones" class="btn-primary">Insertar tabla</button>
    </div>`);
    const formulario = document.getElementById('antecedentes-dimensiones');
    formulario.addEventListener('submit', event => {
      event.preventDefault();
      if (!formulario.reportValidity() || !contenedor.isConnected) return;
      const filas = formulario.elements.namedItem('filas').valueAsNumber;
      const columnas = formulario.elements.namedItem('columnas').valueAsNumber;
      closeModal();
      const texto = ultimoTexto || contenedor.querySelector('[data-segmento]:last-child');
      if (!ultimoTexto) texto.setSelectionRange(texto.value.length, texto.value.length);
      agregar(Array.from({ length: filas }, () => Array(columnas).fill('')), texto);
    });
  });
}

const CARPETAS_OMITIDAS = new Set(['node_modules', 'vendor', 'dist', 'build', 'out', 'coverage', 'target', 'bin', 'obj', 'venv', '__pycache__']);

const TECNOLOGIAS_POR_EXTENSION = {
  html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'Sass', sass: 'Sass', less: 'Less',
  js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', mts: 'TypeScript', cts: 'TypeScript', tsx: 'TypeScript',
  vue: 'Vue', svelte: 'Svelte', astro: 'Astro', py: 'Python', php: 'PHP', rb: 'Ruby',
  go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', cs: 'C#', fs: 'F#',
  c: 'C', h: 'C/C++', cpp: 'C++', cc: 'C++', hpp: 'C++', swift: 'Swift', dart: 'Dart',
  lua: 'Lua', r: 'R', sql: 'SQL', sh: 'Shell', ps1: 'PowerShell', graphql: 'GraphQL', gql: 'GraphQL',
};
const TECNOLOGIAS_POR_PAQUETE = {
  react: 'React', next: 'Next.js', vue: 'Vue', nuxt: 'Nuxt', svelte: 'Svelte',
  '@sveltejs/kit': 'SvelteKit', '@angular/core': 'Angular', astro: 'Astro',
  express: 'Express', fastify: 'Fastify', '@nestjs/core': 'NestJS',
  tailwindcss: 'Tailwind CSS', bootstrap: 'Bootstrap', vite: 'Vite', typescript: 'TypeScript',
};

function omitirCarpeta(name) {
  return name.startsWith('.') || CARPETAS_OMITIDAS.has(name.toLowerCase());
}

async function* recorrerRepositorio(carpeta, boton) {
  for await (const entrada of carpeta.values()) {
    if (!boton.isConnected) return;
    if (entrada.kind === 'directory') {
      if (!omitirCarpeta(entrada.name)) yield* recorrerRepositorio(entrada, boton);
    } else if (entrada.name === 'package.json' || esArchivoFuente(entrada)) {
      yield await entrada.getFile();
    }
  }
}

function abrirSelectorRepositorio(boton) {
  showModal('Analizar repositorio', `
    <div class="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div class="shrink-0 rounded-lg bg-primary-50 p-2 text-primary-700" aria-hidden="true">${icon('folder_open', 24)}</div>
      <div>
        <p class="text-sm font-semibold text-gray-900">Selecciona la carpeta del proyecto</p>
        <p class="mt-1 text-sm text-gray-600">Elige la carpeta espec\u00edfica del repositorio. Qubira guardar\u00e1 el conteo de l\u00edneas y las tecnolog\u00edas detectadas en el informe.</p>
      </div>
    </div>
    <div class="mt-3 flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">
      <span aria-hidden="true">${icon('lock_outline', 18)}</span>
      <p>Tu navegador puede pedir permiso para leer la carpeta. El an\u00e1lisis se hace en tu equipo y los archivos permanecen all\u00ed.</p>
    </div>
    <p id="repo-picker-status" class="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 empty:hidden" role="status"></p>
    <input id="f-repo-folder" type="file" webkitdirectory multiple hidden />
  `, 'md', `
    <div class="flex flex-wrap justify-end gap-2">
      <button type="button" id="repo-manual" class="btn-secondary">${icon('edit', 16)} Ingresar manualmente</button>
      <button id="repo-choose" class="btn-primary">${icon('folder_open', 18)} Elegir carpeta</button>
    </div>
  `);
  const elegir = document.getElementById('repo-choose');
  const folder = document.getElementById('f-repo-folder');
  const mensaje = document.getElementById('repo-picker-status');
  let usarSelector = typeof window.showDirectoryPicker === 'function';
  document.getElementById('repo-manual').addEventListener('click', () => {
    closeModal();
    if (boton.isConnected) document.getElementById('f-tecnologias')?.focus();
  });
  folder.addEventListener('change', () => {
    const archivos = Array.from(folder.files).filter(file =>
      !file.webkitRelativePath.split('/').slice(1, -1).some(omitirCarpeta));
    closeModal();
    if (boton.isConnected) analizarRepositorio(archivos, boton);
  });
  elegir.addEventListener('click', async () => {
    if (!usarSelector) {
      folder.click();
      return;
    }
    elegir.disabled = true;
    try {
      const carpeta = await window.showDirectoryPicker({ mode: 'read', id: 'qubira-repositorio' });
      if (!elegir.isConnected || !boton.isConnected) return;
      closeModal();
      analizarRepositorio(recorrerRepositorio(carpeta, boton), boton);
    } catch (error) {
      if (error.name === 'AbortError') {
        mensaje.textContent = 'No se pudo acceder a la carpeta. Puedes elegir otra o ingresar los datos manualmente.';
      } else {
        usarSelector = false;
        mensaje.textContent = 'Vuelve a pulsar Elegir carpeta para usar el selector compatible.';
      }
    } finally {
      elegir.disabled = false;
    }
  });
  elegir.focus();
}

function tecnologiaArchivo(file) {
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  return Object.hasOwn(TECNOLOGIAS_POR_EXTENSION, extension) ? TECNOLOGIAS_POR_EXTENSION[extension] : '';
}

function esArchivoFuente(file) {
  return tecnologiaArchivo(file)
    && !/\.(?:min\.|bundle\.|generated\.|designer\.)[^.]+$|\.d\.[cm]?ts$/i.test(file.name);
}

async function analizarRepositorio(archivosProyecto, boton) {
  const input = document.getElementById('f-lineas');
  const tecnologias = document.getElementById('f-tecnologias');
  const estado = document.getElementById('f-lineas-estado');

  boton.disabled = true;
  input.readOnly = true;
  estado.textContent = 'Analizando el repositorio\u2026';
  try {
    let total = 0;
    const detectadas = new Set();
    let archivos = 0;
    let manifiestos = 0;
    let manifiestosOmitidos = 0;
    for await (const archivo of archivosProyecto) {
      if (!boton.isConnected) return;
      if (esArchivoFuente(archivo)) {
        const contenido = await archivo.text();
        total += contenido.split(/\r\n|\n|\r/).filter(linea => linea.trim()).length;
        detectadas.add(tecnologiaArchivo(archivo));
        archivos++;
        continue;
      }
      if (archivo.name !== 'package.json') continue;
      manifiestos++;
      try {
        const contenido = JSON.parse((await archivo.text()).replace(/^\uFEFF/, ''));
        const paquetes = { ...contenido.dependencies, ...contenido.devDependencies, ...contenido.optionalDependencies, ...contenido.peerDependencies };
        for (const [paquete, tecnologia] of Object.entries(TECNOLOGIAS_POR_PAQUETE)) {
          if (Object.hasOwn(paquetes, paquete)) detectadas.add(tecnologia);
        }
      } catch {
        manifiestosOmitidos++;
      }
    }
    if (!boton.isConnected) return;
    if (!archivos && !manifiestos) {
      estado.textContent = 'No se encontraron archivos de c\u00f3digo ni manifiestos compatibles.';
      return;
    }
    if (archivos) input.value = total;
    const sugerencias = [...detectadas].sort((a, b) => a.localeCompare(b, 'es')).join(', ');
    const tieneTecnologias = Boolean(tecnologias.value.trim());
    if (sugerencias && !tieneTecnologias) tecnologias.value = sugerencias;
    scheduleAutosave();
    const resumen = [
      archivos ? `${total.toLocaleString('es-PE')} l\u00edneas no vac\u00edas en ${archivos.toLocaleString('es-PE')} archivos.` : '',
      sugerencias ? `Tecnolog\u00edas detectadas: ${sugerencias}.` : 'No se detectaron tecnolog\u00edas compatibles.',
      sugerencias && tieneTecnologias ? 'Se conserv\u00f3 el contenido del campo.' : '',
      manifiestosOmitidos ? 'Algunos manifiestos no se pudieron leer.' : '',
    ];
    estado.textContent = resumen.filter(Boolean).join(' ');
  } catch {
    estado.textContent = 'No se pudo leer la carpeta completa. Intenta seleccionarla de nuevo.';
  } finally {
    boton.disabled = false;
    input.readOnly = false;
  }
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
  document.getElementById('f-detalle-estado-general')?.addEventListener('input', e => {
    _currentInforme.datos.detalle_estado_general = e.target.value;
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
    dat.req_no_funcionales.push({ codigo: `RNF-${String(n).padStart(2,'0')}`, descripcion: '', evaluacion: 'Pendiente' });
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
    if (!e.target.matches('.rnf-codigo,.rnf-desc')) return;
    const row = e.target.closest('[data-rnfi]');
    if (!row) return;
    const i = parseInt(row.dataset.rnfi);
    const r = _currentInforme.datos.req_no_funcionales[i];
    if (e.target.classList.contains('rnf-codigo')) r.codigo     = e.target.value;
    if (e.target.classList.contains('rnf-desc'))   r.descripcion = e.target.value;
    scheduleAutosave();
  });

  document.getElementById('tab-panel').addEventListener('change', e => {
    if (!e.target.classList.contains('rnf-eval')) return;
    const row = e.target.closest('[data-rnfi]');
    if (!row) return;
    const i = parseInt(row.dataset.rnfi);
    const requisito = _currentInforme.datos.req_no_funcionales[i];
    requisito.evaluacion = e.target.value;
    requisito.evaluacion_manual = true;
    scheduleAutosave();
  });
}

// -- Wire: Observaciones -----------------------------------------------------
function wireObservaciones() {
  document.getElementById('observaciones-areas').addEventListener('input', event => {
    const area = event.target.dataset.observacionArea;
    if (area === undefined) return;
    const datos = _currentInforme.datos;
    datos.observaciones_por_area = {
      ...datos.observaciones_por_area,
      [area]: event.target.value,
    };
    scheduleAutosave();
  });
}

// -- Wire: Brechas -----------------------------------------------------------
function actualizarConteoBrechas(total) {
  document.getElementById('conteo-brechas').textContent = `${total} ${total === 1 ? 'brecha registrada' : 'brechas registradas'}`;
}

function agregarBrecha() {
  const lista = document.getElementById('list-brechas');
  if (!lista) return;
  const dat = _currentInforme.datos;
  const brechas = dat.brechas ??= [];
  const nueva = { necesidad: '', que_implica: '', prioridad: 'Media', criterio_aceptacion: '' };
  const indice = brechas.push(nueva) - 1;
  document.getElementById('brechas-vacio')?.remove();
  lista.insertAdjacentHTML('beforeend', cardBrecha(nueva, indice));
  actualizarConteoBrechas(brechas.length);
  scheduleAutosave();
  const campo = document.getElementById(`brecha-necesidad-${indice}`);
  campo.closest('article').scrollIntoView({ block: 'center' });
  campo.focus({ preventScroll: true });
}

function wireBrechas() {
  const lista = document.getElementById('list-brechas');
  const dat = _currentInforme.datos;
  actualizarConteoBrechas(dat.brechas?.length ?? 0);
  document.getElementById('btn-add-brecha-final').addEventListener('click', agregarBrecha);
  lista.addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-brecha]');
    if (!btn) return;
    const i = parseInt(btn.dataset.rmBrecha);
    dat.brechas.splice(i, 1);
    lista.innerHTML = renderListaBrechas(dat.brechas);
    actualizarConteoBrechas(dat.brechas.length);
    scheduleAutosave();
  });

  lista.addEventListener('input', e => {
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

  lista.addEventListener('change', e => {
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
  const lineas = document.getElementById('f-lineas');
  if (lineas) dat.lineas_codigo = lineas.value && lineas.validity.valid ? lineas.valueAsNumber : null;
  if (get('f-resumen') !== null) dat.resumen_ejecutivo = get('f-resumen');

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
function rutaFiguras(inf) {
  return `/informes-estado/${encodeURIComponent(inf.id)}/figuras`;
}

function renderTabAnexos() {
  return `
    <h2 class="mb-3 text-lg font-semibold">Anexos de im\u00e1genes</h2>
    <p class="mb-4 text-sm text-gray-600">Agrega im\u00e1genes y pega sus citas en el texto del informe. En la vista previa, cada cita lleva a su figura.</p>
    <form id="figuras-form" class="mb-5 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div id="figuras-pegar" tabindex="0" class="rounded-xl border border-dashed border-primary-300 bg-primary-50 p-5 text-center focus:outline-none focus:ring-2 focus:ring-primary-500" aria-label="Pegar im\u00e1genes desde Word">
        <div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary-700" aria-hidden="true">${icon('content_paste', 22)}</div>
        <p class="font-semibold text-gray-900">Pega una imagen desde Word</p>
        <p class="mt-1 text-sm text-gray-600">Copia la imagen en Word, haz clic en este recuadro y pulsa <kbd class="font-semibold">Ctrl+V</kbd>.</p>
        <label class="btn-secondary mt-3 cursor-pointer focus-within:ring-2 focus-within:ring-primary-500">
          ${icon('folder_open', 18)} Elegir archivos
          <input type="file" name="imagenes" accept="image/png,image/jpeg,image/webp" multiple class="sr-only" />
        </label>
        <p class="mt-2 text-xs text-gray-500">PNG, JPEG o WebP. Hasta 5 MB por imagen.</p>
      </div>
      <label class="label">Sección del anexo
        <input name="seccion" maxlength="120" class="input mt-1" placeholder="Ej. DARMED – Clínica estética" />
      </label>
      <div id="figuras-borradores" class="grid gap-3 sm:grid-cols-2"></div>
      <div class="flex flex-wrap items-center gap-3">
        <button class="btn-primary" type="submit" disabled>${icon('add_photo_alternate', 18)} Guardar im\u00e1genes</button>
        <span role="status" class="text-sm text-gray-600"></span>
      </div>
    </form>
    <div id="figuras-lista" class="space-y-3">${spinner()}</div>`;
}

function imagenesPortapapeles(datos) {
  const archivos = Array.from(datos?.items || [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile()).filter(Boolean);
  if (archivos.length) return archivos;
  const adjuntos = Array.from(datos?.files || []).filter(file => file.type.startsWith('image/'));
  if (adjuntos.length) return adjuntos;

  const html = datos?.getData('text/html');
  if (!html) return [];
  const plantilla = document.createElement('template');
  plantilla.innerHTML = html;
  return Array.from(plantilla.content.querySelectorAll('img')).flatMap((img, i) => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z\d+/=\s]+)$/i.exec(img.getAttribute('src') || '');
    if (!match || match[2].length > Math.ceil(5 * 1024 * 1024 / 3) * 4) return [];
    try {
      const tipo = match[1].toLowerCase();
      const bytes = Uint8Array.from(atob(match[2]), ch => ch.charCodeAt(0));
      return [new File([bytes], `Imagen-${i + 1}.${tipo.split('/')[1]}`, { type: tipo })];
    } catch { return []; }
  });
}

function wireAnexos() {
  const informe = _currentInforme;
  const ruta = rutaFiguras(informe);
  const form = document.getElementById('figuras-form');
  const lista = document.getElementById('figuras-lista');
  const estado = form.querySelector('[role="status"]');
  const subir = form.querySelector('button[type="submit"]');
  const pegar = document.getElementById('figuras-pegar');
  const borradores = document.getElementById('figuras-borradores');
  const archivos = form.elements.namedItem('imagenes');
  const pendientes = [];
  let guardando = false;

  function encolar(imagenes, desdeWord = false) {
    let omitidas = 0;
    for (const archivo of imagenes) {
      if (!/^image\/(png|jpeg|webp)$/.test(archivo.type) || archivo.size > 5 * 1024 * 1024) {
        omitidas++;
        continue;
      }
      const card = document.createElement('div');
      card.className = 'overflow-hidden rounded-xl border border-gray-200 bg-gray-50';
      const leyenda = desdeWord ? '' : archivo.name.replace(/\.[^.]+$/, '').slice(0, 300);
      card.innerHTML = `<div class="flex h-36 items-center justify-center bg-gray-100">
        <img class="max-h-full max-w-full object-contain" alt="Vista previa de la imagen" />
      </div>
      <div class="space-y-2 p-3">
        <label class="label">Leyenda
          <input maxlength="300" class="input mt-1" value="${esc(leyenda)}" placeholder="Ej. Vista del panel de citas" />
        </label>
        <button type="button" class="btn-secondary text-xs">Quitar de la cola</button>
      </div>`;
      const item = { archivo, card };
      pendientes.push(item);
      borradores.append(card);
      mostrarImagenFigura(card.querySelector('img'), archivo);
      card.querySelector('button').addEventListener('click', () => {
        if (guardando) return;
        pendientes.splice(pendientes.indexOf(item), 1);
        card.remove();
        subir.disabled = !pendientes.length;
        estado.textContent = '';
      });
    }
    subir.disabled = !pendientes.length;
    estado.textContent = omitidas ? 'Se omitieron im\u00e1genes con formato no compatible o de m\u00e1s de 5 MB.' : '';
  }

  archivos.addEventListener('change', () => {
    if (!guardando) encolar(archivos.files);
    archivos.value = '';
  });
  pegar.addEventListener('paste', event => {
    event.preventDefault();
    if (guardando) return;
    const imagenes = imagenesPortapapeles(event.clipboardData);
    if (imagenes.length) encolar(imagenes, true);
    else estado.textContent = 'No se encontr\u00f3 una imagen. Copia solo la imagen en Word o selecci\u00f3nala desde un archivo.';
  });
  async function listar() {
    try {
      const figuras = await api.get(ruta);
      if (!lista.isConnected) return;
      lista.innerHTML = figuras.map(f => `
        <form data-figura="${f.numero}" class="grid gap-4 rounded-xl border border-gray-200 p-4 sm:grid-cols-[10rem_1fr]">
          <div class="flex h-28 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            <img data-imagen-figura="${f.numero}" alt="${esc(f.leyenda)}" class="max-h-full max-w-full object-contain" />
          </div>
          <div>
          <h3 class="mb-2 font-semibold text-gray-900">Figura ${f.numero}</h3>
          <div class="grid gap-2">
            <label class="label">Sección del anexo
              <input name="seccion" maxlength="120" class="input mt-1" placeholder="Evidencia visual" value="${esc(f.seccion)}" />
            </label>
            <label class="label">Leyenda
              <input name="leyenda" maxlength="300" required class="input mt-1" value="${esc(f.leyenda)}" />
            </label>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <input class="input max-w-36 font-mono text-xs" name="cita" aria-label="Cita de figura" readonly value="[[figura:${f.numero}]]" />
            <button type="button" class="btn-secondary" data-copiar-figura>Copiar cita</button>
            <button type="submit" class="btn-secondary">Guardar datos</button>
            <button type="button" class="btn-secondary text-red-700" data-quitar-figura>Quitar</button>
          </div>
          </div>
        </form>`).join('') || '<p class="text-sm text-gray-500">El informe a\u00fan no tiene figuras.</p>';
      cargarImagenesVistaPrevia(informe, lista);
    } catch (e) {
      lista.textContent = /^Ruta .* no encontrada/.test(e.message)
        ? 'El servidor todav\u00eda no tiene disponible la ruta de anexos.'
        : 'No se pudieron cargar los anexos. ' + e.message;
    }
  }
  listar();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (guardando || !pendientes.length) return;
    guardando = true;
    archivos.disabled = true;
    subir.disabled = true;
    const total = pendientes.length;
    const seccion = form.elements.namedItem('seccion').value.trim();
    let cargadas = 0;
    try {
      while (pendientes.length) {
        const { archivo, card } = pendientes[0];
        estado.textContent = `Guardando imagen ${cargadas + 1} de ${total}\u2026`;
        const contenido = new FormData();
        contenido.append('imagen', archivo);
        contenido.append('leyenda', card.querySelector('input').value.trim() || `Imagen ${cargadas + 1}`);
        contenido.append('seccion', seccion);
        await api.post(ruta, contenido);
        pendientes.shift();
        card.remove();
        cargadas++;
      }
      estado.textContent = `Im\u00e1genes agregadas: ${cargadas}.`;
    } catch (e) {
      estado.textContent = `Im\u00e1genes agregadas: ${cargadas}. ${e.message}`;
    } finally {
      guardando = false;
      archivos.disabled = false;
      subir.disabled = !pendientes.length;
      if (lista.isConnected) await listar();
    }
  });
  lista.addEventListener('submit', async event => {
    event.preventDefault();
    const tarjeta = event.target;
    try {
      const { leyenda, seccion } = tarjeta.elements;
      await api.patch(`${ruta}/${tarjeta.dataset.figura}`, { leyenda: leyenda.value, seccion: seccion.value });
      toast('Datos de la figura guardados');
    } catch (e) { toast(e.message, 'error'); }
  });
  lista.addEventListener('click', async event => {
    const boton = event.target.closest('[data-copiar-figura], [data-quitar-figura]');
    if (!boton) return;
    const tarjeta = boton.closest('[data-figura]');
    if (boton.hasAttribute('data-copiar-figura')) {
      const campo = tarjeta.elements.namedItem('cita');
      try {
        await navigator.clipboard.writeText(campo.value);
        toast('Cita copiada');
      } catch { campo.focus(); campo.select(); }
      return;
    }
    if (!await confirmModal('La figura se quitar\u00e1 del anexo. Su n\u00famero se conservar\u00e1 en las citas existentes.', { title: 'Quitar figura', confirmLabel: 'Quitar' })) return;
    try {
      await api.delete(`${ruta}/${tarjeta.dataset.figura}`);
      tarjeta.remove();
      if (!lista.children.length && lista.isConnected) await listar();
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function openPreview() {
  const inf = _currentInforme;
  const dat = inf.datos || {};

  const boton = document.getElementById('btn-preview');
  let figuras = [];
  let errorAnexos = false;
  boton.disabled = true;
  try {
    figuras = await api.get(rutaFiguras(inf));
  } catch {
    errorAnexos = true;
  } finally {
    boton.disabled = false;
  }
  if (!boton.isConnected) return;
  showModal(
    `${esc(inf.codigo)} \u2013 Vista previa`,
    buildPreviewHTML(inf, dat, figuras, errorAnexos),
    '2xl',
    `<div class="flex justify-end">
      <button id="btn-imprimir-informe" type="button" class="btn-primary" disabled>${icon('print', 18)} Imprimir / Guardar PDF</button>
    </div>`
  );
  const vista = document.getElementById('preview-content');
  const imprimir = document.getElementById('btn-imprimir-informe');
  imprimir.addEventListener('click', () => imprimirInforme(inf, dat));
  vista.addEventListener('click', event => {
    const cita = event.target.closest('[data-cita-figura]');
    if (cita) vista.querySelector(`#figura-${cita.dataset.citaFigura}`)?.scrollIntoView({ block: 'center' });
  });
  await cargarImagenesVistaPrevia(inf, vista);
  await Promise.all([...vista.querySelectorAll('img[src]')].map(imagen => imagen.decode().catch(() => {})));
  imprimir.disabled = false;
}

function imprimirInforme(inf, dat) {
  const estilo = document.createElement('style');
  const { titulo, areas, version, fecha } = datosMembrete(inf, dat);
  const logo = document.querySelector('#preview-content .informe-membrete-logo img');
  let logoImpreso = '';
  if (logo?.naturalWidth) {
    const lienzo = document.createElement('canvas');
    lienzo.width = logo.naturalWidth;
    lienzo.height = logo.naturalHeight;
    lienzo.getContext('2d').drawImage(logo, 0, 0);
    logoImpreso = `@top-left { content: url("${lienzo.toDataURL('image/png')}"); }`;
  }
  const cssTexto = texto => '"' + String(texto).replace(/[\x00-\x1f"\\]/g, caracter =>
    '\\' + caracter.charCodeAt(0).toString(16) + ' ') + '"';
  estilo.textContent = `@page qubira-informe {
    ${logoImpreso}
    @top-center { content: ${cssTexto(['QUBIRA S.A.C.', titulo, areas].join('\n'))}; }
    @top-right { content: ${cssTexto([
      'C\u00f3digo: ' + (inf.codigo || ''), 'Versi\u00f3n: ' + version, 'Fecha: ' + fecha, 'Uso restringido',
    ].join('\n'))}; }
    @bottom-right { content: "P\u00e1gina " counter(page) " de " counter(pages) ${cssTexto(' | Versi\u00f3n ' + version)}; }
  }`;
  document.head.append(estilo);
  document.body.classList.add('imprimir-informe');
  const limpiar = () => {
    document.body.classList.remove('imprimir-informe');
    estilo.remove();
  };
  window.addEventListener('afterprint', limpiar, { once: true });
  try {
    window.print();
  } catch (error) {
    window.removeEventListener('afterprint', limpiar);
    limpiar();
    toast('No se pudo abrir la impresi\u00f3n. ' + error.message, 'error');
  }
}

function datosMembrete(inf, dat) {
  const proyecto = inf.project_name || dat.proyecto_origen?.nombre;
  return {
    titulo: proyecto ? `Informe de estado \u2013 Proyecto ${proyecto}` : 'Informe de estado',
    areas: areasParticipantes(dat).join(' \u00b7 '),
    version: String(inf.version || '1.0').replace(/\s+/g, ' ').slice(0, 24),
    fecha: fmtDate(inf.fecha_emision?.slice(0, 10) || inf.created_at),
  };
}

async function cargarImagenesVistaPrevia(inf, vista) {
  const imagenes = [...vista.querySelectorAll('[data-imagen-figura]')];
  async function cargar(imagen) {
    try {
      const blob = await api.getBlob(`${rutaFiguras(inf)}/${imagen.dataset.imagenFigura}`);
      if (!imagen.isConnected) return;
      mostrarImagenFigura(imagen, blob);
    } catch { imagen.alt = 'No se pudo cargar esta imagen.'; }
  }
  for (let i = 0; i < imagenes.length && vista.isConnected; i += 4) {
    await Promise.all(imagenes.slice(i, i + 4).map(cargar));
  }
}

function mostrarImagenFigura(imagen, blob) {
  const url = URL.createObjectURL(blob);
  const limpiar = () => URL.revokeObjectURL(url);
  imagen.addEventListener('load', limpiar, { once: true });
  imagen.addEventListener('error', limpiar, { once: true });
  imagen.src = url;
}

function renderAnexoFiguras(figuras) {
  if (!figuras.length) return '';
  const secciones = new Map();
  for (const figura of figuras) {
    const seccion = figura.seccion?.trim() || 'Evidencia visual';
    if (!secciones.has(seccion)) secciones.set(seccion, []);
    secciones.get(seccion).push(figura);
  }
  return `<section class="space-y-6 border-t border-gray-300 pt-4" aria-label="Anexo de imágenes">
    ${Array.from(secciones, ([seccion, imagenes], indice) => `
      <section aria-labelledby="anexo-seccion-${indice}" class="space-y-4">
        <h2 id="anexo-seccion-${indice}" class="break-after-avoid text-base font-bold text-gray-900">A.${indice + 1} ${esc(seccion)}</h2>
        ${imagenes.map(f => `
          <figure id="figura-${f.numero}" class="break-inside-avoid">
            <div class="mx-auto w-full sm:w-11/12">
              <img data-imagen-figura="${f.numero}" alt="${esc(f.leyenda)}" class="block h-auto w-full object-contain" />
            </div>
            <figcaption class="mt-1 px-2 text-center text-xs text-slate-600">
              <strong class="font-bold text-teal-700">Figura ${f.numero}.</strong> <em>${esc(f.leyenda)}</em>
            </figcaption>
          </figure>`).join('')}
      </section>`).join('')}
  </section>`;
}

function renderTablaPortada(inf, dat) {
  const origen = dat.proyecto_origen || {};
  const nombre = origen.nombre || inf.project_name;
  const codigo = origen.codigo || inf.project_code;
  const proyecto = nombre && codigo ? `${nombre} (${codigo})` : nombre || codigo;
  const fechaCorta = datosMembrete(inf, dat).fecha;
  const partesFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fechaCorta);
  const fecha = partesFecha
    ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(Number(partesFecha[3]), Number(partesFecha[2]) - 1, Number(partesFecha[1]))))
    : fechaCorta;
  const estado = [dat.estado_general, dat.detalle_estado_general?.trim()].filter(Boolean).join(' \u2013 ');
  const filas = [
    ['Dirigido a', dat.dirigido_a || 'Alta Direcci\u00f3n Gerencial (ADG)'],
    ['\u00c1reas participantes', areasParticipantes(dat).map(nombreAreaObservaciones).join('\n')],
    ['Cliente / marca', origen.cliente || inf.project_client],
    ['Proyecto', proyecto],
    ['Estado del proyecto', estado],
    ['Sitio publicado', dat.url_sitio_publicado || inf.project_url],
    ['Ubicaci\u00f3n', dat.ubicacion || 'Lima, Per\u00fa'],
    ['Fecha', fecha],
    ['C\u00f3digo', inf.codigo],
    ['Versi\u00f3n', inf.version || '1.0'],
    ['Tecnolog\u00edas', dat.tecnologias_usadas],
    ['L\u00edneas de c\u00f3digo', dat.lineas_codigo],
  ];
  return `<table class="w-full table-fixed border-collapse border border-slate-300 text-xs" aria-label="Datos de portada">
    <tbody>${filas.map(([etiqueta, valor], indice) => `<tr>
      <th scope="row" class="w-[25%] border border-slate-300 bg-slate-200 px-3 py-2 text-left font-semibold text-slate-800">${esc(etiqueta)}</th>
      <td class="whitespace-pre-line break-words border border-slate-300 px-3 py-2 ${indice === 4 ? 'font-semibold text-amber-800' : ''}">${esc(valor === '' || valor == null ? '\u2014' : valor)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function buildPreviewHTML(inf, dat, figuras = [], errorAnexos = false) {
  const numeros = new Set(figuras.map(figura => Number(figura.numero)));
  const citar = texto => esc(texto).replace(/\[\[figura:(\d+)\]\]/gi, (_, n) => numeros.has(Number(n))
    ? `<button type="button" class="text-primary-700 underline" data-cita-figura="${Number(n)}">Figura ${Number(n)}</button>`
    : `Figura ${Number(n)}`);
  const observaciones = areasParticipantes(dat)
    .map(area => ({ area, texto: observacionArea(dat, area) }))
    .filter(({ texto }) => texto.trim());
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
  const { titulo, areas, version, fecha } = datosMembrete(inf, dat);

  return `
    <div class="max-w-3xl mx-auto font-sans text-sm text-gray-800 space-y-6" id="preview-content">

      <!-- Encabezado institucional -->
      <header class="informe-membrete">
        <div class="informe-membrete-logo">
          <img src="/css/qubira-membrete.png" alt="Qubira" />
        </div>
        <div class="informe-membrete-centro">
          <div class="informe-membrete-titulo">
            <strong>QUBIRA S.A.C.</strong>
            <div>${esc(titulo)}</div>
          </div>
          <p class="informe-membrete-areas">${esc(areas)}</p>
        </div>
        <div class="informe-membrete-registro">
          <dl>
            <div><dt>C\u00f3digo</dt><dd>${esc(inf.codigo)}</dd></div>
            <div><dt>Versi\u00f3n</dt><dd>${esc(version)}</dd></div>
            <div><dt>Fecha</dt><dd>${esc(fecha)}</dd></div>
          </dl>
          <p>Uso restringido</p>
        </div>
      </header>

      <section class="informe-portada" aria-label="Portada del informe">
      <div class="informe-aviso-uso">
        <strong>Documento de uso restringido</strong>
        <p>Informe para las \u00e1reas participantes y los destinatarios autorizados.</p>
      </div>
      <h1 class="informe-portada-titulo text-center text-xl font-bold uppercase text-slate-800">${esc(inf.titulo || 'Informe de estado del proyecto')}</h1>

      ${dat.proyecto_origen ? `<div class="print:hidden">${renderProyectoOrigen(dat.proyecto_origen)}</div>` : ''}

      ${renderTablaPortada(inf, dat)}

      <div class="informe-portada-firmas border-t-2 border-gray-800 pt-4">
        <h2 class="font-bold text-sm uppercase mb-3">Firmas</h2>
        <div class="informe-portada-responsables grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs">
          <p><strong>Elaborado por</strong><br>${esc(inf.elaborado_nombre || '\u2014')}</p>
          <p><strong>Responsable de enviar el informe final a firma</strong><br>${esc(dat.responsable_envio_firma || '\u2014')}</p>
        </div>
        <div class="informe-portada-firmantes grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          ${areasParticipantes(dat).map(area => `
            <div class="text-center border border-gray-300 rounded p-3 break-inside-avoid">
              <div class="informe-portada-linea h-10 border-b border-gray-400 mb-2"></div>
              <p class="text-xs font-semibold">Revisa y firma \u00b7 ${esc(area)}</p>
              <p class="text-xs mt-1">${esc(responsableFirma(inf, dat, area) || '\u2014')}</p>
            </div>`).join('')}
        </div>
      </div>
      <div class="informe-portada-lugar text-center text-xs font-semibold">
        <div>${esc(dat.ubicacion || 'Lima, Per\u00fa')}</div>
        <div>${esc(/\d{4}$/.exec(fecha)?.[0] || '')}</div>
      </div>
      </section>

      <!-- Resumen Ejecutivo -->
      ${dat.resumen_ejecutivo ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">1. Resumen Ejecutivo</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${citar(dat.resumen_ejecutivo)}</p>
        </div>` : ''}

      <!-- Antecedentes -->
      ${dat.antecedentes || dat.antecedentes_tablas?.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">2. Antecedentes y Alcance</h2>
          <div class="space-y-3">${renderContenidoAntecedentes(dat, false, citar)}</div>
        </div>` : ''}

      <!-- Componentes -->
      ${componentes.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Componentes del Proyecto</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left">Nombre</th><th class="px-3 py-1.5 text-left">Descripci\u00f3n</th><th class="px-3 py-1.5 text-left">URL</th></tr></thead>
            <tbody>${componentes.map((c,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5">${esc(c.nombre)}</td><td class="px-3 py-1.5">${citar(c.descripcion)}</td><td class="px-3 py-1.5 font-mono text-xs">${esc(c.pagina_url)}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- M\u00f3dulos -->
      ${modulos.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">3. Estado de M\u00f3dulos</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left">M\u00f3dulo</th><th class="px-3 py-1.5 text-left">Estado</th><th class="px-3 py-1.5 text-left">Detalle</th></tr></thead>
            <tbody>${modulos.map((m,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-medium">${esc(m.nombre)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_MODULO[m.estado_modulo] || ''}">${ESTADOS_MODULO[m.estado_modulo] || m.estado_modulo}</span></td><td class="px-3 py-1.5">${citar(m.detalle)}</td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- RF -->
      ${reqs.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">4. Requerimientos Funcionales (${rfTotal} total \u2013 ${rfOpMaqueta} operativos, ${rfSimulado} simulados, ${rfPendiente} pendientes)</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left w-20">C\u00f3digo</th><th class="px-3 py-1.5 text-left">Descripci\u00f3n</th><th class="px-3 py-1.5 text-left w-40">Estado</th></tr></thead>
            <tbody>${reqs.map((r,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-mono font-bold">${esc(r.codigo)}</td><td class="px-3 py-1.5">${citar(r.descripcion)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_RF[r.estado_rf] || ''}">${ESTADOS_RF[r.estado_rf] || r.estado_rf}</span></td></tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- RNF -->
      ${rnfs.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">5. Requerimientos No Funcionales</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left w-20">C\u00f3digo</th><th class="px-3 py-1.5 text-left">Descripci\u00f3n</th><th class="px-3 py-1.5 text-left w-40">Evaluaci\u00f3n</th></tr></thead>
            <tbody>${rnfs.map((r, i) => {
              const evaluacion = evaluacionRNF(r);
              return `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}"><td class="px-3 py-1.5 font-mono font-bold">${esc(r.codigo)}</td><td class="px-3 py-1.5">${citar(r.descripcion)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_RNF[evaluacion] || ''}">${esc(evaluacion)}</span></td></tr>`;
            }).join('')}</tbody>
          </table>
        </div>` : ''}

      <!-- Observaciones -->
      ${observaciones.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-3">6. Observaciones por \u00c1rea</h2>
          ${observaciones.map(({ area, texto }) => `<div class="mb-3">
            <p class="font-semibold text-xs text-gray-600 mb-1">${esc(nombreAreaObservaciones(area))}</p>
            <p class="text-sm leading-relaxed whitespace-pre-line">${citar(texto)}</p>
          </div>`).join('')}
        </div>` : ''}

      <!-- Brechas -->
      ${brechas.length ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">7. Brechas Identificadas</h2>
          <table class="w-full text-xs border border-gray-200">
            <thead><tr class="bg-gray-100 font-semibold"><th class="px-3 py-1.5 text-left">#</th><th class="px-3 py-1.5 text-left">Necesidad</th><th class="px-3 py-1.5 text-left">Qu\u00e9 implica</th><th class="px-3 py-1.5 text-left w-20">Prioridad</th><th class="px-3 py-1.5 text-left">Criterio aceptaci\u00f3n</th></tr></thead>
            <tbody>${brechas.map((b,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-bold text-gray-500">${i+1}</td><td class="px-3 py-1.5">${citar(b.necesidad)}</td><td class="px-3 py-1.5">${citar(b.que_implica)}</td><td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded text-xs font-semibold ${COLORES_PRIORIDAD[b.prioridad] || ''}">${esc(b.prioridad)}</span></td><td class="px-3 py-1.5">${citar(b.criterio_aceptacion)}</td></tr>`).join('')}</tbody>
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
              <tbody>${fasesA.map((f,i) => `<tr class="${i%2===0?'bg-white':'bg-gray-50'}"><td class="px-3 py-1.5 font-medium">${esc(f.fase)}</td><td class="px-3 py-1.5">${citar(f.entregable)}</td><td class="px-3 py-1.5">${esc(f.requerimientos)}</td><td class="px-3 py-1.5">${esc(f.duracion)}</td></tr>`).join('')}</tbody>
            </table>` : '<p class="text-xs text-gray-400">Sin fases definidas.</p>'}
        </div>
        <div>
          <p class="font-bold mb-1">Escenario B: ${esc(dat.escenario_b_titulo || '')}</p>
          ${dat.escenario_b_descripcion ? `<p class="text-sm leading-relaxed whitespace-pre-line">${citar(dat.escenario_b_descripcion)}</p>` : ''}
        </div>
        <p class="mt-3 text-xs text-gray-500">Plazo de respuesta: <strong>${dat.plazo_respuesta_dias || 15} d\u00edas h\u00e1biles</strong></p>
      </div>

      <!-- Conclusiones -->
      ${dat.conclusiones ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">9. Conclusiones</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${citar(dat.conclusiones)}</p>
        </div>` : ''}
      ${dat.recomendacion ? `
        <div>
          <h2 class="font-bold text-sm uppercase border-b border-gray-300 pb-1 mb-2">Recomendaci\u00f3n</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${citar(dat.recomendacion)}</p>
        </div>` : ''}

      <!-- Hoja de respuesta -->
      ${dat.hoja_respuesta ? `
        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 class="font-bold text-sm uppercase mb-2">10. Hoja de Respuesta</h2>
          <p class="text-sm leading-relaxed whitespace-pre-line">${citar(dat.hoja_respuesta)}</p>
        </div>` : ''}
      ${errorAnexos ? '<p class="text-sm text-red-700">No se pudieron cargar los anexos.</p>' : ''}
      ${renderAnexoFiguras(figuras)}
      <footer class="informe-pie-vista">
        <span>QUBIRA S.A.C. \u00b7 Lima, Per\u00fa \u00b7 qubira.vercel.app \u00b7 Technology \u00b7 Innovation \u00b7 Development</span>
        <span>Versi\u00f3n ${esc(version)}</span>
      </footer>
    </div>`;
}
