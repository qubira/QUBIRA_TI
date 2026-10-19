import { api } from '../api.js';
import { toast, showModal, closeModal, spinner, icon } from '../utils.js';

// PERMISOS DE COSTOS: OTI (TI) tiene estrictamente PROHIBIDO ver o editar costos/precios.
// Solo ADG, OPP y ODN tienen acceso a información económica.
const CAN_VIEW_COSTS = false;
const CAN_EDIT_COSTS = false;

let _items = []; // Fichas técnicas registradas (ti.tech_plan_info)
let _catalog = { language: [], tool: [] }; // Catálogo completo (ti.technology_catalog)
let _allTechs = []; // Array unificado de tecnologías
let _selectedCategory = 'all'; // 'all' | 'tool' | 'language'
let _selectedTechName = null; // Nombre de tecnología seleccionada actualmente
let _selectedPlanId = null; // ID del plan seleccionado actualmente
let _selectedPlanName = null; // Nombre del plan seleccionado actualmente
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

const CURRENCY_SYMBOLS = {
  PEN: 'S/',
  USD: '$',
  EUR: '€',
};

function getCurSym(moneda) {
  return CURRENCY_SYMBOLS[moneda] || (moneda === 'USD' ? '$' : 'S/');
}

/**
 * Renderizador de texto enriquecido:
 * 1. Mantiene el formato copiado (saltos de línea, párrafos, viñetas •, -, * y numeraciones).
 * 2. Renderiza tablas completas insertadas o copiadas (formato markdown | col | col | o tabulaciones de Excel/Word).
 * 3. Permite resaltar en rojo palabras u oraciones con [rojo]texto[/rojo], [red]texto[/red], <red>texto</red> o ==texto==.
 */
function renderRichContent(rawStr) {
  if (!rawStr || !String(rawStr).trim()) return '<span class="text-gray-400 italic">Sin registrar</span>';
  
  const text = String(rawStr).trim();

  // Helper para formatear elementos inline: negrita, código y resaltado en rojo
  function formatInline(str) {
    if (!str) return '';
    let s = esc(str);

    // Resaltado en rojo: [rojo]...[/rojo], [red]...[/red], &lt;red&gt;...&lt;/red&gt;, {rojo:...}, ==...==
    s = s.replace(/\[(?:rojo|red)\]([\s\S]*?)\[\/(?:rojo|red)\]/gi, (match, p1) => {
      return `<span class="text-rose-600 font-bold bg-rose-50/90 px-1.5 py-0.5 rounded border border-rose-200/80 inline-block">${p1}</span>`;
    });
    s = s.replace(/&lt;(?:red|rojo)&gt;([\s\S]*?)&lt;\/(?:red|rojo)&gt;/gi, (match, p1) => {
      return `<span class="text-rose-600 font-bold bg-rose-50/90 px-1.5 py-0.5 rounded border border-rose-200/80 inline-block">${p1}</span>`;
    });
    s = s.replace(/\{(?:rojo|red):([\s\S]*?)\}/gi, (match, p1) => {
      return `<span class="text-rose-600 font-bold bg-rose-50/90 px-1.5 py-0.5 rounded border border-rose-200/80 inline-block">${p1}</span>`;
    });
    s = s.replace(/==([\s\S]*?)==/g, (match, p1) => {
      return `<span class="text-rose-600 font-bold bg-rose-50/90 px-1.5 py-0.5 rounded border border-rose-200/80 inline-block">${p1}</span>`;
    });

    // Negrita: **texto**
    s = s.replace(/\*\*([\s\S]*?)\*\*/g, '<strong>$1</strong>');

    // Código en línea: `codigo`
    s = s.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-indigo-700 font-mono text-[11px] px-1.5 py-0.5 rounded border border-gray-200">$1</code>');

    return s;
  }

  const lines = text.split(/\r?\n/);
  const outputBlocks = [];
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listItems = [];

  function flushList() {
    if (inList && listItems.length > 0) {
      outputBlocks.push(`
        <ul class="space-y-1.5 my-2 pl-1">
          ${listItems.map(item => `
            <li class="flex items-start gap-2.5 text-xs text-gray-700 leading-relaxed">
              <span class="text-primary-600 font-bold text-sm shrink-0 select-none leading-4 mt-0.5">•</span>
              <div class="flex-1">${formatInline(item)}</div>
            </li>
          `).join('')}
        </ul>
      `);
      listItems = [];
      inList = false;
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      // Filtrar filas de separación de markdown tipo |---|---|
      const cleanRows = tableRows.filter(r => !/^\s*\|?\s*:?-+:?\s*(\|:?-+:?\s*)+\|?\s*$/.test(r));
      if (cleanRows.length > 0) {
        const parsedRows = cleanRows.map(r => {
          let cells = [];
          if (r.includes('\t')) {
            cells = r.split('\t').map(c => c.trim());
          } else {
            let rowStr = r.trim();
            if (rowStr.startsWith('|')) rowStr = rowStr.slice(1);
            if (rowStr.endsWith('|')) rowStr = rowStr.slice(0, -1);
            cells = rowStr.split('|').map(c => c.trim());
          }
          return cells;
        });

        const headerCells = parsedRows[0] || [];
        const bodyRows = parsedRows.slice(1);

        outputBlocks.push(`
          <div class="overflow-x-auto my-3 rounded-xl border border-gray-200 shadow-2xs bg-white">
            <table class="w-full text-xs text-left border-collapse">
              <thead>
                <tr class="bg-gray-50/90 border-b border-gray-200 text-gray-800 font-bold">
                  ${headerCells.map(c => `<th class="px-4 py-2.5 bg-gray-50/90">${formatInline(c)}</th>`).join('')}
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${bodyRows.map(row => `
                  <tr class="hover:bg-gray-50/60 transition-colors">
                    ${row.map((cell, cIdx) => `
                      <td class="px-4 py-2.5 ${cIdx === 0 ? 'font-semibold text-gray-900 bg-gray-50/30' : 'text-gray-700'}">
                        ${formatInline(cell)}
                      </td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `);
      }
      tableRows = [];
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Detección de filas de tabla: Formato markdown con pipes '|' o delimitadas con tabuladores '\t'
    const isMarkdownTable = line.startsWith('|') && line.endsWith('|') && line.includes('|');
    const isTabTable = rawLine.includes('\t') && (rawLine.split('\t').length >= 2);

    if (isMarkdownTable || isTabTable) {
      flushList();
      inTable = true;
      tableRows.push(rawLine);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Detección de listas con viñetas o números
    const bulletMatch = line.match(/^([•\-\*]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      inList = true;
      listItems.push(bulletMatch[2]);
      continue;
    } else if (inList) {
      flushList();
    }

    // Líneas vacías
    if (!line) {
      continue;
    }

    // Párrafo de texto regular con preservación de saltos
    outputBlocks.push(`
      <p class="text-xs text-gray-700 leading-relaxed mb-2.5 last:mb-0">
        ${formatInline(line)}
      </p>
    `);
  }

  flushList();
  flushTable();

  return outputBlocks.join('');
}

/**
 * Barra de herramientas compacta para campos de texto y textareas en el modal
 */
function richTextToolbarHtml(targetTextareaId) {
  return `
    <div class="flex items-center gap-1.5 py-1">
      <button type="button" class="btn-rt-table text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-semibold flex items-center gap-1 transition-colors" data-target="${targetTextareaId}" title="Insertar estructura de tabla">
        📊 Tabla
      </button>
      <button type="button" class="btn-rt-red text-[11px] px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold flex items-center gap-1 transition-colors" data-target="${targetTextareaId}" title="Resaltar texto seleccionado en rojo">
        🔴 Resaltar Rojo
      </button>
      <button type="button" class="btn-rt-bullet text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-semibold flex items-center gap-1 transition-colors" data-target="${targetTextareaId}" title="Insertar viñeta">
        • Viñeta
      </button>
      <button type="button" class="btn-rt-bold text-[11px] px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-bold flex items-center gap-1 transition-colors" data-target="${targetTextareaId}" title="Texto en negrita">
        B
      </button>
    </div>
  `;
}

/**
 * Obtiene todos los planes asociados a una tecnología
 */
function getPlansForTech(tech) {
  if (!tech) return [];
  const techName = (tech.name || '').toLowerCase();
  const techId = tech.id;

  // 1. Fichas técnicas registradas en ti.tech_plan_info
  const fromInfo = _items.filter(it => {
    if (it.tech_id && techId && String(it.tech_id) === String(techId)) return true;
    const itName = (it.tech_name || it.producto_nombre || '').toLowerCase();
    return itName === techName;
  });

  // 2. Planes dados de alta en el catálogo
  const catalogPlans = Array.isArray(tech.plans) ? tech.plans : [];

  const unified = [...fromInfo];

  catalogPlans.forEach((cp, idx) => {
    const cpName = (cp.name || '').trim();
    if (!cpName) return;

    const exists = unified.some(u => (u.plan_nombre || '').trim().toLowerCase() === cpName.toLowerCase());
    if (!exists) {
      unified.push({
        id: `cat-${tech.id || 'tech'}-${idx}`,
        isVirtual: true,
        tech_id: tech.id,
        tech_name: tech.name,
        producto_nombre: tech.name,
        category: tech.category,
        plan_nombre: cpName,
        precio: '',
        costo: null,
        margen_min: null,
        margen_max: null,
        moneda: cp.moneda || 'PEN',
        periodo: cp.periodo || 'mes',
        descripcion: '',
        agregados: '',
        limites_tecnicos: '',
        cuota_mensual: '',
        ejemplo_consumo_mensual: '',
        limites_archivos: '',
        limites_api: '',
        pasa_si_te_pasas_del_limite: '',
        cuando_subir: '',
        que_no_incluye: '',
        plan_no_resuelve: '',
        cuentas_usuarios: '',
        seguridad_control_acceso: '',
        entrega_dominio: '',
        respaldo_almacenamiento: '',
        complementos_ia: '',
        video: '',
        soporte: '',
        campos_extra: []
      });
    }
  });

  return unified;
}

export function render() {
  const main = document.getElementById('main');
  main.className = 'flex-1 overflow-y-auto';
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

    const techMap = new Map();
    [..._catalog.language, ..._catalog.tool].forEach(t => {
      techMap.set((t.name || '').toLowerCase(), {
        id: t.id,
        name: t.name,
        category: t.category,
        image_url: t.image_url || '',
        costo: null,
        margen_min: null,
        margen_max: null,
        moneda: 'PEN',
        periodo: 'mes',
        plans: Array.isArray(t.plans) ? t.plans : []
      });
    });

    _items.forEach(it => {
      const key = (it.tech_name || it.producto_nombre || '').toLowerCase();
      if (key && !techMap.has(key)) {
        techMap.set(key, {
          id: it.tech_id || null,
          name: it.tech_name || it.producto_nombre,
          category: it.category || 'tool',
          image_url: it.image_url || '',
          costo: null,
          margen_min: null,
          margen_max: null,
          moneda: 'PEN',
          periodo: 'mes',
          plans: [{ name: it.plan_nombre || 'Plan Base', costo: null, margen_min: null, margen_max: null, moneda: 'PEN', periodo: 'mes' }]
        });
      }
    });

    _allTechs = Array.from(techMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    const hash = window.location.hash || '';
    if (hash.includes('tech=')) {
      const match = hash.match(/tech=([^&]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        const exists = _allTechs.find(t => t.name.toLowerCase() === decoded.toLowerCase());
        if (exists) _selectedTechName = exists.name;
      }
    }

    if (!_selectedTechName && _allTechs.length > 0) {
      const firstWithPlans = _allTechs.find(t => getPlansForTech(t).length > 0);
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

function renderPageSkeleton() {
  const c = document.getElementById('info-tecnico-page');
  if (!c) return;

  const toolCount = _allTechs.filter(t => t.category === 'tool').length;
  const langCount = _allTechs.filter(t => t.category === 'language').length;
  const totalCount = _allTechs.length;

  c.innerHTML = `
    <!-- Encabezado y Filtros Sticky (top-0 z-30 bg-gray-50) -->
    <div class="sticky top-0 z-30 bg-gray-50 pt-1 pb-3" style="position: -webkit-sticky; position: sticky; top: 0;">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-2xl">⚡</span>
            <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Info Técnico</h1>
            <span class="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-semibold border border-indigo-200">
              Catálogo de Tecnologías & Planes
            </span>
          </div>
          <p class="text-xs text-gray-500 mt-1">
            Consultas técnicas de herramientas y lenguajes de la empresa: especificaciones, cuotas, tablas y límites por plan.
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button type="button" id="btn-nuevo-plan" class="btn-primary flex items-center gap-1.5 shadow-sm text-xs py-2 px-3.5">
            ${icon('add', 18)} Nuevo Plan Técnico
          </button>
        </div>
      </div>

      <!-- Barra de Filtros, Categorías y Búsqueda -->
      <div class="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
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
    </div>

    <!-- Layout Master-Detail -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-1">
      <div class="lg:col-span-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col lg:sticky self-start" style="position: -webkit-sticky; position: sticky; top: 150px;">
        <div class="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <span class="text-xs font-bold text-gray-700 uppercase tracking-wider" id="tech-count-badge">
            Tecnologías (${totalCount})
          </span>
          <span class="text-[11px] text-gray-400">Selecciona para ver ficha</span>
        </div>
        <div class="divide-y divide-gray-100 max-h-[calc(100vh-13rem)] overflow-y-auto" id="tech-list-scroll"></div>
      </div>

      <div class="lg:col-span-8 flex flex-col gap-5 min-w-0" id="tech-detail-mount"></div>
    </div>
  `;

  const searchInput = document.getElementById('tech-search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  if (searchInput) {
    searchInput.addEventListener('input', e => {
      _searchQuery = e.target.value.toLowerCase().trim();
      if (clearBtn) clearBtn.classList.toggle('hidden', !_searchQuery);
      updateTechListOnly();
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
      updateTechListOnly();
    });
  }

  document.querySelectorAll('#category-pills-bar .category-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedCategory = btn.dataset.cat;
      document.querySelectorAll('#category-pills-bar .category-pill').forEach(b => {
        b.className = 'category-pill px-3 py-1.5 text-xs font-bold rounded-lg transition-all ' +
          (b.dataset.cat === _selectedCategory ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200');
      });
      updateTechListOnly();
    });
  });

  document.getElementById('btn-nuevo-plan')?.addEventListener('click', () => {
    openPlanModal(null, _selectedTechName || '', 'tool');
  });
}

function updateTechListOnly() {
  const listContainer = document.getElementById('tech-list-scroll');
  const countBadge = document.getElementById('tech-count-badge');
  if (!listContainer) return;

  let filtered = _allTechs.filter(t => {
    if (_selectedCategory !== 'all' && t.category !== _selectedCategory) return false;
    if (_searchQuery) {
      const matchName = (t.name || '').toLowerCase().includes(_searchQuery);
      const plans = getPlansForTech(t);
      const matchPlan = plans.some(p => 
        (p.plan_nombre || '').toLowerCase().includes(_searchQuery) ||
        (p.descripcion || '').toLowerCase().includes(_searchQuery)
      );
      if (!matchName && !matchPlan) return false;
    }
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `Tecnologías (${filtered.length})`;
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="p-8 text-center text-gray-400 text-xs">
        No se encontraron tecnologías ni planes con ese criterio
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered.map(t => {
    const isSelected = _selectedTechName && t.name.toLowerCase() === _selectedTechName.toLowerCase();
    const techPlans = getPlansForTech(t);
    const planCount = techPlans.length;
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
              ${planCount > 0 ? `✓ ${planCount} plan${planCount === 1 ? '' : 'es'} registrados` : 'Sin planes'}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listContainer.querySelectorAll('.tech-item-row').forEach(row => {
    row.addEventListener('click', () => {
      _selectedTechName = row.dataset.techName;
      _selectedPlanId = null;
      _selectedPlanName = null;
      updateView();
    });
  });
}

function updateView() {
  const listContainer = document.getElementById('tech-list-scroll');
  const detailMount = document.getElementById('tech-detail-mount');
  const countBadge = document.getElementById('tech-count-badge');
  if (!listContainer || !detailMount) return;

  let filtered = _allTechs.filter(t => {
    if (_selectedCategory !== 'all' && t.category !== _selectedCategory) return false;
    if (_searchQuery) {
      const matchName = (t.name || '').toLowerCase().includes(_searchQuery);
      const plans = getPlansForTech(t);
      const matchPlan = plans.some(p => 
        (p.plan_nombre || '').toLowerCase().includes(_searchQuery) ||
        (p.descripcion || '').toLowerCase().includes(_searchQuery)
      );
      if (!matchName && !matchPlan) return false;
    }
    return true;
  });

  if (countBadge) {
    countBadge.textContent = `Tecnologías (${filtered.length})`;
  }

  let currentTech = _allTechs.find(t => _selectedTechName && t.name.toLowerCase() === _selectedTechName.toLowerCase());
  if (!currentTech && filtered.length > 0) {
    currentTech = filtered[0];
    _selectedTechName = currentTech.name;
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="p-8 text-center text-gray-400 text-xs">
        No se encontraron tecnologías con ese criterio
      </div>
    `;
  } else {
    listContainer.innerHTML = filtered.map(t => {
      const isSelected = currentTech && t.name.toLowerCase() === currentTech.name.toLowerCase();
      const techPlans = getPlansForTech(t);
      const planCount = techPlans.length;
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
                ${planCount > 0 ? `✓ ${planCount} plan${planCount === 1 ? '' : 'es'} registrados` : 'Sin planes'}
              </span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.tech-item-row').forEach(row => {
      row.addEventListener('click', () => {
        _selectedTechName = row.dataset.techName;
        _selectedPlanId = null;
        _selectedPlanName = null;
        updateView();
      });
    });
  }

  if (!currentTech) {
    detailMount.innerHTML = `
      <div class="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400">
        <span class="text-4xl block mb-2">🔍</span>
        <p class="text-sm font-medium text-gray-600">No hay tecnologías seleccionadas</p>
      </div>
    `;
    return;
  }

  const techPlans = getPlansForTech(currentTech);
  let activePlan = null;
  if (techPlans.length > 0) {
    activePlan = techPlans.find(p => p.id === _selectedPlanId || (p.plan_nombre && p.plan_nombre === _selectedPlanName)) || techPlans[0];
    _selectedPlanId = activePlan.id;
    _selectedPlanName = activePlan.plan_nombre;
  } else {
    _selectedPlanId = null;
    _selectedPlanName = null;
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
          <button type="button" id="btn-add-plan-for-tech" class="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 shadow-2xs" data-tech-id="${esc(tech.id || '')}" data-tech-name="${esc(tech.name)}" data-tech-category="${esc(tech.category)}">
            ${icon('add', 14)} Agregar Plan
          </button>
        </div>
      </div>

      <!-- Selector de Planes (Tabs horizontales) -->
      <div class="pt-4" id="tech-plan-tabs-container">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-gray-600 uppercase tracking-wide">PLANES TÉCNICOS REGISTRADOS:</span>
        </div>

        ${plans.length === 0 ? `
          <div class="bg-gray-50 rounded-lg p-6 text-center border border-dashed border-gray-200">
            <p class="text-xs text-gray-500 mb-2">Esta tecnología aún no tiene planes técnicos registrados en el sistema.</p>
            <button type="button" id="btn-create-first-plan" class="btn-primary text-xs py-1 px-3" data-tech-id="${esc(tech.id || '')}" data-tech-name="${esc(tech.name)}" data-tech-category="${esc(tech.category)}">
              + Crear Primer Plan Técnico
            </button>
          </div>
        ` : `
          <div class="flex items-center gap-2 overflow-x-auto pb-1" id="plan-tabs-bar">
            ${plans.map(p => {
              const isActive = activePlan && (activePlan.id === p.id || activePlan.plan_nombre === p.plan_nombre);
              return `
                <button type="button" class="plan-tab-btn px-3.5 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 shrink-0 ${
                  isActive 
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }" data-plan-id="${esc(p.id)}" data-plan-name="${esc(p.plan_nombre)}">
                  <span>${esc(p.plan_nombre)}</span>
                </button>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Contenedor del Plan Activo: Se actualiza independientemente sin mover el scroll -->
    <div id="active-plan-card-mount">
      ${activePlan ? renderActivePlanCard(activePlan, tech) : ''}
    </div>
  `;
}

function renderActivePlanCard(plan, tech) {
  const customFields = Array.isArray(plan.campos_extra) ? plan.campos_extra : [];

  return `
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      
      <!-- Barra de Acciones del Plan -->
      <div class="bg-gradient-to-r from-gray-50 to-white px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-bold text-gray-500 uppercase">Ficha del Plan:</span>
          <span class="text-sm font-bold text-gray-900">${esc(plan.plan_nombre)}</span>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" class="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1.5 btn-copy-plan" data-plan-id="${esc(plan.id)}" title="Copiar resumen técnico">
            ${icon('content_copy', 14)} Copiar Ficha
          </button>
          <button type="button" class="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1.5 btn-edit-plan" data-plan-id="${esc(plan.id)}">
            ${icon('edit', 14)} Editar Plan
          </button>
          <button type="button" class="btn-danger text-xs px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-1 btn-delete-plan" data-plan-id="${esc(plan.id)}" data-plan-name="${esc(plan.plan_nombre)}" data-tech-name="${esc(tech.name)}">
            ${icon('delete', 14)}
          </button>
        </div>
      </div>

      <!-- Si el plan es virtual (sin ficha aún en tech_plan_info) -->
      ${plan.isVirtual ? `
        <div class="m-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">ℹ️</span>
            <div>
              <strong>Plan registrado en el catálogo</strong>
              <p class="text-amber-800 mt-0.5">Este plan está registrado pero aún no se ha completado su ficha técnica con límites, cuotas y tablas.</p>
            </div>
          </div>
          <button type="button" class="btn-primary text-xs py-1 px-3 shrink-0 btn-edit-plan" data-plan-id="${esc(plan.id)}">
            + Completar Ficha Técnica
          </button>
        </div>
      ` : ''}

      <!-- Contenido de las Especificaciones Técnicas con Formato Enriquecido y Tablas -->
      <div class="p-6 space-y-6">

        <!-- 1. Cuotas y Consumo Mensual (Sin precios para OTI) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50/60 p-4 rounded-xl border border-gray-100">
          <div>
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cuota Mensual</span>
            <div class="text-xs text-gray-800">${renderRichContent(plan.cuota_mensual || 'Sin especificar')}</div>
          </div>
          <div>
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Ejemplo de Consumo Mensual</span>
            <div class="text-xs text-gray-800">${renderRichContent(plan.ejemplo_consumo_mensual || 'Sin especificar')}</div>
          </div>
        </div>

        <!-- 2. Descripción General y Agregados (Soporta listas con viñetas y resaltado) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl border border-gray-100 bg-white">
            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Descripción del Plan</span>
            <div class="rich-content-container">
              ${renderRichContent(plan.descripcion || 'Sin descripción')}
            </div>
          </div>
          <div class="p-4 rounded-xl border border-gray-100 bg-white">
            <span class="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-2">✨ Agregados & Beneficios</span>
            <div class="rich-content-container">
              ${renderRichContent(plan.agregados || 'Sin agregados registrados')}
            </div>
          </div>
        </div>

        <!-- 3. Límites Técnicos y Capacidades (Soporta Tablas completas tipo Imagen 3) -->
        <div class="border border-gray-100 rounded-xl p-4 bg-white space-y-3">
          <div class="flex items-center justify-between border-b border-gray-100 pb-2">
            <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              ${icon('tune', 16)} 3. Límites Técnicos y Capacidades
            </h4>
          </div>

          <div class="rich-content-container">
            ${renderRichContent(plan.limites_tecnicos || 'Sin límites técnicos registrados.')}
          </div>

          <!-- Campos complementarios de archivos y API -->
          ${(plan.limites_archivos || plan.limites_api) ? `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              ${plan.limites_archivos ? `
                <div class="bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                  <span class="text-[11px] font-bold text-gray-600 block mb-1">📁 Límites de Archivos</span>
                  <div class="rich-content-container">${renderRichContent(plan.limites_archivos)}</div>
                </div>
              ` : ''}
              ${plan.limites_api ? `
                <div class="bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                  <span class="text-[11px] font-bold text-gray-600 block mb-1">🔌 Límites de API</span>
                  <div class="rich-content-container">${renderRichContent(plan.limites_api)}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- 4. Reglas Críticas (Qué pasa si te pasas, Cuándo subir, Qué no incluye) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <h4 class="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              ⚠️ ¿Qué pasa si te pasas del límite?
            </h4>
            <div class="rich-content-container text-amber-950">
              ${renderRichContent(plan.pasa_si_te_pasas_del_limite || 'No hay política de sobreuso definida.')}
            </div>
          </div>

          <div class="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-4">
            <h4 class="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              🚀 ¿Cuándo subir de plan?
            </h4>
            <div class="rich-content-container text-indigo-950">
              ${renderRichContent(plan.cuando_subir || 'No se han definido disparadores de escalamiento.')}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-rose-50/60 border border-rose-200/80 rounded-xl p-4">
            <h4 class="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              🚫 Qué NO Incluye
            </h4>
            <div class="rich-content-container text-rose-950">
              ${renderRichContent(plan.que_no_incluye || 'Sin exclusiones especificadas.')}
            </div>
          </div>

          <div class="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              ❌ Lo que el plan NO resuelve
            </h4>
            <div class="rich-content-container text-gray-800">
              ${renderRichContent(plan.plan_no_resuelve || 'Sin restricciones adicionales.')}
            </div>
          </div>
        </div>

        <!-- 5. Gobernanza, Infraestructura y Operaciones -->
        <div class="border border-gray-100 rounded-xl p-4 bg-gray-50/40 space-y-4">
          <h4 class="text-xs font-bold text-gray-800 uppercase tracking-wider">
            🏛️ Gobernanza, Usuarios & Despliegue
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="bg-white p-3 rounded-lg border border-gray-200/70">
              <span class="text-[11px] font-bold text-gray-500 block mb-1">👥 Cuentas y Usuarios</span>
              <div class="rich-content-container">${renderRichContent(plan.cuentas_usuarios || 'Sin especificar')}</div>
            </div>
            <div class="bg-white p-3 rounded-lg border border-gray-200/70">
              <span class="text-[11px] font-bold text-gray-500 block mb-1">🔒 Seguridad & Accesos</span>
              <div class="rich-content-container">${renderRichContent(plan.seguridad_control_acceso || 'Sin especificar')}</div>
            </div>
            <div class="bg-white p-3 rounded-lg border border-gray-200/70">
              <span class="text-[11px] font-bold text-gray-500 block mb-1">🌐 Entrega y Dominio</span>
              <div class="rich-content-container">${renderRichContent(plan.entrega_dominio || 'Sin especificar')}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-200/60">
            <div class="bg-white p-3 rounded-lg border border-gray-200/70">
              <span class="text-[11px] font-bold text-gray-500 block mb-1">💾 Respaldo & Storage</span>
              <div class="rich-content-container">${renderRichContent(plan.respaldo_almacenamiento || 'Sin especificar')}</div>
            </div>
            <div class="bg-white p-3 rounded-lg border border-gray-200/70">
              <span class="text-[11px] font-bold text-purple-700 block mb-1">🤖 Complementos IA</span>
              <div class="rich-content-container">${renderRichContent(plan.complementos_ia || 'Sin complementos')}</div>
            </div>
            <div class="bg-white p-3 rounded-lg border border-gray-200/70">
              <span class="text-[11px] font-bold text-blue-700 block mb-1">🎥 Video</span>
              <div class="rich-content-container">${renderRichContent(plan.video || 'Sin video')}</div>
            </div>
            <div class="bg-white p-3 rounded-lg border border-gray-200/70">
              <span class="text-[11px] font-bold text-emerald-700 block mb-1">🎧 Soporte</span>
              <div class="rich-content-container">${renderRichContent(plan.soporte || 'Soporte estándar')}</div>
            </div>
          </div>
        </div>

        <!-- 6. Campos Dinámicos Personalizados -->
        ${customFields.length > 0 ? `
          <div class="border border-dashed border-gray-300 rounded-xl p-4 bg-white space-y-3">
            <h4 class="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
              ${icon('dataset', 16)} Campos Técnicos Adicionales
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              ${customFields.map(f => `
                <div class="bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <span class="text-[11px] font-bold text-gray-500 block mb-0.5">${esc(f.titulo)}</span>
                  <div class="rich-content-container">${renderRichContent(f.valor)}</div>
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
  // Selector de tabs de planes: CAMBIA SOLO LA TARJETA DEL PLAN SIN MOVER EL SCROLL DEL USUARIO
  const tabsBar = document.getElementById('plan-tabs-bar');
  if (tabsBar) {
    tabsBar.querySelectorAll('.plan-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const planId = btn.dataset.planId;
        const planName = btn.dataset.planName;
        _selectedPlanId = planId;
        _selectedPlanName = planName;

        const allPlans = getPlansForTech(tech);
        const newActivePlan = allPlans.find(p => p.id === planId || p.plan_nombre === planName) || allPlans[0];

        // 1. Actualizar las clases visuales de los tabs sin alterar el DOM de la página
        tabsBar.querySelectorAll('.plan-tab-btn').forEach(b => {
          if (b.dataset.planId === planId || b.dataset.planName === planName) {
            b.className = 'plan-tab-btn px-3.5 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 shrink-0 bg-primary-600 text-white border-primary-600 shadow-sm';
          } else {
            b.className = 'plan-tab-btn px-3.5 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 shrink-0 bg-white text-gray-700 border-gray-200 hover:bg-gray-50';
          }
        });

        // 2. Renderizar solo el contenedor de la tarjeta activa abajo, manteniendo la posición de scroll
        const cardMount = document.getElementById('active-plan-card-mount');
        if (cardMount && newActivePlan) {
          cardMount.innerHTML = renderActivePlanCard(newActivePlan, tech);
          wireCardActions(tech, newActivePlan);
        }
      });
    });
  }

  // Botón Agregar Plan para la tecnología actual
  document.getElementById('btn-add-plan-for-tech')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    openPlanModal(null, btn.dataset.techName, btn.dataset.techCategory, btn.dataset.techId);
  });
  document.getElementById('btn-create-first-plan')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    openPlanModal(null, btn.dataset.techName, btn.dataset.techCategory, btn.dataset.techId);
  });

  if (activePlan) {
    wireCardActions(tech, activePlan);
  }
}

function wireCardActions(tech, plan) {
  const cardMount = document.getElementById('active-plan-card-mount');
  if (!cardMount) return;

  cardMount.querySelectorAll('.btn-edit-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      openPlanModal(plan, tech.name, tech.category, tech.id);
    });
  });

  cardMount.querySelectorAll('.btn-delete-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      deletePlan(btn.dataset.planId, btn.dataset.planName, btn.dataset.techName);
    });
  });

  cardMount.querySelectorAll('.btn-copy-plan').forEach(btn => {
    btn.addEventListener('click', () => {
      copyPlanToClipboard(plan);
    });
  });
}

function copyPlanToClipboard(p) {
  const custom = (p.campos_extra || []).map(f => `• ${f.titulo}: ${f.valor}`).join('\n');
  const text = `
📋 FICHA TÉCNICA — ${p.tech_name || p.producto_nombre || ''} [${p.plan_nombre}]
--------------------------------------------------
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
    toast('No se pudo copiar al portapapeles', 'error');
  });
}

async function deletePlan(id, planNombre, techName) {
  if (!confirm(`¿Estás seguro de eliminar el plan "${planNombre}" para ${techName}?`)) return;

  try {
    if (id && !String(id).startsWith('cat-')) {
      await api.delete(`/tech-plan-info/${id}`);
      _items = _items.filter(it => it.id !== id);
    }

    toast('Plan técnico eliminado correctamente', 'success');
    _selectedPlanId = null;
    _selectedPlanName = null;
    updateView();
  } catch(e) {
    toast('Error al eliminar: ' + (e.message || 'Error de servidor'), 'error');
  }
}

/* ============================================================
   MODAL DE CREACIÓN / EDICIÓN (Con barra de tablas y resaltado)
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

      <!-- PESTAÑA 1: BÁSICO -->
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

        <div>
          <label class="block text-xs font-bold text-gray-700 mb-1">Nombre del Plan *</label>
          <input type="text" id="mp-plan-nombre" required value="${esc(plan?.plan_nombre || '')}" placeholder="Ej: Free Tier, Launch Plan, Team, Pro, Producción..." class="input text-xs w-full">
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-bold text-gray-700">Descripción del Plan</label>
            ${richTextToolbarHtml('mp-descripcion')}
          </div>
          <textarea id="mp-descripcion" rows="3" class="input text-xs w-full font-sans" placeholder="Objetivo y resumen de uso de esta herramienta o plan...">${esc(plan?.descripcion || '')}</textarea>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-bold text-emerald-800">✨ Agregados & Beneficios</label>
            ${richTextToolbarHtml('mp-agregados')}
          </div>
          <textarea id="mp-agregados" rows="4" class="input text-xs w-full font-sans" placeholder="• Beneficio 1&#10;• Beneficio 2&#10;• [rojo]Restricción clave[/rojo]">${esc(plan?.agregados || '')}</textarea>
        </div>
      </div>

      <!-- PESTAÑA 2: LÍMITES Y CUOTAS (Con soporte de Tablas tipo Imagen 3) -->
      <div id="tab-pane-limits" class="modal-tab-pane space-y-3 hidden">
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block text-xs font-bold text-gray-700">Límites Técnicos y Capacidades (Soporta Tablas | Col 1 | Col 2 |)</label>
            ${richTextToolbarHtml('mp-limites-tecnicos')}
          </div>
          <textarea id="mp-limites-tecnicos" rows="6" class="input text-xs w-full font-mono text-[11.5px]" placeholder="| Campo | Información para registrar |&#10;| Límites técnicos | Dependen del sistema... |&#10;| Límites de archivos | No existe límite universal... |">${esc(plan?.limites_tecnicos || '')}</textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">Cuota Mensual</label>
              ${richTextToolbarHtml('mp-cuota-mensual')}
            </div>
            <textarea id="mp-cuota-mensual" rows="2" class="input text-xs w-full" placeholder="Ej: 100,000 reqs/mes, 10 GB ancho de banda...">${esc(plan?.cuota_mensual || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">Ejemplo de Consumo Mensual</label>
              ${richTextToolbarHtml('mp-ejemplo-consumo')}
            </div>
            <textarea id="mp-ejemplo-consumo" rows="2" class="input text-xs w-full" placeholder="Ej: 5,000 visitas/mes, 100 consultas/día...">${esc(plan?.ejemplo_consumo_mensual || '')}</textarea>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">Límites de Archivos</label>
              ${richTextToolbarHtml('mp-limites-archivos')}
            </div>
            <textarea id="mp-limites-archivos" rows="2" class="input text-xs w-full" placeholder="Ej: 10 MB por imagen, 500 MB total...">${esc(plan?.limites_archivos || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">Límites de API</label>
              ${richTextToolbarHtml('mp-limites-api')}
            </div>
            <textarea id="mp-limites-api" rows="2" class="input text-xs w-full" placeholder="Ej: 60 reqs/min, token bearer con rotación...">${esc(plan?.limites_api || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 3: REGLAS & ESCALA -->
      <div id="tab-pane-rules" class="modal-tab-pane space-y-3 hidden">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-amber-800">⚠️ ¿Qué pasa si te pasas del límite?</label>
              ${richTextToolbarHtml('mp-pasa-si-te-pasas')}
            </div>
            <textarea id="mp-pasa-si-te-pasas" rows="3" class="input text-xs w-full" placeholder="Ej: El servicio bloquea las consultas extras o cobra $0.05 por GB adicional...">${esc(plan?.pasa_si_te_pasas_del_limite || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-indigo-800">🚀 ¿Cuándo subir de plan?</label>
              ${richTextToolbarHtml('mp-cuando-subir')}
            </div>
            <textarea id="mp-cuando-subir" rows="3" class="input text-xs w-full" placeholder="Ej: Cuando la app supere los 10,000 usuarios concurrentes...">${esc(plan?.cuando_subir || '')}</textarea>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-rose-800">🚫 Qué NO incluye</label>
              ${richTextToolbarHtml('mp-que-no-incluye')}
            </div>
            <textarea id="mp-que-no-incluye" rows="3" class="input text-xs w-full" placeholder="• No incluye dominio personalizado&#10;• No incluye soporte 24/7...">${esc(plan?.que_no_incluye || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">❌ Lo que el plan NO resuelve</label>
              ${richTextToolbarHtml('mp-plan-no-resuelve')}
            </div>
            <textarea id="mp-plan-no-resuelve" rows="3" class="input text-xs w-full" placeholder="Ej: No gestiona backups automáticos, requiere script cron externo...">${esc(plan?.plan_no_resuelve || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 4: INFRAESTRUCTURA, MULTIMEDIA & GOBERNANZA -->
      <div id="tab-pane-infra" class="modal-tab-pane space-y-3 hidden">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">👥 Cuentas y Usuarios</label>
              ${richTextToolbarHtml('mp-cuentas-usuarios')}
            </div>
            <textarea id="mp-cuentas-usuarios" rows="2" class="input text-xs w-full" placeholder="Ej: Hasta 5 miembros, SSO opcional...">${esc(plan?.cuentas_usuarios || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">🔒 Seguridad & Acceso</label>
              ${richTextToolbarHtml('mp-seguridad')}
            </div>
            <textarea id="mp-seguridad" rows="2" class="input text-xs w-full" placeholder="Ej: 2FA obligatorio, SSL gratuito, IP Whitelist...">${esc(plan?.seguridad_control_acceso || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">🌐 Entrega y Dominio</label>
              ${richTextToolbarHtml('mp-entrega-dominio')}
            </div>
            <textarea id="mp-entrega-dominio" rows="2" class="input text-xs w-full" placeholder="Ej: Subdominio .qubira.io, DNS gestionado...">${esc(plan?.entrega_dominio || '')}</textarea>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-gray-700">💾 Respaldo y Almacenamiento</label>
              ${richTextToolbarHtml('mp-respaldo')}
            </div>
            <textarea id="mp-respaldo" rows="2" class="input text-xs w-full" placeholder="Ej: Snapshots diarios por 7 días...">${esc(plan?.respaldo_almacenamiento || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-purple-700">🤖 Complementos IA</label>
              ${richTextToolbarHtml('mp-complementos-ia')}
            </div>
            <textarea id="mp-complementos-ia" rows="2" class="input text-xs w-full" placeholder="Ej: OpenAI API Embeddings, Claude Token pool...">${esc(plan?.complementos_ia || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-blue-700">🎥 Video</label>
              ${richTextToolbarHtml('mp-video')}
            </div>
            <textarea id="mp-video" rows="2" class="input text-xs w-full" placeholder="Ej: Transcodificación 720p, 50 hrs streaming...">${esc(plan?.video || '')}</textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-bold text-emerald-700">🎧 Soporte</label>
              ${richTextToolbarHtml('mp-soporte')}
            </div>
            <textarea id="mp-soporte" rows="2" class="input text-xs w-full" placeholder="Ej: Ticket < 24h, Discord Comunitario...">${esc(plan?.soporte || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- PESTAÑA 5: CAMPOS EXTRA DINÁMICOS -->
      <div id="tab-pane-custom" class="modal-tab-pane space-y-3 hidden">
        <div class="flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold text-gray-800">Campos Técnicos Personalizados</h4>
            <p class="text-[11px] text-gray-500">Agrega cualquier parámetro técnico adicional que necesites registrar para este plan.</p>
          </div>
          <button type="button" id="btn-add-modal-custom-field" class="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1">
            ${icon('add', 14)} Agregar Campo
          </button>
        </div>

        <div id="modal-custom-fields-container" class="space-y-2 pt-1 max-h-60 overflow-y-auto"></div>
      </div>

      <!-- Footer del Modal -->
      <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
        <button type="button" class="btn-secondary text-xs py-2 px-4" id="btn-modal-cancel">Cancelar</button>
        <button type="submit" class="btn-primary text-xs py-2 px-4 flex items-center gap-1.5" id="btn-modal-save">
          ${icon('save', 14)} Guardar Ficha Técnica
        </button>
      </div>
    </form>
  `, { maxWidth: 'max-w-4xl' });

  wireModalTabs();
  renderModalCustomFields();
  wireRichTextToolbars();

  document.getElementById('btn-modal-cancel')?.addEventListener('click', closeModal);

  document.getElementById('tech-plan-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-modal-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `${spinner(14)} Guardando...`;

    const techName = document.getElementById('mp-tech-name').value.trim();
    const planNombre = document.getElementById('mp-plan-nombre').value.trim();
    const category = document.getElementById('mp-category').value;

    let matchedTech = _allTechs.find(t => t.name.toLowerCase() === techName.toLowerCase());

    try {
      // Guardar ficha técnica detallada (ti.tech_plan_info) - Sin datos ni permisos de costo
      const payload = {
        tech_id: matchedTech ? matchedTech.id : (initialTechId || null),
        tech_name: techName,
        producto_nombre: techName,
        category: category,
        plan_nombre: planNombre,
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

      if (isEdit && !plan.isVirtual && plan.id && !String(plan.id).startsWith('cat-')) {
        const updated = await api.put(`/tech-plan-info/${plan.id}`, payload);
        toast('Ficha técnica guardada con éxito', 'success');
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
      _selectedPlanName = planNombre;
      closeModal();
      updateView();
    } catch(err) {
      toast('Error al guardar: ' + (err.message || 'Error de servidor'), 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = `${icon('save', 14)} Guardar Ficha Técnica`;
    }
  });
}

function wireRichTextToolbars() {
  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + text + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  function wrapSelection(textarea, prefix, suffix, defaultText = '') {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const val = textarea.value;
    const selected = val.substring(start, end) || defaultText;
    const replacement = prefix + selected + suffix;
    textarea.value = val.substring(0, start) + replacement + val.substring(end);
    textarea.selectionStart = start + prefix.length;
    textarea.selectionEnd = start + prefix.length + selected.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  document.querySelectorAll('.btn-rt-table').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      const tableTpl = `\n| Campo | Información para registrar |\n| Límites técnicos | Dependen del entorno de ejecución... |\n| Límites de archivos | Especificación según plataforma... |\n| Límites de API | Cuotas o solicitudes permitidas... |\n`;
      insertAtCursor(target, tableTpl);
    });
  });

  document.querySelectorAll('.btn-rt-red').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      wrapSelection(target, '[rojo]', '[/rojo]', 'palabra o frase');
    });
  });

  document.querySelectorAll('.btn-rt-bullet').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      insertAtCursor(target, '\n• ');
    });
  });

  document.querySelectorAll('.btn-rt-bold').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      if (!target) return;
      wrapSelection(target, '**', '**', 'texto en negrita');
    });
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
