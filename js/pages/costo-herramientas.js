import { api }      from '../api.js';
import { toast, showModal, closeModal, spinner, icon } from '../utils.js';
import { initTechStackBuilder } from '../components/tech-stack-builder.js?v=11';

let _techCatalog = { language: [], tool: [] };
let _currentTab = 'stack'; // 'stack' | 'catalog'

const CURRENCY_SYMBOLS = {
  PEN: 'S/',
  USD: '$',
  EUR: '€',
};

function getCurSym(moneda) {
  return CURRENCY_SYMBOLS[moneda] || 'S/';
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
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="costo-herramientas-page">${spinner()}</div>`;
  load();
}

function load() {
  Promise.all([
    api.get('/technology-catalog', { category: 'language' }),
    api.get('/technology-catalog', { category: 'tool' }),
  ]).then(([langs, tools]) => {
    _techCatalog = { language: langs, tool: tools };
    renderPage();
  }).catch(() => {
    const c = document.getElementById('costo-herramientas-page');
    if (c) c.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar las tecnologías</p>';
  });
}

function normalizePlans(t) {
  const defaultMoneda = t.moneda || 'PEN';
  const defaultPeriodo = t.periodo || 'mes';
  if (Array.isArray(t.plans) && t.plans.length > 0) {
    return t.plans.map(p => ({
      name: p.name ?? '',
      costo: p.costo ?? null,
      margen_min: p.margen_min ?? null,
      margen_max: p.margen_max ?? null,
      moneda: p.moneda || defaultMoneda,
      periodo: p.periodo || defaultPeriodo,
    }));
  }
  return [{
    name: '',
    costo: t.costo ?? null,
    margen_min: t.margen_min ?? null,
    margen_max: t.margen_max ?? null,
    moneda: defaultMoneda,
    periodo: defaultPeriodo,
  }];
}

function renderPage() {
  const c = document.getElementById('costo-herramientas-page');
  if (!c) return;

  c.innerHTML = `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Herramientas & Tech Stack</h1>
        <p class="text-sm text-gray-500 mt-1">Ramificaciones de tecnologías (Tech Stack) y matriz de costos/planes para proyectos.</p>
      </div>
      <div>
        <button type="button" id="open-tech-cost-btn" class="btn-primary flex items-center gap-2">
          ${icon('payments', 18)} Matriz de Costos OPP
        </button>
      </div>
    </div>

    <!-- Pestañas -->
    <div class="flex items-center gap-3 border-b border-gray-200 mb-6">
      <button type="button" id="tab-btn-stack" class="pb-3 px-3 text-sm font-semibold transition-colors flex items-center gap-2 ${_currentTab === 'stack' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'}">
        <span class="text-base">🌳</span> Tech Stack (Ramificaciones)
      </button>
      <button type="button" id="tab-btn-catalog" class="pb-3 px-3 text-sm font-semibold transition-colors flex items-center gap-2 ${_currentTab === 'catalog' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 hover:text-gray-700'}">
        <span class="text-base">📋</span> Catálogo & Costos
      </button>
    </div>

    <div id="tab-content-container"></div>`;

  document.getElementById('tab-btn-stack')?.addEventListener('click', () => switchTab('stack'));
  document.getElementById('tab-btn-catalog')?.addEventListener('click', () => switchTab('catalog'));
  document.getElementById('open-tech-cost-btn')?.addEventListener('click', openTechCostModal);

  renderTabContent();
}

function switchTab(tab) {
  _currentTab = tab;
  renderPage();
}

function renderTabContent() {
  const container = document.getElementById('tab-content-container');
  if (!container) return;

  if (_currentTab === 'stack') {
    container.innerHTML = `<div id="tech-stack-mount"></div>`;
    initTechStackBuilder(document.getElementById('tech-stack-mount'), { role: 'ADG' });
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        ${techPreviewColumn('Lenguajes', 'language')}
        ${techPreviewColumn('Herramientas', 'tool')}
      </div>`;
  }
}

function techPreviewColumn(label, category) {
  const items = _techCatalog[category] || [];
  return `
  <div class="card p-5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-semibold text-gray-900">${label}</h3>
      <span class="text-xs text-gray-400 font-medium">${items.length} registrado${items.length === 1 ? '' : 's'}</span>
    </div>
    <div class="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
      ${items.length === 0
        ? '<p class="text-xs text-gray-400 py-4 text-center">Sin registrar</p>'
        : items.map(techRowPreview).join('')}
    </div>
  </div>`;
}

function techRowPreview(t) {
  const avatar = t.image_url
    ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200/80 p-1 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain" alt="${esc(t.name)}"></div>`
    : `<span class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 shadow-sm">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  
  const plans = normalizePlans(t);
  let badge = '';
  if (t.category === 'tool' && plans.length > 1) {
    badge = `<span class="text-xs text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">${plans.length} planes</span>`;
  } else if (plans[0]?.costo != null && plans[0]?.costo !== '') {
    const sym = getCurSym(plans[0].moneda || t.moneda);
    const per = (plans[0].periodo || t.periodo) === 'año' ? '/año' : '/mes';
    badge = `<span class="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">${sym} ${Number(plans[0].costo).toFixed(2)} ${per}</span>`;
  } else if (t.costo != null && t.costo !== '') {
    const sym = getCurSym(t.moneda);
    const per = t.periodo === 'año' ? '/año' : '/mes';
    badge = `<span class="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded">${sym} ${Number(t.costo).toFixed(2)} ${per}</span>`;
  }

  return `
  <div class="flex items-center gap-3 py-2.5">
    ${avatar}
    <p class="text-sm font-medium text-gray-800 flex-1 truncate">${esc(t.name)}</p>
    ${badge}
  </div>`;
}

function fmtMoney(v, moneda = 'PEN') {
  if (v == null || v === '') return '—';
  const sym = getCurSym(moneda);
  return `${sym} ${Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function openTechCostModal(onCloseCallback) {
  if (!_techCatalog.language.length && !_techCatalog.tool.length) {
    Promise.all([
      api.get('/technology-catalog', { category: 'language' }),
      api.get('/technology-catalog', { category: 'tool' }),
    ]).then(([langs, tools]) => {
      _techCatalog = { language: langs, tool: tools };
      openTechCostModal(onCloseCallback);
    }).catch(err => {
      toast('Error al cargar catálogo de costos: ' + (err.message || ''), 'error');
    });
    return;
  }

  const langCount = (_techCatalog.language || []).length;
  const toolCount = (_techCatalog.tool || []).length;
  const totalCount = langCount + toolCount;

  showModal('Herramientas Costo', `
    <!-- Encabezado fijo con descripción, pestañas y búsqueda inteligente -->
    <div class="sticky -top-4 -mx-6 px-6 pt-4 pb-3 bg-white border-b border-gray-100 z-30 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] mb-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <p class="text-xs text-gray-500 max-w-xl">Costo de referencia y margen para armar el rango de propuesta en Soles (S/), Dólares ($) o Euros (€). Se guarda automáticamente.</p>
        <div class="flex items-center gap-1.5 shrink-0 bg-gray-100 p-1 rounded-lg">
          <button type="button" class="tc-tab-btn px-2.5 py-1 text-xs font-semibold rounded-md bg-white shadow-sm text-gray-900 transition-all" data-tab="all">
            Todos (<span id="tc-count-all">${totalCount}</span>)
          </button>
          <button type="button" class="tc-tab-btn px-2.5 py-1 text-xs font-semibold rounded-md text-gray-600 hover:text-gray-900 transition-all" data-tab="language">
            Lenguajes (<span id="tc-count-language">${langCount}</span>)
          </button>
          <button type="button" class="tc-tab-btn px-2.5 py-1 text-xs font-semibold rounded-md text-gray-600 hover:text-gray-900 transition-all" data-tab="tool">
            Herramientas (<span id="tc-count-tool">${toolCount}</span>)
          </button>
        </div>
      </div>
      <!-- Búsqueda inteligente -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
          ${icon('search', 18)}
        </div>
        <input type="text" id="tc-search-input" autocomplete="off"
          placeholder="Búsqueda inteligente: escribe el nombre de un lenguaje o herramienta (ej: React, Python, Docker, .NET...)"
          class="input pl-9 pr-9 py-2 text-xs w-full bg-gray-50 hover:bg-white focus:bg-white border-gray-200 transition-all rounded-lg">
        <button type="button" id="tc-search-clear" class="hidden absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer" title="Limpiar búsqueda">
          ${icon('close', 16)}
        </button>
      </div>
    </div>

    <div class="space-y-6">
      <div id="tc-section-language">
        ${techCostSection('Lenguajes', 'language')}
      </div>
      <div id="tc-section-tool">
        ${techCostSection('Herramientas', 'tool')}
      </div>
      <div id="tc-empty-all" class="hidden text-center py-10 text-gray-400 text-sm bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
        <p class="font-medium text-gray-600">No se encontraron tecnologías que coincidan con la búsqueda</p>
        <p class="text-xs text-gray-400 mt-1">Prueba con otro término o limpia el buscador.</p>
      </div>
    </div>
  `, '2xl', `
    <div class="flex justify-end">
      <button type="button" id="tech-cost-close" class="btn-secondary">Cerrar</button>
    </div>
  `);

  document.getElementById('tech-cost-close').addEventListener('click', () => {
    closeModal();
    if (typeof onCloseCallback === 'function') {
      onCloseCallback();
    } else {
      renderPage();
    }
  });

  wireTechCostModal();
}

function currencySelectHtml(currentMoneda = 'PEN', extraClass = '') {
  return `
  <select data-field="moneda" data-initial="${currentMoneda}" class="tc-currency-select ${extraClass} text-xs py-1 px-1 rounded-md border border-gray-200 bg-gray-50 hover:bg-white text-gray-700 font-bold focus:border-indigo-400 focus:outline-none transition-all cursor-pointer shrink-0">
    <option value="PEN" ${currentMoneda === 'PEN' ? 'selected' : ''}>S/ (PEN)</option>
    <option value="USD" ${currentMoneda === 'USD' ? 'selected' : ''}>$ (USD)</option>
    <option value="EUR" ${currentMoneda === 'EUR' ? 'selected' : ''}>€ (EUR)</option>
  </select>`;
}

function periodSelectHtml(currentPeriod = 'mes', extraClass = '') {
  const p = currentPeriod === 'año' ? 'año' : 'mes';
  return `
  <select data-field="periodo" data-initial="${p}" class="tc-period-select ${extraClass} text-xs py-1 px-1.5 rounded-md border border-gray-200 bg-gray-50 hover:bg-white text-gray-700 font-medium focus:border-indigo-400 focus:outline-none transition-all cursor-pointer shrink-0">
    <option value="mes" ${p === 'mes' ? 'selected' : ''}>Por mes</option>
    <option value="año" ${p === 'año' ? 'selected' : ''}>Por año</option>
  </select>`;
}

function techCostSection(label, category) {
  const items = _techCatalog[category] || [];
  const isTool = category === 'tool';
  return `
  <div>
    ${items.length === 0 ? `
      <div class="flex items-center justify-between mb-2">
        <h4 class="font-semibold text-gray-900">${label}</h4>
      </div>
      <p class="text-xs text-gray-400 py-3">Sin registrar</p>` : `
    <div class="border border-gray-200/90 rounded-xl overflow-hidden shadow-sm" id="tc-table-wrap-${category}">
      <div class="overflow-x-auto overflow-y-auto max-h-[56vh]">
        <table class="w-full text-sm border-collapse">
          <thead class="sticky top-0 z-20 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.06)]">
            <tr class="bg-white border-b border-gray-100">
              <th colspan="${isTool ? 6 : 5}" class="px-4 py-2.5 text-left bg-white">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-gray-900 text-sm">${label}</span>
                  ${isTool ? '<span class="text-xs text-gray-400 font-medium">Hasta 7 planes por herramienta con denominación personalizada</span>' : ''}
                </div>
              </th>
            </tr>
            <tr class="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-200">
              <th class="text-left px-4 py-2.5 font-medium bg-gray-50">Herramienta</th>
              ${isTool ? '<th class="text-left px-3 py-2.5 font-medium bg-gray-50">Plan</th>' : ''}
              <th class="text-left px-3 py-2.5 font-medium bg-gray-50">Costo</th>
              <th class="text-left px-3 py-2.5 font-medium bg-gray-50">Margen mín</th>
              <th class="text-left px-3 py-2.5 font-medium bg-gray-50">Margen máx</th>
              <th class="text-left px-3 py-2.5 font-medium bg-gray-50">Propuesta</th>
            </tr>
          </thead>
          ${isTool ? items.map(t => toolGroupHtml(t)).join('') : `
          <tbody class="divide-y divide-gray-50">
            ${items.map(t => languageRowHtml(t)).join('')}
          </tbody>`}
        </table>
      </div>
    </div>
    <div id="tc-empty-${category}" class="hidden py-6 text-center text-xs text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-2">
      No se encontraron ${label.toLowerCase()} que coincidan con el filtro.
    </div>`}
  </div>`;
}

function toolGroupHtml(t) {
  const plans = normalizePlans(t);
  t.plans = plans;
  const avatar = t.image_url
    ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200/80 p-1 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain" alt="${esc(t.name)}"></div>`
    : `<span class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 shadow-sm">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;

  return `
  <tbody data-tc-group="${esc(t.id)}" data-category="tool" data-name="${esc((t.name || '').toLowerCase())}" class="border-t border-gray-100 transition-colors">
    ${toolRowsHtml(t, plans, avatar)}
  </tbody>`;
}

function toolRowsHtml(t, plans, avatar) {
  if (!avatar) {
    avatar = t.image_url
      ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200/80 p-1 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain" alt="${esc(t.name)}"></div>`
      : `<span class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 shadow-sm">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  }
  const isMax = plans.length >= 7;

  return plans.map((p, idx) => {
    const isFirst = idx === 0;
    const cVal = p.costo ?? '';
    const minVal = p.margen_min ?? '';
    const maxVal = p.margen_max ?? '';
    const nameVal = p.name ?? '';
    const curVal = p.moneda || t.moneda || 'PEN';
    const perVal = p.periodo || t.periodo || 'mes';

    return `
    <tr data-tc-plan-row data-plan-index="${idx}" class="hover:bg-gray-50/60 transition-colors">
      ${isFirst ? `
      <td rowspan="${plans.length}" class="px-4 py-2.5 align-middle border-b border-gray-100 bg-white">
        <div class="flex items-center gap-3">
          ${avatar}
          <div>
            <span class="text-gray-800 whitespace-nowrap font-medium tc-item-name block">${esc(t.name)}</span>
            ${plans.length > 1 ? `<span class="text-[10.5px] text-gray-400 font-normal">${plans.length} planes</span>` : ''}
          </div>
        </div>
      </td>` : ''}
      <td class="px-3 py-2 border-b border-gray-100">
        <div class="flex items-center gap-1.5">
          <input type="text" class="input text-xs py-1.5 w-32 tc-plan-input" data-field="name" placeholder="Nombre del plan..." data-initial="${esc(nameVal)}" value="${esc(nameVal)}">
          <button type="button" class="tc-add-plan-btn w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200 transition-all ${isMax ? 'opacity-30 cursor-not-allowed pointer-events-none' : ''}" title="${isMax ? 'Máximo 7 planes alcanzado' : 'Añadir sub-plan'}" data-tool-id="${esc(t.id)}">+</button>
          ${plans.length > 1 ? `
          <button type="button" class="tc-del-plan-btn w-6 h-6 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 flex items-center justify-center font-bold text-xs shrink-0 border border-rose-200 transition-all" title="Eliminar este plan" data-tool-id="${esc(t.id)}" data-plan-index="${idx}">✕</button>` : ''}
        </div>
      </td>
      <td class="px-3 py-2 border-b border-gray-100">
        <div class="flex items-center gap-1.5">
          ${currencySelectHtml(curVal)}
          <input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-20 tc-plan-input" data-field="costo" placeholder="0.00" data-initial="${cVal}" value="${cVal}">
          ${periodSelectHtml(perVal)}
        </div>
      </td>
      <td class="px-3 py-2 border-b border-gray-100"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-20 tc-plan-input" data-field="margen_min" placeholder="0.00" data-initial="${minVal}" value="${minVal}"></td>
      <td class="px-3 py-2 border-b border-gray-100"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-20 tc-plan-input" data-field="margen_max" placeholder="0.00" data-initial="${maxVal}" value="${maxVal}"></td>
      <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap tc-propuesta font-semibold border-b border-gray-100">${propuestaLabel(p)}</td>
    </tr>`;
  }).join('');
}

function languageRowHtml(t) {
  const avatar = t.image_url
    ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200/80 p-1 flex items-center justify-center shrink-0 shadow-sm"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain" alt="${esc(t.name)}"></div>`
    : `<span class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0 shadow-sm">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  const cVal = t.costo ?? '';
  const minVal = t.margen_min ?? '';
  const maxVal = t.margen_max ?? '';
  const curVal = t.moneda || 'PEN';
  const perVal = t.periodo || 'mes';
  return `
  <tr data-tc-row="${esc(t.id)}" data-category="language" data-name="${esc((t.name || '').toLowerCase())}" class="hover:bg-gray-50/60 transition-colors">
    <td class="px-4 py-2">
      <div class="flex items-center gap-3">
        ${avatar}
        <span class="text-gray-800 whitespace-nowrap font-medium tc-item-name">${esc(t.name)}</span>
      </div>
    </td>
    <td class="px-3 py-2">
      <div class="flex items-center gap-1.5">
        ${currencySelectHtml(curVal)}
        <input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-20 tc-input" data-field="costo" placeholder="0.00" data-initial="${cVal}" value="${cVal}">
        ${periodSelectHtml(perVal)}
      </div>
    </td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-20 tc-input" data-field="margen_min" placeholder="0.00" data-initial="${minVal}" value="${minVal}"></td>
    <td class="px-3 py-2"><input type="number" step="0.01" min="0" class="input text-xs py-1.5 w-20 tc-input" data-field="margen_max" placeholder="0.00" data-initial="${maxVal}" value="${maxVal}"></td>
    <td class="px-3 py-2 text-xs text-gray-600 whitespace-nowrap tc-propuesta font-semibold">${propuestaLabel(t)}</td>
  </tr>`;
}

function propuestaLabel(p) {
  const hasCost = p.costo !== null && p.costo !== '' && p.costo !== undefined;
  const hasMin = p.margen_min !== null && p.margen_min !== '' && p.margen_min !== undefined;
  const hasMax = p.margen_max !== null && p.margen_max !== '' && p.margen_max !== undefined;
  if (!hasMin && !hasMax && !hasCost) return 'Indefinido';

  const sym = getCurSym(p.moneda);
  const periodoStr = p.periodo === 'año' ? ' / año' : ' / mes';
  const min = Number(p.margen_min) || 0;
  const max = Number(p.margen_max) || 0;
  const costo = Number(p.costo) || 0;

  // Precio Máximo para debatir precios con clientes
  const pMax = max > 0 ? max : costo;
  if (pMax === 0 && min === 0 && costo === 0) return 'Gratis';

  const fMax = Number(pMax).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (min > 0 && min < pMax) {
    const fMin = Number(min).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${sym} ${fMax}${periodoStr} (Mín: ${sym} ${fMin})`;
  }
  return `${sym} ${fMax}${periodoStr}`;
}

function wireTechCostModal() {
  const modalBody = document.getElementById('modal-body');
  if (!modalBody) return;

  let currentTab = 'all';
  let currentSearch = '';

  function applyFilter() {
    const q = currentSearch.trim().toLowerCase();
    let totalVisible = 0;
    let langVisible = 0;
    let toolVisible = 0;

    // 1. Lenguajes
    const langRows = modalBody.querySelectorAll('[data-tc-row]');
    langRows.forEach(row => {
      const name = row.dataset.name || '';
      const matchesQuery = !q || name.includes(q);
      const matchesTab = (currentTab === 'all' || currentTab === 'language');

      if (matchesQuery) {
        langVisible++;
        totalVisible++;
      }
      row.style.display = (matchesQuery && matchesTab) ? '' : 'none';
    });

    // 2. Herramientas
    const toolGroups = modalBody.querySelectorAll('[data-tc-group]');
    toolGroups.forEach(group => {
      const name = group.dataset.name || '';
      const toolId = group.dataset.tcGroup;
      const toolItem = (_techCatalog.tool || []).find(x => x.id === toolId);
      const plansNames = (toolItem?.plans || []).map(p => (p.name || '').toLowerCase()).join(' ');
      const matchesQuery = !q || name.includes(q) || plansNames.includes(q);
      const matchesTab = (currentTab === 'all' || currentTab === 'tool');

      if (matchesQuery) {
        toolVisible++;
        totalVisible++;
      }
      group.style.display = (matchesQuery && matchesTab) ? '' : 'none';
    });

    // Actualizar contadores en pestañas
    const countAll = document.getElementById('tc-count-all');
    const countLang = document.getElementById('tc-count-language');
    const countTool = document.getElementById('tc-count-tool');
    const origLang = (_techCatalog.language || []).length;
    const origTool = (_techCatalog.tool || []).length;

    if (countAll) countAll.textContent = q ? totalVisible : origLang + origTool;
    if (countLang) countLang.textContent = q ? langVisible : origLang;
    if (countTool) countTool.textContent = q ? toolVisible : origTool;

    // Secciones y mensajes de vacíos
    const secLang = document.getElementById('tc-section-language');
    const secTool = document.getElementById('tc-section-tool');
    const emptyAll = document.getElementById('tc-empty-all');
    const wrapLang = document.getElementById('tc-table-wrap-language');
    const wrapTool = document.getElementById('tc-table-wrap-tool');
    const emptyLang = document.getElementById('tc-empty-language');
    const emptyTool = document.getElementById('tc-empty-tool');

    if (secLang) secLang.style.display = (currentTab === 'all' || currentTab === 'language') ? '' : 'none';
    if (secTool) secTool.style.display = (currentTab === 'all' || currentTab === 'tool') ? '' : 'none';

    if (wrapLang) wrapLang.style.display = langVisible > 0 ? '' : 'none';
    if (emptyLang) emptyLang.style.display = (q && langVisible === 0) ? '' : 'none';

    if (wrapTool) wrapTool.style.display = toolVisible > 0 ? '' : 'none';
    if (emptyTool) emptyTool.style.display = (q && toolVisible === 0) ? '' : 'none';

    if (emptyAll) {
      const tabTotal = currentTab === 'language' ? langVisible : (currentTab === 'tool' ? toolVisible : totalVisible);
      emptyAll.classList.toggle('hidden', !q || tabTotal > 0);
    }
  }

  // 1. Pestañas de filtrado (Todos / Lenguajes / Herramientas)
  modalBody.querySelectorAll('.tc-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      modalBody.querySelectorAll('.tc-tab-btn').forEach(b => {
        b.classList.remove('bg-white', 'shadow-sm', 'text-gray-900');
        b.classList.add('text-gray-600');
      });
      btn.classList.add('bg-white', 'shadow-sm', 'text-gray-900');
      btn.classList.remove('text-gray-600');
      applyFilter();
    });
  });

  // 2. Buscador inteligente en tiempo real
  const searchInput = document.getElementById('tc-search-input');
  const searchClear = document.getElementById('tc-search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value;
      if (searchClear) searchClear.classList.toggle('hidden', !currentSearch);
      applyFilter();
    });
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        currentSearch = '';
        if (searchClear) searchClear.classList.add('hidden');
        applyFilter();
      }
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      currentSearch = '';
      searchClear.classList.add('hidden');
      applyFilter();
    });
  }

  // 3. Botones Agregar (+) y Eliminar (✕) sub-planes
  modalBody.addEventListener('click', async e => {
    const addBtn = e.target.closest('.tc-add-plan-btn');
    if (addBtn) {
      const toolId = addBtn.dataset.toolId;
      const tool = (_techCatalog.tool || []).find(x => x.id === toolId);
      if (!tool) return;
      const group = modalBody.querySelector(`[data-tc-group="${toolId}"]`);
      tool.plans = getPlansFromGroupDom(group, tool);
      if (tool.plans.length >= 7) {
        toast('Máximo 7 planes por herramienta', 'warning');
        return;
      }
      const lastMoneda = tool.plans[tool.plans.length - 1]?.moneda || tool.moneda || 'PEN';
      const lastPeriodo = tool.plans[tool.plans.length - 1]?.periodo || tool.periodo || 'mes';
      tool.plans.push({ name: '', costo: null, margen_min: null, margen_max: null, moneda: lastMoneda, periodo: lastPeriodo });
      if (group) {
        group.innerHTML = toolRowsHtml(tool, tool.plans);
        const nameInputs = group.querySelectorAll('input[data-field="name"]');
        if (nameInputs.length) nameInputs[nameInputs.length - 1].focus();
      }
      saveToolPlans(tool, group);
      return;
    }

    const delBtn = e.target.closest('.tc-del-plan-btn');
    if (delBtn) {
      const toolId = delBtn.dataset.toolId;
      const idx = Number(delBtn.dataset.planIndex);
      const tool = (_techCatalog.tool || []).find(x => x.id === toolId);
      if (!tool) return;
      const group = modalBody.querySelector(`[data-tc-group="${toolId}"]`);
      tool.plans = getPlansFromGroupDom(group, tool);
      if (tool.plans.length <= 1) return;
      tool.plans.splice(idx, 1);
      if (group) {
        group.innerHTML = toolRowsHtml(tool, tool.plans);
      }
      saveToolPlans(tool, group);
      return;
    }
  });

  // 4. Selector de moneda o periodo (change event)
  modalBody.addEventListener('change', e => {
    const sel = e.target.closest('.tc-currency-select, .tc-period-select');
    if (!sel) return;

    const planRow = sel.closest('[data-tc-plan-row]');
    if (planRow) {
      const costo = planRow.querySelector('[data-field="costo"]')?.value ?? '';
      const margen_min = planRow.querySelector('[data-field="margen_min"]')?.value ?? '';
      const margen_max = planRow.querySelector('[data-field="margen_max"]')?.value ?? '';
      const moneda = planRow.querySelector('[data-field="moneda"]')?.value || 'PEN';
      const periodo = planRow.querySelector('[data-field="periodo"]')?.value || 'mes';
      const propEl = planRow.querySelector('.tc-propuesta');
      if (propEl) propEl.textContent = propuestaLabel({ costo, margen_min, margen_max, moneda, periodo });

      const group = sel.closest('[data-tc-group]');
      if (group) {
        const toolId = group.dataset.tcGroup;
        const tool = (_techCatalog.tool || []).find(x => x.id === toolId);
        if (tool) {
          collectAndSaveToolPlans(tool, group);
        }
      }
      return;
    }

    const langRow = sel.closest('[data-tc-row]');
    if (langRow) {
      const costo = langRow.querySelector('[data-field="costo"]')?.value ?? '';
      const margen_min = langRow.querySelector('[data-field="margen_min"]')?.value ?? '';
      const margen_max = langRow.querySelector('[data-field="margen_max"]')?.value ?? '';
      const moneda = langRow.querySelector('[data-field="moneda"]')?.value || 'PEN';
      const periodo = langRow.querySelector('[data-field="periodo"]')?.value || 'mes';
      const propEl = langRow.querySelector('.tc-propuesta');
      if (propEl) propEl.textContent = propuestaLabel({ costo, margen_min, margen_max, moneda, periodo });

      const id = langRow.dataset.tcRow;
      const cInput = langRow.querySelector('[data-field="costo"]');
      const minInput = langRow.querySelector('[data-field="margen_min"]');
      const maxInput = langRow.querySelector('[data-field="margen_max"]');
      const monSel = langRow.querySelector('[data-field="moneda"]');
      const perSel = langRow.querySelector('[data-field="periodo"]');
      const values = {
        costo,
        margen_min,
        margen_max,
        moneda,
        periodo,
      };
      saveLanguageCostRow(id, values, langRow, [cInput, minInput, maxInput, monSel, perSel]);
    }
  });

  // 5. Delegación de eventos live input (para propuesta instantánea)
  modalBody.addEventListener('input', e => {
    const input = e.target.closest('.tc-plan-input, .tc-input');
    if (!input) return;

    const planRow = input.closest('[data-tc-plan-row]');
    if (planRow) {
      const costo = planRow.querySelector('[data-field="costo"]')?.value ?? '';
      const margen_min = planRow.querySelector('[data-field="margen_min"]')?.value ?? '';
      const margen_max = planRow.querySelector('[data-field="margen_max"]')?.value ?? '';
      const moneda = planRow.querySelector('[data-field="moneda"]')?.value || 'PEN';
      const periodo = planRow.querySelector('[data-field="periodo"]')?.value || 'mes';
      const propEl = planRow.querySelector('.tc-propuesta');
      if (propEl) propEl.textContent = propuestaLabel({ costo, margen_min, margen_max, moneda, periodo });
      return;
    }

    const langRow = input.closest('[data-tc-row]');
    if (langRow) {
      const costo = langRow.querySelector('[data-field="costo"]')?.value ?? '';
      const margen_min = langRow.querySelector('[data-field="margen_min"]')?.value ?? '';
      const margen_max = langRow.querySelector('[data-field="margen_max"]')?.value ?? '';
      const moneda = langRow.querySelector('[data-field="moneda"]')?.value || 'PEN';
      const periodo = langRow.querySelector('[data-field="periodo"]')?.value || 'mes';
      const propEl = langRow.querySelector('.tc-propuesta');
      if (propEl) propEl.textContent = propuestaLabel({ costo, margen_min, margen_max, moneda, periodo });
    }
  });

  // 6. Delegación de eventos focusout (auto-guardado)
  modalBody.addEventListener('focusout', e => {
    const input = e.target.closest('.tc-plan-input, .tc-input');
    if (!input) return;

    // Si pertenece a una herramienta (con sub-planes)
    const group = input.closest('[data-tc-group]');
    if (group) {
      const toolId = group.dataset.tcGroup;
      const tool = (_techCatalog.tool || []).find(x => x.id === toolId);
      if (!tool) return;

      const planRows = group.querySelectorAll('[data-tc-plan-row]');
      let changed = false;
      planRows.forEach(pr => {
        const nameInp = pr.querySelector('[data-field="name"]');
        const costInp = pr.querySelector('[data-field="costo"]');
        const minInp = pr.querySelector('[data-field="margen_min"]');
        const maxInp = pr.querySelector('[data-field="margen_max"]');
        const monSel = pr.querySelector('[data-field="moneda"]');
        const perSel = pr.querySelector('[data-field="periodo"]');
        if (
          (nameInp && nameInp.value !== nameInp.dataset.initial) ||
          (costInp && costInp.value !== costInp.dataset.initial) ||
          (minInp && minInp.value !== minInp.dataset.initial) ||
          (maxInp && maxInp.value !== maxInp.dataset.initial) ||
          (monSel && monSel.value !== monSel.dataset.initial) ||
          (perSel && perSel.value !== perSel.dataset.initial)
        ) {
          changed = true;
        }
      });

      if (changed) {
        collectAndSaveToolPlans(tool, group);
      }
      return;
    }

    // Si pertenece a un lenguaje (fila única)
    const langRow = input.closest('[data-tc-row]');
    if (langRow) {
      const cInput = langRow.querySelector('[data-field="costo"]');
      const minInput = langRow.querySelector('[data-field="margen_min"]');
      const maxInput = langRow.querySelector('[data-field="margen_max"]');
      const monSel = langRow.querySelector('[data-field="moneda"]');
      const perSel = langRow.querySelector('[data-field="periodo"]');
      if (
        cInput.value === cInput.dataset.initial &&
        minInput.value === minInput.dataset.initial &&
        maxInput.value === maxInput.dataset.initial &&
        (!monSel || monSel.value === monSel.dataset.initial) &&
        (!perSel || perSel.value === perSel.dataset.initial)
      ) {
        return;
      }
      const id = langRow.dataset.tcRow;
      const values = {
        costo: cInput.value,
        margen_min: minInput.value,
        margen_max: maxInput.value,
        moneda: monSel ? monSel.value : 'PEN',
        periodo: perSel ? perSel.value : 'mes',
      };
      saveLanguageCostRow(id, values, langRow, [cInput, minInput, maxInput, monSel, perSel]);
    }
  });
}

function getPlansFromGroupDom(group, fallbackTool) {
  if (!group) return normalizePlans(fallbackTool);
  const planRows = group.querySelectorAll('[data-tc-plan-row]');
  if (!planRows.length) return normalizePlans(fallbackTool);
  return Array.from(planRows).map(pr => {
    const nameInp = pr.querySelector('[data-field="name"]');
    const costInp = pr.querySelector('[data-field="costo"]');
    const minInp = pr.querySelector('[data-field="margen_min"]');
    const maxInp = pr.querySelector('[data-field="margen_max"]');
    const monSel = pr.querySelector('[data-field="moneda"]');
    const perSel = pr.querySelector('[data-field="periodo"]');
    return {
      name: nameInp ? nameInp.value.trim() : '',
      costo: costInp && costInp.value !== '' ? Number(costInp.value) : null,
      margen_min: minInp && minInp.value !== '' ? Number(minInp.value) : null,
      margen_max: maxInp && maxInp.value !== '' ? Number(maxInp.value) : null,
      moneda: monSel ? monSel.value : (fallbackTool.moneda || 'PEN'),
      periodo: perSel ? perSel.value : (fallbackTool.periodo || 'mes'),
    };
  });
}

function collectAndSaveToolPlans(tool, group) {
  tool.plans = getPlansFromGroupDom(group, tool);
  saveToolPlans(tool, group);
}

async function saveToolPlans(tool, group) {
  try {
    const plans = tool.plans || [];
    const payload = {
      costo: plans[0]?.costo ?? null,
      margen_min: plans[0]?.margen_min ?? null,
      margen_max: plans[0]?.margen_max ?? null,
      moneda: plans[0]?.moneda ?? 'PEN',
      periodo: plans[0]?.periodo ?? 'mes',
      plans: plans,
    };
    await api.put(`/technology-catalog/${tool.id}/cost`, payload);
    Object.assign(tool, payload);
    if (group) {
      const planRows = group.querySelectorAll('[data-tc-plan-row]');
      planRows.forEach((pr, i) => {
        const p = plans[i] || {};
        const nameInp = pr.querySelector('[data-field="name"]');
        const costInp = pr.querySelector('[data-field="costo"]');
        const minInp = pr.querySelector('[data-field="margen_min"]');
        const maxInp = pr.querySelector('[data-field="margen_max"]');
        const monSel = pr.querySelector('[data-field="moneda"]');
        const perSel = pr.querySelector('[data-field="periodo"]');
        if (nameInp) nameInp.dataset.initial = p.name ?? '';
        if (costInp) costInp.dataset.initial = p.costo ?? '';
        if (minInp) minInp.dataset.initial = p.margen_min ?? '';
        if (maxInp) maxInp.dataset.initial = p.margen_max ?? '';
        if (monSel) monSel.dataset.initial = p.moneda ?? 'PEN';
        if (perSel) perSel.dataset.initial = p.periodo ?? 'mes';
      });
      group.classList.add('bg-emerald-50/50');
      setTimeout(() => group.classList.remove('bg-emerald-50/50'), 700);
    }
  } catch (err) {
    toast(err.message || 'No se pudieron guardar los planes', 'error');
  }
}

async function saveLanguageCostRow(id, values, row, inputs) {
  try {
    await api.put(`/technology-catalog/${id}/cost`, values);
    if (inputs) {
      if (inputs[0]) inputs[0].dataset.initial = values.costo;
      if (inputs[1]) inputs[1].dataset.initial = values.margen_min;
      if (inputs[2]) inputs[2].dataset.initial = values.margen_max;
      if (inputs[3]) inputs[3].dataset.initial = values.moneda;
      if (inputs[4]) inputs[4].dataset.initial = values.periodo;
    }
    const list = _techCatalog.language || [];
    const item = list.find(x => x.id === id);
    if (item) Object.assign(item, {
      costo: values.costo === '' ? null : Number(values.costo),
      margen_min: values.margen_min === '' ? null : Number(values.margen_min),
      margen_max: values.margen_max === '' ? null : Number(values.margen_max),
      moneda: values.moneda || 'PEN',
      periodo: values.periodo || 'mes',
    });
    row?.classList.add('bg-emerald-50/50');
    setTimeout(() => row?.classList.remove('bg-emerald-50/50'), 700);
  } catch (err) {
    toast(err.message || 'No se pudo guardar el costo', 'error');
  }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
