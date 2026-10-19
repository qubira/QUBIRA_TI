import { api } from '../api.js';
import { toast, showModal, closeModal, spinner, icon } from '../utils.js';

let _items = [];
let _products = [];
let _selectedProduct = 'all';
let _searchQuery = '';
let _currentTabInModal = 'basic';
let _modalCustomFields = [];

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="info-tecnico-page">${spinner()}</div>`;
  load();
}

async function load() {
  try {
    const [infoRows, projectsRes] = await Promise.all([
      api.get('/tech-plan-info'),
      api.get('/projects').catch(() => [])
    ]);

    _items = Array.isArray(infoRows) ? infoRows : [];
    
    // Extraer lista única de productos
    const prodsSet = new Set();
    _items.forEach(it => { if (it.producto_nombre) prodsSet.add(it.producto_nombre); });
    if (Array.isArray(projectsRes)) {
      projectsRes.forEach(p => { if (p.name) prodsSet.add(p.name); });
    }
    _products = Array.from(prodsSet).sort();

    renderPage();
  } catch(err) {
    console.error('Error cargando info tecnico:', err);
    const c = document.getElementById('info-tecnico-page');
    if (c) c.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar la información técnica</p>';
  }
}

function renderPage() {
  const c = document.getElementById('info-tecnico-page');
  if (!c) return;

  const filtered = _items.filter(it => {
    if (_selectedProduct !== 'all' && (it.producto_nombre || '').toLowerCase() !== _selectedProduct.toLowerCase()) {
      return false;
    }
    if (_searchQuery) {
      const q = _searchQuery.toLowerCase();
      const inBasic = (it.producto_nombre || '').toLowerCase().includes(q) ||
                      (it.plan_nombre || '').toLowerCase().includes(q) ||
                      (it.precio || '').toLowerCase().includes(q) ||
                      (it.descripcion || '').toLowerCase().includes(q);
      const inLimits = (it.limites_tecnicos || '').toLowerCase().includes(q) ||
                       (it.limites_api || '').toLowerCase().includes(q) ||
                       (it.limites_archivos || '').toLowerCase().includes(q) ||
                       (it.cuentas_usuarios || '').toLowerCase().includes(q);
      const inTools = JSON.stringify(it.herramientas || []).toLowerCase().includes(q);
      const inExtras = JSON.stringify(it.campos_extra || []).toLowerCase().includes(q);
      if (!inBasic && !inLimits && !inTools && !inExtras) return false;
    }
    return true;
  });

  // Agrupar por producto
  const grouped = {};
  filtered.forEach(it => {
    const prod = it.producto_nombre || 'General';
    if (!grouped[prod]) grouped[prod] = [];
    grouped[prod].push(it);
  });

  c.innerHTML = `
    <!-- Encabezado de página -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-2xl">🧠</span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Info Técnico</h1>
          <span class="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200">
            Fichas Técnicas & Planes
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">
          Consulta rápida y gestión de herramientas, lenguajes, límites técnicos y políticas por plan de producto.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button type="button" id="btn-nuevo-plan" class="btn btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold shadow-sm rounded-lg">
          ${icon('add', 18)}
          <span>Nuevo Plan / Ficha Técnica</span>
        </button>
      </div>
    </div>

    <!-- Barra de Filtros y Búsqueda -->
    <div class="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs mb-6 space-y-3">
      <div class="flex flex-col md:flex-row items-center gap-3">
        <div class="relative flex-1 w-full">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            ${icon('search', 18)}
          </span>
          <input type="text" id="it-search-input" value="${esc(_searchQuery)}" placeholder="🔍 Buscar por producto, plan, herramienta, lenguaje, límite, API, cuota..."
            class="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all">
        </div>

        <div class="w-full md:w-64">
          <select id="it-product-filter" class="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">📁 Todos los Productos (${_products.length})</option>
            ${_products.map(p => `
              <option value="${esc(p)}" ${_selectedProduct.toLowerCase() === p.toLowerCase() ? 'selected' : ''}>
                ${esc(p)}
              </option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Quick Product Pills -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-gray-600">
        <span class="font-semibold shrink-0 text-gray-400">Filtrar:</span>
        <button type="button" class="px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${_selectedProduct === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}" data-prod="all">
          Todos (${_items.length})
        </button>
        ${_products.slice(0, 8).map(p => {
          const count = _items.filter(x => (x.producto_nombre || '').toLowerCase() === p.toLowerCase()).length;
          const isAct = _selectedProduct.toLowerCase() === p.toLowerCase();
          return `
            <button type="button" class="px-2.5 py-1 rounded-md font-medium transition-colors shrink-0 ${isAct ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}" data-prod="${esc(p)}">
              ${esc(p)} <span class="opacity-70">(${count})</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Lista de Fichas Técnicas -->
    <div id="it-list-container" class="space-y-8">
      ${Object.keys(grouped).length === 0 ? `
        <div class="bg-white rounded-xl border border-gray-200/80 p-12 text-center text-gray-400">
          <div class="text-4xl mb-3">🔍</div>
          <h3 class="text-base font-semibold text-gray-700">No se encontraron fichas técnicas</h3>
          <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            No hay planes registrados que coincidan con la búsqueda. Puedes crear un nuevo plan con el botón superior.
          </p>
        </div>
      ` : Object.entries(grouped).map(([prodName, plans]) => `
        <div class="space-y-4">
          <!-- Separador de Producto -->
          <div class="flex items-center gap-3 border-b border-gray-200 pb-2">
            <span class="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
              🏢
            </span>
            <div>
              <h2 class="text-lg font-bold text-gray-900">${esc(prodName)}</h2>
              <span class="text-xs text-gray-500 font-medium">${plans.length} plan${plans.length === 1 ? '' : 'es'} configurado${plans.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <!-- Cards de Planes del Producto -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            ${plans.map(renderPlanCard).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Listeners
  document.getElementById('btn-nuevo-plan')?.addEventListener('click', () => openPlanModal(null));

  const searchInp = document.getElementById('it-search-input');
  if (searchInp) {
    searchInp.addEventListener('input', e => {
      _searchQuery = e.target.value;
      renderPage();
      const updated = document.getElementById('it-search-input');
      if (updated) {
        updated.focus();
        updated.setSelectionRange(updated.value.length, updated.value.length);
      }
    });
  }

  document.getElementById('it-product-filter')?.addEventListener('change', e => {
    _selectedProduct = e.target.value;
    renderPage();
  });

  c.querySelectorAll('[data-prod]').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedProduct = btn.dataset.prod;
      renderPage();
    });
  });

  // Acciones en tarjetas: editar, eliminar, duplicar, copiar
  c.querySelectorAll('.btn-edit-plan').forEach(b => {
    b.addEventListener('click', () => {
      const item = _items.find(x => x.id === b.dataset.id);
      if (item) openPlanModal(item);
    });
  });

  c.querySelectorAll('.btn-delete-plan').forEach(b => {
    b.addEventListener('click', () => deletePlan(b.dataset.id));
  });

  c.querySelectorAll('.btn-clone-plan').forEach(b => {
    b.addEventListener('click', () => clonePlan(b.dataset.id));
  });

  c.querySelectorAll('.btn-copy-plan').forEach(b => {
    b.addEventListener('click', () => copyPlanToClipboard(b.dataset.id));
  });
}

function renderPlanCard(it) {
  const tools = Array.isArray(it.herramientas) ? it.herramientas : [];
  const extras = Array.isArray(it.campos_extra) ? it.campos_extra : [];

  return `
    <div class="card bg-white border border-gray-200/80 rounded-xl shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between" id="card-${it.id}">
      <!-- Header de la tarjeta -->
      <div class="p-5 border-b border-gray-100 bg-linear-to-r from-gray-50/50 to-white">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                ${esc(it.producto_nombre)}
              </span>
              <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                ${esc(it.categoria || 'Web')}
              </span>
            </div>
            <h3 class="text-lg font-bold text-gray-900 truncate" title="${esc(it.plan_nombre)}">
              ${esc(it.plan_nombre)}
            </h3>
          </div>

          <div class="text-right shrink-0">
            <span class="text-xs text-gray-500 block">Inversión Plan</span>
            <div class="text-base font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
              ${esc(it.precio || 'Consultar')}
            </div>
          </div>
        </div>

        ${it.descripcion ? `
          <p class="text-xs text-gray-600 mt-2 line-clamp-2">
            ${esc(it.descripcion)}
          </p>
        ` : ''}

        <!-- Stack de herramientas y lenguajes -->
        ${tools.length > 0 ? `
          <div class="flex items-center gap-1.5 flex-wrap mt-3 pt-2 border-t border-gray-100">
            <span class="text-[10.5px] font-semibold text-gray-400 shrink-0">Stack:</span>
            ${tools.map(t => {
              const name = typeof t === 'string' ? t : (t.name || 'Tool');
              const ic = typeof t === 'object' && t.icon ? t.icon : '⚡';
              return `
                <span class="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-200/60 px-2 py-0.5 rounded-md">
                  <span>${ic}</span> <span>${esc(name)}</span>
                </span>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>

      <!-- Cuerpo con Grid de Especificaciones Técnicas -->
      <div class="p-5 space-y-4 flex-1 text-xs">
        <!-- 1. Límites y Capacidad -->
        <div class="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-2">
          <div class="font-bold text-gray-800 flex items-center gap-1.5 text-xs text-indigo-700">
            <span>⚡</span> <span>Límites Técnicos & Cuotas</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11.5px]">
            <div>
              <span class="font-semibold text-gray-500 block">Límites Técnicos:</span>
              <span class="text-gray-800 font-medium">${esc(it.limites_tecnicos || 'No especificado')}</span>
            </div>
            <div>
              <span class="font-semibold text-gray-500 block">Cuota Mensual:</span>
              <span class="text-gray-800 font-medium">${esc(it.cuota_mensual || 'No especificado')}</span>
            </div>
            <div>
              <span class="font-semibold text-gray-500 block">Límites de Archivos:</span>
              <span class="text-gray-800 font-medium">${esc(it.limites_archivos || 'No especificado')}</span>
            </div>
            <div>
              <span class="font-semibold text-gray-500 block">Límites de API:</span>
              <span class="text-gray-800 font-medium">${esc(it.limites_api || 'No especificado')}</span>
            </div>
          </div>
        </div>

        <!-- 2. Usuarios, Seguridad & Dominio -->
        <div class="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-2">
          <div class="font-bold text-gray-800 flex items-center gap-1.5 text-xs text-indigo-700">
            <span>🔒</span> <span>Cuentas, Seguridad & Despliegue</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11.5px]">
            <div>
              <span class="font-semibold text-gray-500 block">Cuentas y Usuarios:</span>
              <span class="text-gray-800 font-medium">${esc(it.cuentas_usuarios || 'No especificado')}</span>
            </div>
            <div>
              <span class="font-semibold text-gray-500 block">Entrega y Dominio:</span>
              <span class="text-gray-800 font-medium">${esc(it.entrega_dominio || 'No especificado')}</span>
            </div>
            <div>
              <span class="font-semibold text-gray-500 block">Seguridad & Acceso:</span>
              <span class="text-gray-800 font-medium">${esc(it.seguridad_control_acceso || 'No especificado')}</span>
            </div>
            <div>
              <span class="font-semibold text-gray-500 block">Respaldo & Almacenamiento:</span>
              <span class="text-gray-800 font-medium">${esc(it.respaldo_almacenamiento || 'No especificado')}</span>
            </div>
          </div>
        </div>

        <!-- 3. IA, Video & Soporte -->
        <div class="bg-gray-50/70 p-3 rounded-lg border border-gray-100 space-y-2">
          <div class="font-bold text-gray-800 flex items-center gap-1.5 text-xs text-indigo-700">
            <span>🤖</span> <span>Multimedia, IA & Soporte</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11.5px]">
            <div>
              <span class="font-semibold text-gray-500 block">Complementos IA:</span>
              <span class="text-gray-800 font-medium">${esc(it.complementos_ia || 'No especificado')}</span>
            </div>
            <div>
              <span class="font-semibold text-gray-500 block">Video:</span>
              <span class="text-gray-800 font-medium">${esc(it.video || 'No especificado')}</span>
            </div>
            <div class="md:col-span-2">
              <span class="font-semibold text-gray-500 block">Soporte & SLA:</span>
              <span class="text-gray-800 font-medium">${esc(it.soporte || 'No especificado')}</span>
            </div>
          </div>
        </div>

        <!-- 4. Políticas de Escalabilidad & Alcance -->
        <details class="group border border-gray-200/80 rounded-lg p-2.5 bg-white transition-all text-xs">
          <summary class="font-semibold text-gray-700 cursor-pointer flex items-center justify-between select-none">
            <span class="flex items-center gap-1.5 text-indigo-600">
              <span>📋</span> <span>Políticas, Agregados y Exclusiones</span>
            </span>
            <span class="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div class="mt-3 pt-3 border-t border-gray-100 space-y-2 text-[11.5px]">
            ${it.agregados ? `<div><strong class="text-emerald-700">Agregados:</strong> <span class="text-gray-700">${esc(it.agregados)}</span></div>` : ''}
            ${it.que_no_incluye ? `<div><strong class="text-rose-700">Qué no incluye:</strong> <span class="text-gray-700">${esc(it.que_no_incluye)}</span></div>` : ''}
            ${it.ejemplo_consumo_mensual ? `<div><strong class="text-blue-700">Ejemplo de Consumo Mensual:</strong> <span class="text-gray-700">${esc(it.ejemplo_consumo_mensual)}</span></div>` : ''}
            ${it.pasa_si_te_pasas_del_limite ? `<div><strong class="text-amber-700">¿Qué pasa si te pasas del límite?:</strong> <span class="text-gray-700">${esc(it.pasa_si_te_pasas_del_limite)}</span></div>` : ''}
            ${it.cuando_subir ? `<div><strong class="text-indigo-700">¿Cuándo subir de plan?:</strong> <span class="text-gray-700">${esc(it.cuando_subir)}</span></div>` : ''}
            ${it.plan_no_resuelve ? `<div><strong class="text-gray-700">Lo que el plan no resuelve:</strong> <span class="text-gray-700">${esc(it.plan_no_resuelve)}</span></div>` : ''}
          </div>
        </details>

        <!-- 5. Campos Personalizados Dinámicos -->
        ${extras.length > 0 ? `
          <div class="border border-dashed border-gray-300 rounded-lg p-2.5 bg-gray-50/50 space-y-2">
            <div class="font-semibold text-gray-700 text-xs flex items-center gap-1">
              <span>✨</span> <span>Campos Personalizados (${extras.length}):</span>
            </div>
            <div class="grid grid-cols-1 gap-1.5 text-[11px]">
              ${extras.map(f => `
                <div class="flex items-start gap-2 bg-white p-1.5 rounded border border-gray-200/60">
                  <span class="font-bold text-gray-700 shrink-0">${esc(f.titulo || 'Campo')}:</span>
                  <span class="text-gray-600">${esc(f.valor || '—')}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Footer de Acciones (ADG / OTI) -->
      <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
        <button type="button" class="btn-copy-plan btn btn-outline btn-xs inline-flex items-center gap-1 text-xs text-gray-600 hover:text-indigo-600" data-id="${it.id}" title="Copiar resumen al portapapeles">
          <span>📋</span> <span>Copiar Ficha</span>
        </button>

        <div class="flex items-center gap-2">
          <button type="button" class="btn-clone-plan btn btn-outline btn-xs inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900" data-id="${it.id}" title="Duplicar como nuevo plan">
            <span>📑</span> <span>Duplicar</span>
          </button>
          <button type="button" class="btn-edit-plan btn btn-primary btn-xs inline-flex items-center gap-1 text-xs" data-id="${it.id}">
            ${icon('edit', 14)} <span>Editar</span>
          </button>
          <button type="button" class="btn-delete-plan btn btn-danger btn-xs inline-flex items-center gap-1 text-xs" data-id="${it.id}" title="Eliminar este plan">
            ${icon('delete', 14)}
          </button>
        </div>
      </div>
    </div>
  `;
}

function openPlanModal(item) {
  const isEditing = !!item;
  const initial = item || {
    producto_nombre: _selectedProduct !== 'all' ? _selectedProduct : (_products[0] || 'QUOFFICE'),
    plan_nombre: '',
    categoria: 'SaaS / ERP Cloud',
    precio: '',
    descripcion: '',
    limites_tecnicos: '',
    agregados: '',
    que_no_incluye: '',
    ejemplo_consumo_mensual: '',
    pasa_si_te_pasas_del_limite: '',
    cuando_subir: '',
    cuota_mensual: '',
    limites_archivos: '',
    limites_api: '',
    cuentas_usuarios: '',
    seguridad_control_acceso: '',
    entrega_dominio: '',
    respaldo_almacenamiento: '',
    complementos_ia: '',
    video: '',
    soporte: '',
    plan_no_resuelve: '',
    herramientas: [],
    campos_extra: []
  };

  _currentTabInModal = 'basic';
  _modalCustomFields = Array.isArray(initial.campos_extra) ? JSON.parse(JSON.stringify(initial.campos_extra)) : [];
  let modalTools = Array.isArray(initial.herramientas) ? JSON.parse(JSON.stringify(initial.herramientas)) : [];

  const modalHtml = `
    <div class="max-w-4xl w-full flex flex-col max-h-[90vh]">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-xl">${isEditing ? '✏️' : '✨'}</span>
          <h2 class="text-lg font-bold text-gray-900">
            ${isEditing ? `Editar Ficha Técnica: ${esc(initial.plan_nombre)}` : 'Nueva Ficha Técnica de Plan'}
          </h2>
        </div>
        <button type="button" id="it-modal-close" class="text-gray-400 hover:text-gray-600 p-1">✕</button>
      </div>

      <!-- Navigation Tabs inside modal -->
      <div class="flex items-center border-b border-gray-200 bg-gray-50 px-6 gap-2 overflow-x-auto text-xs">
        <button type="button" class="tab-btn py-3 px-3 font-semibold border-b-2 text-indigo-600 border-indigo-600 transition-colors" data-tab="basic">
          1. Básico & Stack
        </button>
        <button type="button" class="tab-btn py-3 px-3 font-semibold text-gray-500 border-b-2 border-transparent hover:text-gray-700 transition-colors" data-tab="limits">
          2. Límites & Cuotas
        </button>
        <button type="button" class="tab-btn py-3 px-3 font-semibold text-gray-500 border-b-2 border-transparent hover:text-gray-700 transition-colors" data-tab="scope">
          3. Alcance & Seguridad
        </button>
        <button type="button" class="tab-btn py-3 px-3 font-semibold text-gray-500 border-b-2 border-transparent hover:text-gray-700 transition-colors" data-tab="scale">
          4. Multimedia, IA & Soporte
        </button>
        <button type="button" class="tab-btn py-3 px-3 font-semibold text-gray-500 border-b-2 border-transparent hover:text-gray-700 transition-colors" data-tab="extras">
          5. Campos Dinámicos (${_modalCustomFields.length})
        </button>
      </div>

      <!-- Modal Body (Form) -->
      <form id="it-plan-form" class="flex-1 overflow-y-auto p-6 space-y-4">
        <!-- TAB 1: BÁSICO & STACK -->
        <div id="tab-pane-basic" class="tab-pane space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Producto Asignado *</label>
              <input type="text" id="it-f-producto" required value="${esc(initial.producto_nombre)}" list="it-prod-datalist"
                placeholder="Ej. QUOFFICE, QubiraFact, Sistema Web..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
              <datalist id="it-prod-datalist">
                ${_products.map(p => `<option value="${esc(p)}"></option>`).join('')}
              </datalist>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Nombre del Plan *</label>
              <input type="text" id="it-f-plan" required value="${esc(initial.plan_nombre)}"
                placeholder="Ej. Plan Starter, Plan Pro, Plan Enterprise..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Precio / Inversión</label>
              <input type="text" id="it-f-precio" value="${esc(initial.precio)}"
                placeholder="Ej. $ 150.00 / mes o S/ 550.00 / mes"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Categoría / Tipo</label>
              <input type="text" id="it-f-categoria" value="${esc(initial.categoria || 'Web')}"
                placeholder="Ej. SaaS / ERP Cloud, Facturación, Web, Móvil..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Descripción del Plan</label>
            <textarea id="it-f-descripcion" rows="2" placeholder="Resumen general del alcance y objetivo técnico de este plan..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">${esc(initial.descripcion)}</textarea>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">Herramientas y Lenguajes Asociados</label>
              <span class="text-[11px] text-gray-400">Separar por comas para agregar rápido</span>
            </div>
            <input type="text" id="it-f-tools-raw" value="${esc(toolsToString(modalTools))}"
              placeholder="Ej. React, Node.js, PostgreSQL, Vercel Pro, Cloudinary, Docker"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
          </div>
        </div>

        <!-- TAB 2: LÍMITES & CUOTAS -->
        <div id="tab-pane-limits" class="tab-pane hidden space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Límites Técnicos</label>
              <textarea id="it-f-lim-tec" rows="2" placeholder="Ej. Concurrencia máxima, peticiones por minuto, CPU/RAM asignada..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.limites_tecnicos)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Cuota Mensual</label>
              <textarea id="it-f-cuota-mes" rows="2" placeholder="Ej. Límite global mensual de transacciones, 100,000 peticiones API..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.cuota_mensual)}</textarea>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Límites de Archivos</label>
              <textarea id="it-f-lim-files" rows="2" placeholder="Ej. Máx 25 MB por archivo, 50 GB almacenamiento total en la nube..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.limites_archivos)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Límites de API</label>
              <textarea id="it-f-lim-api" rows="2" placeholder="Ej. 120 req/min, webhooks incluidos, claves sandbox y producción..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.limites_api)}</textarea>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Cuentas y Usuarios</label>
            <input type="text" id="it-f-cuentas-users" value="${esc(initial.cuentas_usuarios)}"
              placeholder="Ej. 5 cuentas de usuario administrador, ilimitados clientes de consulta"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
          </div>
        </div>

        <!-- TAB 3: ALCANCE & SEGURIDAD -->
        <div id="tab-pane-scope" class="tab-pane hidden space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Agregados (Features incluidos)</label>
              <textarea id="it-f-agregados" rows="2" placeholder="Módulos adicionales, integraciones activas, exportadores..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.agregados)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Qué No Incluye</label>
              <textarea id="it-f-no-incluye" rows="2" placeholder="Límites de alcance o integraciones excluidas en este tier..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.que_no_incluye)}</textarea>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Seguridad y Control de Acceso</label>
              <textarea id="it-f-seguridad" rows="2" placeholder="Ej. JWT, 2FA, RBAC roles, SSL/TLS, auditoría inmutable de logs..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.seguridad_control_acceso)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Entrega y Dominio</label>
              <textarea id="it-f-dominio" rows="2" placeholder="Ej. Subdominio *.qubira.app o dominio propio del cliente con SSL..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.entrega_dominio)}</textarea>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Respaldo y Almacenamiento</label>
              <textarea id="it-f-respaldo" rows="2" placeholder="Ej. Backups diarios automáticos a las 02:00 AM, retención de 30 días..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.respaldo_almacenamiento)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Lo que el Plan No Resuelve</label>
              <textarea id="it-f-no-resuelve" rows="2" placeholder="Requerimientos o expectativas que este plan explícitamente no abarca..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.plan_no_resuelve)}</textarea>
            </div>
          </div>
        </div>

        <!-- TAB 4: MULTIMEDIA, IA & SOPORTE -->
        <div id="tab-pane-scale" class="tab-pane hidden space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Complementos IA</label>
              <textarea id="it-f-ia" rows="2" placeholder="Ej. Asistente con GPT-4o mini, 500 consultas mensuales, OCR de facturas..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.complementos_ia)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Video</label>
              <textarea id="it-f-video" rows="2" placeholder="Ej. Videos incrustados YouTube/Vimeo o streaming adaptativo de hasta 20GB..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.video)}</textarea>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Soporte & Canales</label>
            <input type="text" id="it-f-soporte" value="${esc(initial.soporte)}"
              placeholder="Ej. Soporte 24/7 WhatsApp y tickets, SLA de 45 minutos..."
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">Ejemplo de Consumo Mensual</label>
              <textarea id="it-f-ej-consumo" rows="2" placeholder="Ej. 100 ventas/día, 5,000 comprobantes/mes..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.ejemplo_consumo_mensual)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">¿Qué pasa si te pasas del límite?</label>
              <textarea id="it-f-over-limit" rows="2" placeholder="Ej. Cobro adicional de $ 0.50 por millar o alerta sin corte..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.pasa_si_te_pasas_del_limite)}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">¿Cuándo subir de plan?</label>
              <textarea id="it-f-upgrade-when" rows="2" placeholder="Ej. Al superar 5 sucursales o 50,000 visitas/mes..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none">${esc(initial.cuando_subir)}</textarea>
            </div>
          </div>
        </div>

        <!-- TAB 5: CAMPOS PERSONALIZADOS DINÁMICOS -->
        <div id="tab-pane-extras" class="tab-pane hidden space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-gray-200">
            <div>
              <h4 class="font-bold text-gray-900 text-sm">Campos Adicionales Dinámicos</h4>
              <p class="text-xs text-gray-500">Agrega cualquier especificación o variable técnica personalizada para este plan.</p>
            </div>
            <button type="button" id="btn-add-modal-custom-field" class="btn btn-outline btn-sm inline-flex items-center gap-1.5 text-xs text-indigo-600 font-bold border-indigo-200 hover:bg-indigo-50">
              <span>+</span> <span>Agregar Campo Personalizado</span>
            </button>
          </div>

          <div id="modal-custom-fields-list" class="space-y-3">
            <!-- Renderizado dinámico -->
          </div>
        </div>
      </form>

      <!-- Modal Footer -->
      <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <button type="button" id="it-modal-cancel" class="btn btn-outline text-sm">Cancelar</button>
        <button type="button" id="it-modal-save" class="btn btn-primary text-sm px-6 py-2 font-bold shadow-sm inline-flex items-center gap-2">
          ${icon('check', 16)} <span>Guardar Ficha Técnica</span>
        </button>
      </div>
    </div>
  `;

  showModal(modalHtml);

  // Tab switching inside modal
  const modalEl = document.querySelector('.modal-content, [role="dialog"]') || document.body;
  modalEl.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      modalEl.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('text-indigo-600', 'border-indigo-600');
        b.classList.add('text-gray-500', 'border-transparent');
      });
      btn.classList.remove('text-gray-500', 'border-transparent');
      btn.classList.add('text-indigo-600', 'border-indigo-600');

      modalEl.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
      const activePane = modalEl.querySelector(`#tab-pane-${tab}`);
      if (activePane) activePane.classList.remove('hidden');
    });
  });

  // Render initial custom fields
  renderModalCustomFieldsList();

  modalEl.querySelector('#btn-add-modal-custom-field')?.addEventListener('click', () => {
    _modalCustomFields.push({
      id: 'fld_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      titulo: '',
      valor: ''
    });
    renderModalCustomFieldsList();
  });

  modalEl.querySelector('#it-modal-close')?.addEventListener('click', closeModal);
  modalEl.querySelector('#it-modal-cancel')?.addEventListener('click', closeModal);

  modalEl.querySelector('#it-modal-save')?.addEventListener('click', async () => {
    const prod = modalEl.querySelector('#it-f-producto')?.value.trim();
    const plan = modalEl.querySelector('#it-f-plan')?.value.trim();

    if (!prod || !plan) {
      toast('warning', 'Campos requeridos', 'Debes ingresar el Producto Asignado y el Nombre del Plan.');
      return;
    }

    // Parse tools from input
    const toolsRaw = modalEl.querySelector('#it-f-tools-raw')?.value.trim() || '';
    const parsedTools = toolsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name, category: 'tool', icon: '⚡' }));

    // Read custom fields values
    const customFieldsFinal = [];
    modalEl.querySelectorAll('.custom-field-row').forEach(row => {
      const t = row.querySelector('.cf-title')?.value.trim() || '';
      const v = row.querySelector('.cf-value')?.value.trim() || '';
      if (t || v) {
        customFieldsFinal.push({ id: row.dataset.id || 'cf_' + Date.now(), titulo: t, valor: v });
      }
    });

    const payload = {
      producto_nombre: prod,
      plan_nombre: plan,
      categoria: modalEl.querySelector('#it-f-categoria')?.value.trim() || 'Web',
      precio: modalEl.querySelector('#it-f-precio')?.value.trim() || '',
      descripcion: modalEl.querySelector('#it-f-descripcion')?.value.trim() || '',
      herramientas: parsedTools,
      limites_tecnicos: modalEl.querySelector('#it-f-lim-tec')?.value.trim() || '',
      cuota_mensual: modalEl.querySelector('#it-f-cuota-mes')?.value.trim() || '',
      limites_archivos: modalEl.querySelector('#it-f-lim-files')?.value.trim() || '',
      limites_api: modalEl.querySelector('#it-f-lim-api')?.value.trim() || '',
      cuentas_usuarios: modalEl.querySelector('#it-f-cuentas-users')?.value.trim() || '',
      agregados: modalEl.querySelector('#it-f-agregados')?.value.trim() || '',
      que_no_incluye: modalEl.querySelector('#it-f-no-incluye')?.value.trim() || '',
      seguridad_control_acceso: modalEl.querySelector('#it-f-seguridad')?.value.trim() || '',
      entrega_dominio: modalEl.querySelector('#it-f-dominio')?.value.trim() || '',
      respaldo_almacenamiento: modalEl.querySelector('#it-f-respaldo')?.value.trim() || '',
      plan_no_resuelve: modalEl.querySelector('#it-f-no-resuelve')?.value.trim() || '',
      complementos_ia: modalEl.querySelector('#it-f-ia')?.value.trim() || '',
      video: modalEl.querySelector('#it-f-video')?.value.trim() || '',
      soporte: modalEl.querySelector('#it-f-soporte')?.value.trim() || '',
      ejemplo_consumo_mensual: modalEl.querySelector('#it-f-ej-consumo')?.value.trim() || '',
      pasa_si_te_pasas_del_limite: modalEl.querySelector('#it-f-over-limit')?.value.trim() || '',
      cuando_subir: modalEl.querySelector('#it-f-upgrade-when')?.value.trim() || '',
      campos_extra: customFieldsFinal
    };

    try {
      if (isEditing) {
        await api.put(`/tech-plan-info/${item.id}`, payload);
        toast('success', 'Plan Actualizado', `La ficha técnica de ${plan} se actualizó con éxito.`);
      } else {
        await api.post('/tech-plan-info', payload);
        toast('success', 'Plan Creado', `La ficha técnica de ${plan} para ${prod} fue creada.`);
      }
      closeModal();
      load();
    } catch(err) {
      toast('error', 'Error al guardar', err.message || 'No se pudo guardar la ficha técnica.');
    }
  });
}

function renderModalCustomFieldsList() {
  const container = document.getElementById('modal-custom-fields-list');
  if (!container) return;

  if (_modalCustomFields.length === 0) {
    container.innerHTML = `
      <div class="p-6 border border-dashed border-gray-200 rounded-lg text-center text-gray-400 text-xs">
        No hay campos adicionales configurados aún. Haz clic en "+ Agregar Campo Personalizado" para añadir especificaciones personalizadas.
      </div>
    `;
    return;
  }

  container.innerHTML = _modalCustomFields.map((cf, idx) => `
    <div class="custom-field-row flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200" data-id="${cf.id}">
      <span class="text-xs font-bold text-gray-400 pt-2 shrink-0">#${idx + 1}</span>
      <div class="w-1/3 shrink-0">
        <label class="block text-[11px] font-bold text-gray-600 mb-1">Título del Campo</label>
        <input type="text" value="${esc(cf.titulo)}" placeholder="Ej. Hardware, SLA, SUNAT..."
          class="cf-title w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white outline-none">
      </div>
      <div class="flex-1 min-w-0">
        <label class="block text-[11px] font-bold text-gray-600 mb-1">Contenido / Especificación</label>
        <textarea rows="1" placeholder="Descripción detallada o valor..."
          class="cf-value w-full px-3 py-1.5 border border-gray-300 rounded text-xs bg-white outline-none">${esc(cf.valor)}</textarea>
      </div>
      <button type="button" class="btn-remove-cf text-red-500 hover:text-red-700 p-1.5 mt-5 rounded hover:bg-red-50 transition-colors" data-idx="${idx}" title="Eliminar campo">
        ✕
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.btn-remove-cf').forEach(b => {
    b.addEventListener('click', () => {
      const idx = Number(b.dataset.idx);
      _modalCustomFields.splice(idx, 1);
      renderModalCustomFieldsList();
    });
  });
}

function toolsToString(tools) {
  if (!Array.isArray(tools)) return '';
  return tools.map(t => (typeof t === 'string' ? t : (t.name || ''))).filter(Boolean).join(', ');
}

async function deletePlan(id) {
  const item = _items.find(x => x.id === id);
  if (!confirm(`¿Estás seguro de eliminar el plan "${item ? item.plan_nombre : 'seleccionado'}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api.delete(`/tech-plan-info/${id}`);
    toast('success', 'Plan Eliminado', 'La ficha técnica fue eliminada del sistema.');
    load();
  } catch(err) {
    toast('error', 'Error al eliminar', err.message);
  }
}

async function clonePlan(id) {
  const item = _items.find(x => x.id === id);
  if (!item) return;

  const clonePayload = {
    ...item,
    plan_nombre: `${item.plan_nombre} (Copia)`,
    id: undefined
  };

  try {
    await api.post('/tech-plan-info', clonePayload);
    toast('success', 'Plan Duplicado', `Se creó una copia de "${item.plan_nombre}".`);
    load();
  } catch(err) {
    toast('error', 'Error al duplicar', err.message);
  }
}

function copyPlanToClipboard(id) {
  const it = _items.find(x => x.id === id);
  if (!it) return;

  const toolsStr = toolsToString(it.herramientas);
  const text = `
📌 FICHA TÉCNICA: ${it.producto_nombre} - ${it.plan_nombre}
💰 Precio / Inversión: ${it.precio || 'Consultar'}
🏷️ Categoría: ${it.categoria || 'Web'}
💻 Stack: ${toolsStr || 'Estándar'}

📝 DESCRIPCIÓN:
${it.descripcion || '—'}

⚡ LÍMITES TÉCNICOS & CAPACIDAD:
- Límites Técnicos: ${it.limites_tecnicos || '—'}
- Cuota Mensual: ${it.cuota_mensual || '—'}
- Límites de Archivos: ${it.limites_archivos || '—'}
- Límites de API: ${it.limites_api || '—'}
- Cuentas y Usuarios: ${it.cuentas_usuarios || '—'}

🔒 SEGURIDAD & INFRAESTRUCTURA:
- Seguridad y Control de Acceso: ${it.seguridad_control_acceso || '—'}
- Entrega y Dominio: ${it.entrega_dominio || '—'}
- Respaldo y Almacenamiento: ${it.respaldo_almacenamiento || '—'}

🤖 MULTIMEDIA & SOPORTE:
- Complementos IA: ${it.complementos_ia || '—'}
- Video: ${it.video || '—'}
- Soporte: ${it.soporte || '—'}

📈 ESCALABILIDAD & POLÍTICAS:
- Agregados: ${it.agregados || '—'}
- Qué No Incluye: ${it.que_no_incluye || '—'}
- Ejemplo de Consumo Mensual: ${it.ejemplo_consumo_mensual || '—'}
- ¿Qué pasa si te pasas del límite?: ${it.pasa_si_te_pasas_del_limite || '—'}
- ¿Cuándo subir de plan?: ${it.cuando_subir || '—'}
- Lo que el plan no resuelve: ${it.plan_no_resuelve || '—'}
${(it.campos_extra || []).map(f => `• ${f.titulo}: ${f.valor}`).join('\n')}

🏢 Qubira Tech Solutions · Ficha Técnica
`.trim();

  navigator.clipboard.writeText(text).then(() => {
    toast('success', 'Ficha Copiada', 'La información técnica fue copiada al portapapeles.');
  }).catch(() => {
    toast('info', 'Texto generado', 'No se pudo copiar automáticamente.');
  });
}
