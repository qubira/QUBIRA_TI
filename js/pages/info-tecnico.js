import { api } from '../api.js';
import { toast, showModal, closeModal, spinner, icon } from '../utils.js';

let _items = []; // Fichas técnicas registradas (ti.tech_plan_info)
let _catalog = { language: [], tool: [] }; // Catálogo completo (ti.technology_catalog)
let _allTechs = []; // Array unificado de tecnologías
let _selectedCategory = 'all'; // 'all' | 'tool' | 'language'
let _selectedTechName = null; // Nombre de tecnología seleccionada actualmente
let _selectedPlanId = null; // ID del plan seleccionado actualmente
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

function thumbUrl(url, size = 64) {
  if (!url) return '';
  if (typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/image/upload/') && !url.includes('/image/upload/w_')) {
    return url.replace('/image/upload/', `/image/upload/w_${size},h_${size},c_fit,f_auto,q_auto/`);
  }
  return url;
}

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="info-tecnico-page">${spinner()}</div>`;
  load();
}

async function load() {
  try {
    const [infoRows, langs, tools] = await Promise.all([
      api.get('/tech-plan-info'),
      api.get('/technology-catalog', { category: 'language' }).catch(() => []),
      api.get('/technology-catalog', { category: 'tool' }).catch(() => [])
    ]);

    _items = Array.isArray(infoRows) ? infoRows : [];
    _catalog = {
      language: Array.isArray(langs) ? langs : [],
      tool: Array.isArray(tools) ? tools : []
    };

    // Unificar catálogo completo con información de logo y categoría
    const techMap = new Map();
    [..._catalog.language, ..._catalog.tool].forEach(t => {
      techMap.set((t.name || '').toLowerCase(), {
        id: t.id,
        name: t.name,
        category: t.category,
        image_url: t.image_url || '',
        plans: Array.isArray(t.plans) ? t.plans : []
      });
    });

    // Agregar cualquier tecnología que esté en info-tecnico y no esté en catálogo
    _items.forEach(it => {
      const key = (it.tech_name || it.producto_nombre || '').toLowerCase();
      if (key && !techMap.has(key)) {
        techMap.set(key, {
          id: it.tech_id || null,
          name: it.tech_name || it.producto_nombre,
          category: it.category || 'tool',
          image_url: it.image_url || '',
          plans: []
        });
      }
    });

    _allTechs = Array.from(techMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    // Si hay parámetro en hash (ej: #/info-tecnico?tech=AWS), seleccionarlo
    const hash = window.location.hash || '';
    if (hash.includes('tech=')) {
      const match = hash.match(/tech=([^&]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        const exists = _allTechs.find(t => t.name.toLowerCase() === decoded.toLowerCase());
        if (exists) _selectedTechName = exists.name;
      }
    }

    // Por defecto seleccionar la primera tecnología con planes o la primera del catálogo
    if (!_selectedTechName && _allTechs.length > 0) {
      const firstWithPlans = _allTechs.find(t => _items.some(it => (it.tech_name || '').toLowerCase() === t.name.toLowerCase()));
      _selectedTechName = firstWithPlans ? firstWithPlans.name : _allTechs[0].name;
    }

    renderPageSkeleton();
    updateView();
  } catch(err) {
    console.error('Error cargando info técnico:', err);
    const c = document.getElementById('info-tecnico-page');
    if (c) c.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar la información técnica</p>';
  }
}

/**
 * Renderiza el esqueleto general una sola vez para que el input de búsqueda
 * y los filtros no se destruyan al escribir (evita perder el foco).
 */
function renderPageSkeleton() {
  const c = document.getElementById('info-tecnico-page');
  if (!c) return;

  const toolCount = _allTechs.filter(t => t.category === 'tool').length;
  const langCount = _allTechs.filter(t => t.category === 'language').length;
  const totalCount = _allTechs.length;

  c.innerHTML = `
    <!-- Encabezado de página -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-2xl">⚡</span>
          <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Info Técnico</h1>
          <span class="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200">
            Catálogo de Tecnologías & Planes
          </span>
        </div>
        <p class="text-sm text-gray-500 mt-1">
          Consultas técnicas rápidas de herramientas y lenguajes de la empresa: límites, políticas, cuotas y especificaciones por plan.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button type="button" id="btn-nuevo-plan" class="btn-primary flex items-center gap-2 shadow-sm">
          ${icon('add', 18)} Nuevo Plan Técnico
        </button>
      </div>
    </div>

    <!-- Barra de Filtros, Categorías y Búsqueda Inteligente -->
    <div class="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0" id="category-pills-bar">
        <button type="button" class="category-pill px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          _selectedCategory === 'all'
            ? 'bg-primary-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }" data-cat="all">
          🌐 Todas (${totalCount})
        </button>
        <button type="button" class="category-pill px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          _selectedCategory === 'tool'
            ? 'bg-primary-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }" data-cat="tool">
          🛠️ Herramientas (${toolCount})
        </button>
        <button type="button" class="category-pill px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
          _selectedCategory === 'language'
            ? 'bg-primary-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }" data-cat="language">
          💻 Lenguajes (${langCount})
        </button>
      </div>

      <!-- Buscador (Persistente para no perder foco al escribir) -->
      <div class="relative w-full md:w-80">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          ${icon('search', 16)}
        </div>
        <input type="text" id="tech-search-input" value="${esc(_searchQuery)}" placeholder="Buscar herramienta o lenguaje..."
          autocomplete="off"
          class="input pl-9 pr-8 py-1.5 text-xs w-full bg-gray-50 hover:bg-white focus:bg-white border-gray-200 rounded-lg transition-all">
        <button type="button" id="clear-search-btn" class="${_searchQuery ? '' : 'hidden'} absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer" title="Limpiar búsqueda">
          ${icon('close', 14)}
        </button>
      </div>
    </div>

    <!-- Layout Master-Detail: Tecnologías (Izquierda) + Ficha Técnica (Derecha) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- Columna Izquierda: Lista de Tecnologías (Catálogo)
           lg:sticky lg:top-4 self-start: NO se baja al scrollear la ficha técnica -->
      <div class="lg:col-span-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col lg:sticky lg:top-4 self-start">
        <div class="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span class="text-xs font-bold text-gray-700 uppercase tracking-wider" id="tech-count-badge">
            Tecnologías (${totalCount})
          </span>
          <span class="text-[11px] text-gray-400">Selecciona para ver ficha</span>
        </div>

        <!-- Scroll independiente para la lista de tecnologías -->
        <div class="divide-y divide-gray-100 max-h-[calc(100vh-14rem)] overflow-y-auto" id="tech-list-scroll">
          <!-- Se inyecta con updateView() -->
        </div>
      </div>

      <!-- Columna Derecha: Detalle Técnico de la Tecnología Seleccionada -->
      <div class="lg:col-span-8 flex flex-col gap-5" id="tech-detail-mount">
        <!-- Se inyecta con updateView() -->
      </div>

    </div>
  `;

  // Listeners de la barra superior y buscador (permanentes)
  const searchInput = document.getElementById('tech-search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      _searchQuery = e.target.value;
      if (clearBtn) {
        if (_searchQuery) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
      updateView();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      _searchQuery = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      clearBtn.classList.add('hidden');
      updateView();
    });
  }

  document.querySelectorAll('.category-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedCategory = btn.dataset.cat;
      // Actualizar estilo visual de las píldoras
      document.querySelectorAll('.category-pill').forEach(b => {
        if (b.dataset.cat === _selectedCategory) {
          b.className = 'category-pill px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-primary-600 text-white shadow-sm';
        } else {
          b.className = 'category-pill px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-gray-100 text-gray-600 hover:bg-gray-200';
        }
      });
      updateView();
    });
  });

  document.getElementById('btn-nuevo-plan')?.addEventListener('click', () => {
    openPlanModal(null, _selectedTechName || '');
  });
}

/**
 * Actualiza la lista izquierda y el detalle derecho sin tocar el input de búsqueda.
 */
function updateView() {
  const listContainer = document.getElementById('tech-list-scroll');
  const countBadge = document.getElementById('tech-count-badge');
  const detailMount = document.getElementById('tech-detail-mount');
  if (!listContainer || !detailMount) return;

  // Filtrar tecnologías
  const q = (_searchQuery || '').trim().toLowerCase();
  const filteredTechs = _allTechs.filter(t => {
    if (_selectedCategory !== 'all' && t.category !== _selectedCategory) return false;
    if (q) {
      const inName = t.name.toLowerCase().includes(q);
      const inPlans = _items.some(it => 
        (it.tech_name || it.producto_nombre || '').toLowerCase() === t.name.toLowerCase() &&
        ((it.plan_nombre || '').toLowerCase().includes(q) ||
         (it.descripcion || '').toLowerCase().includes(q) ||
         (it.limites_tecnicos || '').toLowerCase().includes(q) ||
         (it.precio || '').toLowerCase().includes(q))
      );
      if (!inName && !inPlans) return false;
    }
    return true;
  });

  // Actualizar contador
  if (countBadge) {
    countBadge.textContent = `Tecnologías (${filteredTechs.length})`;
  }

  // Asegurar que haya una tecnología activa seleccionada
  let currentTech = _allTechs.find(t => t.name.toLowerCase() === (_selectedTechName || '').toLowerCase());
  if (!currentTech || !filteredTechs.some(t => t.name.toLowerCase() === currentTech.name.toLowerCase())) {
    currentTech = filteredTechs[0] || null;
    if (currentTech) _selectedTechName = currentTech.name;
  }

  // Renderizar filas de tecnologías en la lista izquierda
  if (filteredTechs.length === 0) {
    listContainer.innerHTML = `
      <div class="p-8 text-center text-gray-400 text-xs">
        No se encontraron tecnologías que coincidan.
      </div>
    `;
  } else {
    listContainer.innerHTML = filteredTechs.map(t => {
      const isSelected = currentTech && currentTech.name.toLowerCase() === t.name.toLowerCase();
      const planCount = _items.filter(it => (it.tech_name || it.producto_nombre || '').toLowerCase() === t.name.toLowerCase()).length;
      const avatar = t.image_url
        ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200 p-1 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain" alt=""></div>`
        : `<span class="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 shadow-sm">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;

      return `
        <div class="tech-item-row p-3 flex items-center gap-3 cursor-pointer transition-colors ${
          isSelected ? 'bg-primary-50/80 border-l-4 border-primary-600' : 'hover:bg-gray-50'
        }" data-tech-name="${esc(t.name)}">
          ${avatar}
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <span class="text-sm font-semibold text-gray-900 truncate">${esc(t.name)}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                t.category === 'tool' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }">
                ${t.category === 'tool' ? 'Herramienta' : 'Lenguaje'}
              </span>
            </div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-[11px] ${planCount > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-400'}">
                ${planCount > 0 ? `✓ ${planCount} plan${planCount === 1 ? '' : 'es'} técnico${planCount === 1 ? '' : 's'}` : 'Sin ficha técnica'}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Listener para selección de tecnología
    listContainer.querySelectorAll('.tech-item-row').forEach(row => {
      row.addEventListener('click', () => {
        _selectedTechName = row.dataset.techName;
        _selectedPlanId = null;
        updateView();
      });
    });
  }

  // Renderizar detalle de la tecnología en la columna derecha
  if (!currentTech) {
    detailMount.innerHTML = `
      <div class="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
        <span class="text-4xl block mb-2">🔍</span>
        <p class="text-sm font-medium text-gray-600">No hay tecnologías seleccionadas</p>
      </div>
    `;
    return;
  }

  const techPlans = _items.filter(it => (it.tech_name || it.producto_nombre || '').toLowerCase() === currentTech.name.toLowerCase());
  let activePlan = null;
  if (techPlans.length > 0) {
    activePlan = techPlans.find(p => p.id === _selectedPlanId) || techPlans[0];
    _selectedPlanId = activePlan.id;
  } else {
    _selectedPlanId = null;
  }

  detailMount.innerHTML = renderTechDetail(currentTech, techPlans, activePlan);
  wireDetailEvents(currentTech, activePlan);
}

function renderTechDetail(tech, plans, activePlan) {
  const avatar = tech.image_url
    ? `<div class="w-12 h-12 rounded-xl bg-white border border-gray-200 p-2 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(tech.image_url, 128))}" class="max-w-full max-h-full object-contain" alt=""></div>`
    : `<span class="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-base font-bold text-indigo-700 shrink-0 shadow-sm">${esc((tech.name || '?').charAt(0).toUpperCase())}</span>`;

  return `
    <!-- Tarjeta Superior: Info de Tecnología y Selector de Planes -->
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div class="flex items-center gap-3">
          ${avatar}
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-bold text-gray-900">${esc(tech.name)}</h2>
              <span class="text-xs px-2 py-0.5 rounded-full font-bold uppercase ${
                tech.category === 'tool' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }">
                ${tech.category === 'tool' ? 'Herramienta' : 'Lenguaje'}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">Especificación técnica oficial y parámetros para propuestas y desarrollo.</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button type="button" id="btn-add-plan-for-tech" class="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5" data-tech-id="${esc(tech.id || '')}" data-tech-name="${esc(tech.name)}" data-tech-category="${esc(tech.category)}">
            ${icon('add', 14)} Agregar Plan
          </button>
        </div>
      </div>

      <!-- Selector de Planes (Tabs horizontales) -->
      <div class="pt-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-gray-600 uppercase tracking-wide">Planes Técnicos Registrados:</span>
        </div>

        ${plans.length === 0 ? `
          <div class="bg-gray-50 rounded-lg p-6 text-center border border-dashed border-gray-200">
            <p class="text-xs text-gray-500 mb-2">Esta tecnología aún no tiene planes técnicos registrados en el sistema.</p>
            <button type="button" id="btn-create-first-plan" class="btn-primary text-xs py-1 px-3" data-tech-id="${esc(tech.id || '')}" data-tech-name="${esc(tech.name)}" data-tech-category="${esc(tech.category)}">
              + Crear Primer Plan Técnico
            </button>
          </div>
        ` : `
          <div class="flex items-center gap-2 overflow-x-auto pb-1">
            ${plans.map(p => {
              const isActive = activePlan && activePlan.id === p.id;
              return `
                <button type="button" class="plan-tab-btn px-3.5 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 shrink-0 ${
                  isActive 
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }" data-plan-id="${esc(p.id)}">
                  <span>${esc(p.plan_nombre)}</span>
                  ${p.precio ? `<span class="text-[10px] opacity-80 font-normal">(${esc(p.precio)})</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Si hay un plan activo, renderizar la ficha técnica completa -->
    ${activePlan ? renderActivePlanCard(activePlan, tech) : ''}
  `;
}

function renderActivePlanCard(plan, tech) {
  const customFields = Array.isArray(plan.campos_extra) ? plan.campos_extra : [];

  return `
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      
      <!-- Barra de Acciones del Plan -->
      <div class="bg-gradient-to-r from-gray-50 to-white px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-gray-500 uppercase">Ficha del Plan:</span>
          <span class="text-sm font-bold text-gray-900">${esc(plan.plan_nombre)}</span>
          ${plan.precio ? `
            <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs px-2.5 py-0.5 rounded-full">
              ${esc(plan.precio)}
            </span>
          ` : ''}
        </div>

        <div class="flex items-center gap-2">
          <button type="button" class="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 btn-copy-plan" data-plan-id="${esc(plan.id)}" title="Copiar resumen técnico">
            ${icon('content_copy', 14)} Copiar Ficha
          </button>
          <button type="button" class="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1.5 btn-edit-plan" data-plan-id="${esc(plan.id)}">
            ${icon('edit', 14)} Editar
          </button>
          <button type="button" class="btn-danger text-xs px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 btn-delete-plan" data-plan-id="${esc(plan.id)}" data-plan-name="${esc(plan.plan_nombre)}">
            ${icon('delete', 14)}
          </button>
        </div>
      </div>

      <!-- Contenido de los 19 Campos Técnicos -->
      <div class="p-6 space-y-6">

        <!-- 1. Precios y Cuotas -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/60 p-4 rounded-xl border border-gray-100">
          <div>
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Precio Referencial</span>
            <p class="text-sm font-bold text-gray-900">${esc(plan.precio || 'Sin especificar')}</p>
          </div>
          <div>
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cuota Mensual</span>
            <p class="text-sm text-gray-800">${esc(plan.cuota_mensual || 'Sin especificar')}</p>
          </div>
          <div>
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Ejemplo de Consumo Mensual</span>
            <p class="text-sm text-gray-800">${esc(plan.ejemplo_consumo_mensual || 'Sin especificar')}</p>
          </div>
        </div>

        <!-- 2. Descripción General y Agregados -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl border border-gray-100 bg-white">
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Descripción del Plan</span>
            <p class="text-xs text-gray-700 leading-relaxed">${esc(plan.descripcion || 'Sin descripción')}</p>
          </div>
          <div class="p-4 rounded-xl border border-gray-100 bg-white">
            <span class="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">✨ Agregados & Beneficios</span>
            <p class="text-xs text-gray-700 leading-relaxed">${esc(plan.agregados || 'Sin agregados registrados')}</p>
          </div>
        </div>

        <!-- 3. Límites Técnicos, Archivos y API -->
        <div class="border border-gray-100 rounded-xl p-4 bg-white">
          <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            ${icon('tune', 16)} Límites Técnicos y Capacidades
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-gray-50/70 p-3 rounded-lg">
              <span class="text-[11px] font-semibold text-gray-500 block mb-0.5">Límites Técnicos</span>
              <p class="text-xs text-gray-800">${esc(plan.limites_tecnicos || 'Sin límite especificado')}</p>
            </div>
            <div class="bg-gray-50/70 p-3 rounded-lg">
              <span class="text-[11px] font-semibold text-gray-500 block mb-0.5">Límites de Archivos</span>
              <p class="text-xs text-gray-800">${esc(plan.limites_archivos || 'Sin límite especificado')}</p>
            </div>
            <div class="bg-gray-50/70 p-3 rounded-lg">
              <span class="text-[11px] font-semibold text-gray-500 block mb-0.5">Límites de API</span>
              <p class="text-xs text-gray-800">${esc(plan.limites_api || 'Sin límite especificado')}</p>
            </div>
          </div>
        </div>

        <!-- 4. Reglas Críticas (Qué pasa si te pasas, Cuándo subir, Qué no incluye) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <h4 class="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              ⚠️ ¿Qué pasa si te pasas del límite?
            </h4>
            <p class="text-xs text-amber-950 leading-relaxed">
              ${esc(plan.pasa_si_te_pasas_del_limite || 'No hay política de sobreuso definida.')}
            </p>
          </div>

          <div class="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4">
            <h4 class="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              🚀 ¿Cuándo subir de plan?
            </h4>
            <p class="text-xs text-indigo-950 leading-relaxed">
              ${esc(plan.cuando_subir || 'No se han definido disparadores de escalamiento.')}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-rose-50/60 border border-rose-200/80 rounded-xl p-4">
            <h4 class="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              🚫 Qué NO Incluye
            </h4>
            <p class="text-xs text-rose-950 leading-relaxed">
              ${esc(plan.que_no_incluye || 'No se registraron exclusiones explícitas.')}
            </p>
          </div>

          <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 class="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              ❌ Lo que el plan NO resuelve
            </h4>
            <p class="text-xs text-gray-700 leading-relaxed">
              ${esc(plan.plan_no_resuelve || 'Sin restricciones de alcance documentadas.')}
            </p>
          </div>
        </div>

        <!-- 5. Infraestructura, Usuarios, Seguridad, Media & Soporte -->
        <div class="border border-gray-100 rounded-xl p-4 bg-white">
          <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
            Infraestructura, Multimedia & Soporte
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div class="p-2.5 bg-gray-50/60 rounded-lg">
              <span class="text-[10.5px] font-semibold text-gray-500 block">Cuentas y Usuarios</span>
              <p class="text-xs text-gray-800 mt-0.5">${esc(plan.cuentas_usuarios || '—')}</p>
            </div>
            <div class="p-2.5 bg-gray-50/60 rounded-lg">
              <span class="text-[10.5px] font-semibold text-gray-500 block">Seguridad y Control de Acceso</span>
              <p class="text-xs text-gray-800 mt-0.5">${esc(plan.seguridad_control_acceso || '—')}</p>
            </div>
            <div class="p-2.5 bg-gray-50/60 rounded-lg">
              <span class="text-[10.5px] font-semibold text-gray-500 block">Entrega y Dominio</span>
              <p class="text-xs text-gray-800 mt-0.5">${esc(plan.entrega_dominio || '—')}</p>
            </div>
            <div class="p-2.5 bg-gray-50/60 rounded-lg">
              <span class="text-[10.5px] font-semibold text-gray-500 block">Respaldo y Almacenamiento</span>
              <p class="text-xs text-gray-800 mt-0.5">${esc(plan.respaldo_almacenamiento || '—')}</p>
            </div>
            <div class="p-2.5 bg-gray-50/60 rounded-lg">
              <span class="text-[10.5px] font-semibold text-gray-500 block">Complementos IA</span>
              <p class="text-xs text-gray-800 mt-0.5">${esc(plan.complementos_ia || '—')}</p>
            </div>
            <div class="p-2.5 bg-gray-50/60 rounded-lg">
              <span class="text-[10.5px] font-semibold text-gray-500 block">Video & Streaming</span>
              <p class="text-xs text-gray-800 mt-0.5">${esc(plan.video || '—')}</p>
            </div>
          </div>
          <div class="mt-3 p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100/60">
            <span class="text-[10.5px] font-bold text-indigo-900 block">🎧 Nivel de Soporte Técnico</span>
            <p class="text-xs text-indigo-950 mt-0.5">${esc(plan.soporte || 'Soporte estándar')}</p>
          </div>
        </div>

        <!-- 6. Campos Dinámicos Personalizados -->
        ${customFields.length > 0 ? `
          <div class="border border-purple-100 rounded-xl p-4 bg-purple-50/30">
            <h4 class="text-xs font-bold text-purple-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              ⚡ Campos Personalizados Dinámicos (${customFields.length})
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${customFields.map(f => `
                <div class="p-3 bg-white rounded-lg border border-purple-100 shadow-2xs">
                  <span class="text-[11px] font-bold text-purple-800 block">${esc(f.titulo || 'Campo')}</span>
                  <p class="text-xs text-gray-700 mt-1 leading-relaxed">${esc(f.valor || '')}</p>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

function wireDetailEvents(tech, activePlan) {
  // Tabs de planes dentro de la tecnología seleccionada
  document.querySelectorAll('.plan-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedPlanId = btn.dataset.planId;
      updateView();
    });
  });

  // Botón Agregar Plan para la tecnología actual
  document.getElementById('btn-add-plan-for-tech')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    openPlanModal(null, btn.dataset.techName, btn.dataset.techCategory, btn.dataset.techId);
  });
  document.getElementById('btn-create-first-plan')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    openPlanModal(null, btn.dataset.techName, btn.dataset.techCategory, btn.dataset.techId);
  });

  // Acciones en la ficha activa
  document.querySelectorAll('.btn-edit-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = _items.find(p => p.id === btn.dataset.planId);
      if (plan) openPlanModal(plan);
    });
  });

  document.querySelectorAll('.btn-delete-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      deletePlan(btn.dataset.planId, btn.dataset.planName);
    });
  });

  document.querySelectorAll('.btn-copy-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = _items.find(p => p.id === btn.dataset.planId);
      if (plan) copyPlanToClipboard(plan);
    });
  });
}

function copyPlanToClipboard(p) {
  const custom = (p.campos_extra || []).map(f => `• ${f.titulo}: ${f.valor}`).join('\n');
  const text = `
📋 FICHA TÉCNICA — ${p.tech_name || p.producto_nombre || ''} [${p.plan_nombre}]
--------------------------------------------------
💰 Precio: ${p.precio || 'N/A'}
📊 Cuota Mensual: ${p.cuota_mensual || 'N/A'}
📝 Descripción: ${p.descripcion || 'N/A'}
✨ Agregados: ${p.agregados || 'N/A'}
⚙️ Límites Técnicos: ${p.limites_tecnicos || 'N/A'}
📁 Límites Archivos: ${p.limites_archivos || 'N/A'}
🔌 Límites API: ${p.limites_api || 'N/A'}
👥 Cuentas/Usuarios: ${p.cuentas_usuarios || 'N/A'}
⚠️ ¿Qué pasa si te pasas?: ${p.pasa_si_te_pasas_del_limite || 'N/A'}
🚀 ¿Cuándo subir?: ${p.cuando_subir || 'N/A'}
🚫 Qué no incluye: ${p.que_no_incluye || 'N/A'}
❌ Lo que no resuelve: ${p.plan_no_resuelve || 'N/A'}
🔒 Seguridad: ${p.seguridad_control_acceso || 'N/A'}
🌐 Dominio/Entrega: ${p.entrega_dominio || 'N/A'}
💾 Respaldo: ${p.respaldo_almacenamiento || 'N/A'}
🤖 IA: ${p.complementos_ia || 'N/A'}
🎥 Video: ${p.video || 'N/A'}
🎧 Soporte: ${p.soporte || 'N/A'}
${custom ? `\nCampos Dinámicos:\n${custom}` : ''}
--------------------------------------------------
Qubira Tech Hub
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    toast('Ficha técnica copiada al portapapeles', 'success');
  }).catch(() => {
    toast('No se pudo copiar automáticamente', 'error');
  });
}

async function deletePlan(id, planNombre) {
  if (!confirm(`¿Estás seguro de eliminar el plan "${planNombre}"? Esta acción no se puede deshacer.`)) {
    return;
  }
  try {
    await api.delete(`/tech-plan-info/${id}`);
    toast('Plan técnico eliminado correctamente', 'success');
    _items = _items.filter(it => it.id !== id);
    _selectedPlanId = null;
    updateView();
  } catch(e) {
    toast('Error al eliminar: ' + (e.message || 'Error de servidor'), 'error');
  }
}

/* ============================================================
   MODAL DE CREACIÓN / EDICIÓN (5 Pestañas + Gestor Dinámico)
   ============================================================ */
function openPlanModal(plan = null, defaultTechName = '', defaultCategory = 'tool', defaultTechId = '') {
  const isEdit = !!plan;
  _currentTabInModal = 'basic';
  _modalCustomFields = isEdit && Array.isArray(plan.campos_extra)
    ? JSON.parse(JSON.stringify(plan.campos_extra))
    : [];

  const initialTechName = plan ? (plan.tech_name || plan.producto_nombre || '') : defaultTechName;
  const initialCategory = plan ? (plan.category || 'tool') : defaultCategory;
  const initialTechId = plan ? (plan.tech_id || '') : defaultTechId;

  showModal(isEdit ? `Editar Ficha Técnica — ${plan.plan_nombre}` : 'Nuevo Plan Técnico', `
    <form id="tech-plan-form" class="space-y-4">
      
      <!-- Selector de Pestañas del Modal -->
      <div class="flex items-center gap-1 border-b border-gray-200 pb-2 overflow-x-auto text-xs font-bold">
        <button type="button" class="modal-tab-btn px-3 py-1.5 rounded-lg border border-transparent transition-all active text-primary-600 bg-primary-50" data-tab="basic">
          1. General
        </button>
        <button type="button" class="modal-tab-btn px-3 py-1.5 rounded-lg border border-transparent text-gray-500 hover:text-gray-800 transition-all" data-tab="limits">
          2. Límites & Cuotas
        </button>
        <button type="button" class="modal-tab-btn px-3 py-1.5 rounded-lg border border-transparent text-gray-500 hover:text-gray-800 transition-all" data-tab="rules">
          3. Reglas & Escala
        </button>
        <button type="button" class="modal-tab-btn px-3 py-1.5 rounded-lg border border-transparent text-gray-500 hover:text-gray-800 transition-all" data-tab="infra">
          4. Infra & Media
        </button>
        <button type="button" class="modal-tab-btn px-3 py-1.5 rounded-lg border border-transparent text-gray-500 hover:text-gray-800 transition-all" data-tab="custom">
          5. Campos Extra
        </button>
      </div>

      <!-- PESTAÑA 1: BÁSICO & PRECIOS -->
      <div id="tab-pane-basic" class="modal-tab-pane space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Herramienta / Lenguaje *</label>
            <input type="text" list="tech-names-list" id="mp-tech-name" required value="${esc(initialTechName)}" placeholder="Ej: AWS, NEON, Docker, React, Python..." class="input text-xs w-full">
            <datalist id="tech-names-list">
              ${_allTechs.map(t => `<option value="${esc(t.name)}">${esc(t.category === 'tool' ? '🛠️ Herramienta' : '💻 Lenguaje')}</option>`).join('')}
            </datalist>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Categoría</label>
            <select id="mp-category" class="input text-xs w-full">
              <option value="tool" ${initialCategory === 'tool' ? 'selected' : ''}>🛠️ Herramienta</option>
              <option value="language" ${initialCategory === 'language' ? 'selected' : ''}>💻 Lenguaje</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Nombre del Plan *</label>
            <input type="text" id="mp-plan-nombre" required value="${esc(plan?.plan_nombre || '')}" placeholder="Ej: Free Tier, Launch Plan, Team, Pro..." class="input text-xs w-full">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Precio Referencial</label>
            <input type="text" id="mp-precio" value="${esc(plan?.precio || '')}" placeholder="Ej: $ 19.00 / mes o S/ 70.00 / mes" class="input text-xs w-full">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Descripción del Plan</label>
          <textarea id="mp-descripcion" rows="2" class="input text-xs w-full" placeholder="Objetivo y resumen de uso de esta herramienta o plan...">${esc(plan?.descripcion || '')}</textarea>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Agregados & Beneficios</label>
          <textarea id="mp-agregados" rows="2" class="input text-xs w-full" placeholder="Beneficios incluidos, plugins, módulos o bonos especiales...">${esc(plan?.agregados || '')}</textarea>
        </div>
      </div>

      <!-- PESTAÑA 2: LÍMITES Y CUOTAS -->
      <div id="tab-pane-limits" class="modal-tab-pane space-y-3 hidden">
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Límites Técnicos</label>
          <textarea id="mp-limites-tecnicos" rows="2" class="input text-xs w-full" placeholder="Capacidades de cómputo, vCPU, RAM, suspensión, concurrencia...">${esc(plan?.limites_tecnicos || '')}</textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Cuota Mensual</label>
            <input type="text" id="mp-cuota-mensual" value="${esc(plan?.cuota_mensual || '')}" placeholder="Ej: 100,000 reqs/mes, 10 GB ancho de banda..." class="input text-xs w-full">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Ejemplo de Consumo Mensual</label>
            <input type="text" id="mp-ejemplo-consumo" value="${esc(plan?.ejemplo_consumo_mensual || '')}" placeholder="Ej: 5,000 visitas/mes, 100 consultas/día..." class="input text-xs w-full">
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Límites de Archivos</label>
            <input type="text" id="mp-limites-archivos" value="${esc(plan?.limites_archivos || '')}" placeholder="Ej: 10 MB por imagen, 500 MB total..." class="input text-xs w-full">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Límites de API</label>
            <input type="text" id="mp-limites-api" value="${esc(plan?.limites_api || '')}" placeholder="Ej: 60 peticiones/min, 2 webhooks..." class="input text-xs w-full">
          </div>
        </div>
      </div>

      <!-- PESTAÑA 3: REGLAS Y ESCALAMIENTO -->
      <div id="tab-pane-rules" class="modal-tab-pane space-y-3 hidden">
        <div>
          <label class="block text-xs font-bold text-amber-800 mb-1">⚠️ ¿Qué pasa si te pasas del límite?</label>
          <textarea id="mp-pasa-si-te-pasas" rows="2" class="input text-xs w-full border-amber-200 bg-amber-50/30" placeholder="¿Cobro extra, bloqueo temporal, soft-limit, degradación?">${esc(plan?.pasa_si_te_pasas_del_limite || '')}</textarea>
        </div>
        <div>
          <label class="block text-xs font-bold text-indigo-800 mb-1">🚀 ¿Cuándo subir de plan?</label>
          <textarea id="mp-cuando-subir" rows="2" class="input text-xs w-full border-indigo-200 bg-indigo-50/30" placeholder="Criterios y señales claras para escalar a un plan superior...">${esc(plan?.cuando_subir || '')}</textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-rose-800 mb-1">🚫 Qué NO incluye</label>
            <textarea id="mp-que-no-incluye" rows="2" class="input text-xs w-full border-rose-200 bg-rose-50/30" placeholder="Exclusiones clave del servicio...">${esc(plan?.que_no_incluye || '')}</textarea>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">❌ Lo que el plan NO resuelve</label>
            <textarea id="mp-plan-no-resuelve" rows="2" class="input text-xs w-full" placeholder="Límites de responsabilidad técnica o funcional...">${esc(plan?.plan_no_resuelve || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 4: INFRAESTRUCTURA & MEDIA -->
      <div id="tab-pane-infra" class="modal-tab-pane space-y-3 hidden">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Cuentas y Usuarios</label>
            <input type="text" id="mp-cuentas-usuarios" value="${esc(plan?.cuentas_usuarios || '')}" placeholder="Ej: 3 usuarios administradores, 10 colaboradores..." class="input text-xs w-full">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Seguridad y Control de Acceso</label>
            <input type="text" id="mp-seguridad" value="${esc(plan?.seguridad_control_acceso || '')}" placeholder="Ej: 2FA obligatorio, SSL TLS 1.3, RBAC, IP Allowlist..." class="input text-xs w-full">
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Entrega y Dominio</label>
            <input type="text" id="mp-entrega-dominio" value="${esc(plan?.entrega_dominio || '')}" placeholder="Ej: Subdominio cloud o CNAME personalizado..." class="input text-xs w-full">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Respaldo y Almacenamiento</label>
            <input type="text" id="mp-respaldo" value="${esc(plan?.respaldo_almacenamiento || '')}" placeholder="Ej: Copias automáticas diarias con 7 días retención..." class="input text-xs w-full">
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Complementos IA</label>
            <input type="text" id="mp-complementos-ia" value="${esc(plan?.complementos_ia || '')}" placeholder="Ej: pgvector, 10,000 tokens/mes, OpenAI GPT-4o..." class="input text-xs w-full">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Video & Multimedia</label>
            <input type="text" id="mp-video" value="${esc(plan?.video || '')}" placeholder="Ej: HLS streaming, max 100 MB por video..." class="input text-xs w-full">
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Soporte Técnico</label>
          <input type="text" id="mp-soporte" value="${esc(plan?.soporte || '')}" placeholder="Ej: Email y tickets SLA 4h hábiles, o soporte comunitario..." class="input text-xs w-full">
        </div>
      </div>

      <!-- PESTAÑA 5: CAMPOS PERSONALIZADOS DINÁMICOS -->
      <div id="tab-pane-custom" class="modal-tab-pane space-y-3 hidden">
        <div class="flex items-center justify-between">
          <p class="text-xs text-gray-500">
            Libertad total para agregar cualquier especificación o atributo técnico adicional a esta herramienta.
          </p>
          <button type="button" id="btn-add-modal-custom-field" class="btn-secondary text-xs px-2.5 py-1">
            + Agregar Campo Dinámico
          </button>
        </div>

        <div id="modal-custom-fields-container" class="space-y-2 max-h-60 overflow-y-auto pt-1">
          <!-- Renderizado dinámico -->
        </div>
      </div>

      <!-- Footer Modal -->
      <div class="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
        <button type="button" id="btn-modal-cancel" class="btn-secondary text-xs">Cancelar</button>
        <button type="submit" id="btn-modal-save" class="btn-primary text-xs flex items-center gap-1.5">
          ${icon('save', 14)} ${isEdit ? 'Guardar Cambios' : 'Crear Plan'}
        </button>
      </div>
    </form>
  `, '2xl');

  wireModalTabs();
  renderModalCustomFields();

  // Autocompletar categoría si el usuario escribe o selecciona una tecnología conocida
  document.getElementById('mp-tech-name')?.addEventListener('change', (e) => {
    const val = (e.target.value || '').trim().toLowerCase();
    const found = _allTechs.find(t => t.name.toLowerCase() === val);
    if (found && found.category) {
      document.getElementById('mp-category').value = found.category;
    }
  });

  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);

  document.getElementById('tech-plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-modal-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `${spinner(14)} Guardando...`;

    const techName = document.getElementById('mp-tech-name').value.trim();
    const planNombre = document.getElementById('mp-plan-nombre').value.trim();
    const category = document.getElementById('mp-category').value;

    const matchedTech = _allTechs.find(t => t.name.toLowerCase() === techName.toLowerCase());

    const payload = {
      tech_id: matchedTech ? matchedTech.id : (initialTechId || null),
      tech_name: techName,
      producto_nombre: techName,
      category: category,
      plan_nombre: planNombre,
      precio: document.getElementById('mp-precio').value.trim(),
      descripcion: document.getElementById('mp-descripcion').value.trim(),
      agregados: document.getElementById('mp-agregados').value.trim(),
      limites_tecnicos: document.getElementById('mp-limites-tecnicos').value.trim(),
      cuota_mensual: document.getElementById('mp-cuota-mensual').value.trim(),
      ejemplo_consumo_mensual: document.getElementById('mp-ejemplo-consumo').value.trim(),
      limites_archivos: document.getElementById('mp-limites-archivos').value.trim(),
      limites_api: document.getElementById('mp-limites-api').value.trim(),
      pasa_si_te_pasas_del_limite: document.getElementById('mp-pasa-si-te-pasas').value.trim(),
      cuando_subir: document.getElementById('mp-cuando-subir').value.trim(),
      que_no_incluye: document.getElementById('mp-que-no-incluye').value.trim(),
      plan_no_resuelve: document.getElementById('mp-plan-no-resuelve').value.trim(),
      cuentas_usuarios: document.getElementById('mp-cuentas-usuarios').value.trim(),
      seguridad_control_acceso: document.getElementById('mp-seguridad').value.trim(),
      entrega_dominio: document.getElementById('mp-entrega-dominio').value.trim(),
      respaldo_almacenamiento: document.getElementById('mp-respaldo').value.trim(),
      complementos_ia: document.getElementById('mp-complementos-ia').value.trim(),
      video: document.getElementById('mp-video').value.trim(),
      soporte: document.getElementById('mp-soporte').value.trim(),
      campos_extra: _modalCustomFields.filter(f => f.titulo && f.titulo.trim())
    };

    try {
      if (isEdit) {
        const updated = await api.put(`/tech-plan-info/${plan.id}`, payload);
        toast('Ficha técnica actualizada con éxito', 'success');
        const idx = _items.findIndex(it => it.id === plan.id);
        if (idx !== -1) _items[idx] = updated;
        _selectedPlanId = updated.id;
      } else {
        const created = await api.post('/tech-plan-info', payload);
        toast('Nuevo plan técnico creado con éxito', 'success');
        _items.push(created);
        _selectedPlanId = created.id;
      }
      _selectedTechName = techName;
      closeModal();
      updateView();
    } catch(err) {
      toast('Error al guardar: ' + (err.message || 'Error de servidor'), 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${icon('save', 14)} Guardar`;
    }
  });
}

function wireModalTabs() {
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      _currentTabInModal = tab;
      document.querySelectorAll('.modal-tab-btn').forEach(b => {
        b.classList.remove('active', 'text-primary-600', 'bg-primary-50');
        b.classList.add('text-gray-500');
      });
      btn.classList.add('active', 'text-primary-600', 'bg-primary-50');
      btn.classList.remove('text-gray-500');

      document.querySelectorAll('.modal-tab-pane').forEach(p => p.classList.add('hidden'));
      document.getElementById(`tab-pane-${tab}`)?.classList.remove('hidden');
    });
  });

  document.getElementById('btn-add-modal-custom-field')?.addEventListener('click', () => {
    _modalCustomFields.push({ id: 'fld_' + Date.now(), titulo: '', valor: '' });
    renderModalCustomFields();
  });
}

function renderModalCustomFields() {
  const container = document.getElementById('modal-custom-fields-container');
  if (!container) return;

  if (_modalCustomFields.length === 0) {
    container.innerHTML = `
      <p class="text-xs text-gray-400 py-4 text-center">No hay campos dinámicos adicionales creados.</p>
    `;
    return;
  }

  container.innerHTML = _modalCustomFields.map((f, idx) => `
    <div class="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
      <input type="text" class="input text-xs w-1/3 modal-cf-title" data-idx="${idx}" placeholder="Nombre del campo (ej: Versión, RAM...)" value="${esc(f.titulo)}">
      <input type="text" class="input text-xs flex-1 modal-cf-value" data-idx="${idx}" placeholder="Valor o especificación..." value="${esc(f.valor)}">
      <button type="button" class="btn-danger p-1 text-gray-400 hover:text-rose-600 modal-cf-del" data-idx="${idx}" title="Eliminar campo">
        ${icon('delete', 16)}
      </button>
    </div>
  `).join('');

  container.querySelectorAll('.modal-cf-title').forEach(inp => {
    inp.addEventListener('input', e => {
      _modalCustomFields[e.target.dataset.idx].titulo = e.target.value;
    });
  });

  container.querySelectorAll('.modal-cf-value').forEach(inp => {
    inp.addEventListener('input', e => {
      _modalCustomFields[e.target.dataset.idx].valor = e.target.value;
    });
  });

  container.querySelectorAll('.modal-cf-del').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = Number(btn.dataset.idx);
      _modalCustomFields.splice(idx, 1);
      renderModalCustomFields();
    });
  });
}
