import { api } from '../api.js';
import { toast, icon, spinner, showModal, closeModal, confirmModal } from '../utils.js';

let _stacks = [];
let _activeStack = null;
let _techCatalog = { language: [], tool: [] };
let _role = 'TI'; // 'TI' | 'ADG' | 'ODN'
let _container = null;
let _resizeObserver = null;

const CURRENCY_SYMBOLS = { PEN: 'S/', USD: '$', EUR: '€' };
function getSym(m) { return CURRENCY_SYMBOLS[m] || '$'; }

function thumbUrl(url, size = 64) {
  if (!url) return '';
  if (typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/image/upload/') && !url.includes('/image/upload/w_')) {
    return url.replace('/image/upload/', `/image/upload/w_${size},h_${size},c_fit,f_auto,q_auto/`);
  }
  return url;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export async function initTechStackBuilder(mountEl, options = {}) {
  _container = mountEl;
  _role = options.role || 'TI';
  _container.innerHTML = `<div class="p-8 text-center">${spinner()}</div>`;

  try {
    const [stacks, langs, tools] = await Promise.all([
      api.get('/tech-stacks'),
      api.get('/technology-catalog', { category: 'language' }),
      api.get('/technology-catalog', { category: 'tool' }),
    ]);
    _stacks = Array.isArray(stacks) ? stacks : [];
    _techCatalog = { language: langs || [], tool: tools || [] };

    if (_stacks.length > 0) {
      _activeStack = JSON.parse(JSON.stringify(_stacks[0]));
    } else {
      _activeStack = createEmptyStack('Nuevo Tech Stack', 'Web');
    }

    renderBuilder();
  } catch (err) {
    _container.innerHTML = `
      <div class="text-center py-12 text-gray-400">
        <p class="text-sm">Error al cargar Tech Stacks: ${esc(err.message)}</p>
      </div>`;
  }
}

function createEmptyStack(name, type = 'Web') {
  return {
    id: 'stack_' + Date.now(),
    name: name,
    project_type: type,
    description: '',
    stages: [
      { id: 'stg_1', title: 'HERRAMIENTA', category: 'tool', items: [] },
      { id: 'stg_2', title: 'LENGUAJE', category: 'language', items: [] },
      { id: 'stg_3', title: 'HERRAMIENTA', category: 'tool', items: [] },
      { id: 'stg_4', title: 'PRODUCTO', category: 'product', items: [] },
    ],
    is_quotation: false,
    quotation_margin: 0,
  };
}

function renderBuilder() {
  if (!_container || !_activeStack) return;

  // Garantizar que todos los nodos tengan ID único válido
  (_activeStack.stages || []).forEach((st, sI) => {
    (st.items || []).forEach((it, itI) => {
      if (!it.id) {
        it.id = `node_s${sI}_i${itI}_${Date.now()}`;
      }
    });
  });

  const isTI = (_role === 'TI');
  const stackOptions = _stacks.map(s => `
    <option value="${esc(s.id)}" ${s.id === _activeStack.id ? 'selected' : ''}>
      [${esc(s.project_type || 'Web')}] ${esc(s.name)}${s.is_quotation ? ' 🏷️ (Cotización)' : ''}
    </option>
  `).join('');

  _container.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col h-full min-h-[640px]">
      <!-- Toolbar superior -->
      <div class="p-4 border-b border-gray-100 bg-gray-50/70 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center flex-wrap gap-2.5">
          <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Ramificación:</label>
          <select id="ts-stack-select" class="input py-1.5 px-3 text-xs font-semibold bg-white border-gray-300 rounded-lg shadow-2xs max-w-xs">
            ${stackOptions || '<option value="">(Sin ramificaciones)</option>'}
          </select>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${_activeStack.is_quotation ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}">
            ${esc(_activeStack.project_type || 'Web')}
          </span>
          ${_activeStack.is_quotation ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-white">Cotización ODN</span>' : ''}
        </div>

        <div class="flex items-center flex-wrap gap-2">
          <button type="button" id="ts-btn-new" class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            ${icon('add', 16)} Nueva Ramificación
          </button>
          ${_role === 'ODN' ? `
          <button type="button" id="ts-btn-clone-quote" class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100">
            ${icon('content_copy', 16)} Clonar para Cotización
          </button>` : ''}
          <button type="button" id="ts-btn-add-col" class="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            ${icon('view_column', 16)} + Agregar Columna
          </button>
          <button type="button" id="ts-btn-save" class="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 shadow-sm">
            ${icon('save', 16)} Guardar
          </button>
          <button type="button" id="ts-btn-delete" class="text-xs py-1.5 px-2.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-all" title="Eliminar este Tech Stack">
            ${icon('delete', 16)}
          </button>
        </div>
      </div>

      <!-- Metadatos de la ramificación -->
      <div class="px-5 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center gap-4 text-xs">
        <div class="flex items-center gap-2 flex-1 min-w-[200px]">
          <span class="text-gray-400 font-medium">Nombre:</span>
          <input type="text" id="ts-stack-name" value="${esc(_activeStack.name)}" class="input py-1 px-2.5 text-xs font-semibold w-full max-w-sm" placeholder="Ej: Stack Web React + Node">
        </div>
        <div class="flex items-center gap-2">
          <span class="text-gray-400 font-medium">Tipo:</span>
          <select id="ts-stack-type" class="input py-1 px-2.5 text-xs font-medium">
            <option value="Web" ${_activeStack.project_type === 'Web' ? 'selected' : ''}>Web</option>
            <option value="Móvil" ${_activeStack.project_type === 'Móvil' ? 'selected' : ''}>Móvil (App)</option>
            <option value="API / Backend" ${_activeStack.project_type === 'API / Backend' ? 'selected' : ''}>API / Backend</option>
            <option value="Escritorio" ${_activeStack.project_type === 'Escritorio' ? 'selected' : ''}>Escritorio</option>
            <option value="E-Commerce" ${_activeStack.project_type === 'E-Commerce' ? 'selected' : ''}>E-Commerce</option>
            <option value="Full-Stack" ${_activeStack.project_type === 'Full-Stack' ? 'selected' : ''}>Full-Stack</option>
            <option value="Multi-Plataforma" ${_activeStack.project_type === 'Multi-Plataforma' ? 'selected' : ''}>Multi-Plataforma</option>
            <option value="Otro" ${_activeStack.project_type === 'Otro' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
        ${!isTI ? `
        <div class="text-gray-400 text-[11px] italic ml-auto">
          Los costos y planes son editables por ${esc(_role)}. OTI solo ve la estructura.
        </div>` : `
        <div class="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px] font-medium ml-auto flex items-center gap-1">
          ${icon('lock', 13)} Modo OTI: Estructura técnica (Costos ocultos)
        </div>`}
      </div>

      <!-- Lienzo horizontal con columnas y conexiones SVG -->
      <div class="flex-1 overflow-x-auto overflow-y-auto p-6 bg-slate-50/60 relative select-none min-h-[460px]" id="ts-canvas-container">
        <div id="ts-content-wrapper" class="relative min-w-max inline-block" style="min-height: 100%;">
          <!-- Capa SVG para las líneas de ramificación -->
          <svg id="ts-svg-layer" class="absolute inset-0 pointer-events-none" style="width: 100%; height: 100%; min-width: 100%; min-height: 100%; z-index: 10; overflow: visible;">
            <g id="ts-svg-paths"></g>
          </svg>

          <!-- Columnas del Tech Stack -->
          <div class="flex items-start gap-10 relative" id="ts-columns-wrapper">
            ${(_activeStack.stages || []).map((stage, sIdx) => renderStageColumn(stage, sIdx, isTI)).join('')}
          </div>
        </div>
      </div>

      <!-- Barra inferior de inversión (Visible solo para ADG y ODN; oculta en OTI) -->
      ${!isTI ? renderInvestmentFooter() : ''}
    </div>
  `;

  setupEventListeners();
  updateSvgConnections();
  requestAnimationFrame(() => updateSvgConnections());
  setTimeout(() => updateSvgConnections(), 50);
  setTimeout(() => updateSvgConnections(), 150);
  setTimeout(() => updateSvgConnections(), 400);
  setTimeout(() => updateSvgConnections(), 1000);
}

function renderStageColumn(stage, sIdx, isTI) {
  const items = stage.items || [];
  const isLast = sIdx === (_activeStack.stages.length - 1);

  return `
    <div class="w-64 bg-white/95 backdrop-blur rounded-xl border border-gray-200/90 shadow-sm flex flex-col shrink-0 transition-all hover:border-gray-300" data-stage-index="${sIdx}">
      <!-- Encabezado de Columna -->
      <div class="p-3 border-b border-gray-100 bg-gray-50/80 rounded-t-xl flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-1.5 overflow-hidden flex-1">
          <span class="text-[10px] font-bold text-gray-400 bg-gray-200/70 px-1.5 py-0.5 rounded">C${sIdx + 1}</span>
          <input type="text" class="ts-col-title font-bold text-xs text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:bg-white px-1 py-0.5 rounded transition-all w-full truncate" value="${esc(stage.title)}" data-stage-index="${sIdx}" title="Clic para renombrar columna">
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" class="ts-btn-add-item p-1 rounded hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 text-xs font-bold transition-all" data-stage-index="${sIdx}" title="Añadir tecnología a esta columna">
            ${icon('add_circle', 16)}
          </button>
          ${_activeStack.stages.length > 2 ? `
          <button type="button" class="ts-btn-del-col p-1 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600 text-xs transition-all" data-stage-index="${sIdx}" title="Eliminar columna">
            ${icon('close', 15)}
          </button>` : ''}
        </div>
      </div>

      <!-- Lista de Nodos / Tarjetas en esta columna -->
      <div class="p-3 space-y-3 min-h-[220px] flex-1 flex flex-col justify-start">
        ${items.length === 0 ? `
          <div class="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-gray-200 rounded-lg text-center bg-gray-50/50">
            <span class="text-xs text-gray-400 mb-1.5">Sin tecnologías</span>
            <button type="button" class="ts-btn-add-item text-[11px] text-indigo-600 font-semibold hover:underline" data-stage-index="${sIdx}">+ Añadir elemento</button>
          </div>` :
          items.map((it, itIdx) => renderNodeCard(it, sIdx, itIdx, isTI, isLast)).join('')}
      </div>
    </div>
  `;
}

function renderNodeCard(item, sIdx, itIdx, isTI, isLast) {
  const avatar = item.image_url
    ? `<div class="w-8 h-8 rounded-lg bg-white border border-gray-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs"><img src="${esc(thumbUrl(item.image_url, 64))}" class="max-w-full max-h-full object-contain" alt="${esc(item.name)}"></div>`
    : `<span class="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">${esc((item.name || '?').charAt(0).toUpperCase())}</span>`;

  // Planes disponibles para este item
  const catalogMatch = (_techCatalog.tool || []).concat(_techCatalog.language || []).find(c => c.name.toLowerCase() === (item.name || '').toLowerCase());
  const plans = (catalogMatch && Array.isArray(catalogMatch.plans) && catalogMatch.plans.length)
    ? catalogMatch.plans
    : [{ name: 'Free / Gratis', costo: 0, moneda: 'USD', periodo: 'mes' }];

  const currentPlan = item.plan_name || 'Free';
  const sym = getSym(item.moneda || 'USD');
  const costNum = Number(item.costo) || 0;
  const costLabel = costNum === 0 ? 'Gratis' : `${sym} ${costNum.toFixed(2)} / ${item.periodo === 'año' ? 'año' : 'mes'}`;

  // Next column targets options
  const nextStage = _activeStack.stages[sIdx + 1];
  const nextItems = nextStage ? (nextStage.items || []) : [];
  const targets = Array.isArray(item.targets) ? item.targets : [];

  return `
    <div class="ts-node-card bg-white border border-gray-200/90 rounded-xl p-3 shadow-2xs hover:shadow-md transition-all relative flex flex-col gap-2 group cursor-default" id="${esc(item.id)}" data-stage-index="${sIdx}" data-item-index="${itIdx}">
      <!-- Conectores visuales izquierdo y derecho -->
      <div class="ts-port-in absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-2xs z-30 flex items-center justify-center ${sIdx === 0 ? 'hidden' : ''}" title="Entrada de ramificación">
        <div class="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
      </div>
      <div class="ts-port-out absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 shadow-2xs z-30 flex items-center justify-center ${isLast ? 'hidden' : ''}" title="Salida de ramificación">
        <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
      </div>

      <!-- Cabecera de la tarjeta -->
      <div class="flex items-center gap-2">
        ${avatar}
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-gray-800 truncate">${esc(item.name)}</h4>
          <span class="text-[10px] text-gray-400 capitalize">${esc(item.category || 'tecnología')}</span>
        </div>
        <button type="button" class="ts-btn-del-item text-gray-300 hover:text-rose-500 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" data-stage-index="${sIdx}" data-item-index="${itIdx}" title="Quitar de este stack">
          ${icon('close', 14)}
        </button>
      </div>

      <!-- Selector de Plan y Precio -->
      <div class="pt-1.5 border-t border-gray-100 flex items-center justify-between gap-1 text-[11px]">
        ${!isTI ? `
        <!-- ADG / ODN: Plan selector y Costo visible -->
        <div class="flex items-center gap-1.5 flex-1 min-w-0">
          <select class="ts-card-plan text-[11px] py-1 px-1.5 bg-gray-50 border border-gray-200 rounded font-medium text-gray-700 w-full truncate focus:bg-white focus:border-indigo-400 focus:outline-none" data-stage-index="${sIdx}" data-item-index="${itIdx}">
            ${plans.map(p => `
              <option value="${esc(p.name)}" ${p.name === currentPlan ? 'selected' : ''}>
                ${esc(p.name)} (${getSym(p.moneda || 'USD')} ${Number(p.costo || 0).toFixed(2)})
              </option>
            `).join('')}
          </select>
        </div>
        <span class="font-bold text-[10.5px] px-2 py-0.5 rounded ${costNum === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-800'} shrink-0 whitespace-nowrap">
          ${costLabel}
        </span>` : `
        <!-- OTI: Plan visible pero costos 100% ocultos -->
        <div class="flex items-center gap-1.5 flex-1">
          <span class="text-gray-400 text-[10.5px]">Plan:</span>
          <select class="ts-card-plan text-[11px] py-1 px-1.5 bg-gray-50 border border-gray-200 rounded font-medium text-gray-700 w-full truncate focus:bg-white focus:border-indigo-400 focus:outline-none" data-stage-index="${sIdx}" data-item-index="${itIdx}">
            ${plans.map(p => `
              <option value="${esc(p.name)}" ${p.name === currentPlan ? 'selected' : ''}>
                ${esc(p.name)}
              </option>
            `).join('')}
          </select>
        </div>`}
      </div>

      <!-- Enlace a nodos de la siguiente columna (si no es la última) -->
      ${!isLast && nextItems.length > 0 ? `
      <div class="mt-1 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[10.5px] text-gray-500">
        <button type="button" class="ts-btn-toggle-targets flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold" data-stage-index="${sIdx}" data-item-index="${itIdx}">
          ${icon('alt_route', 13)}
          <span>Ramificar a (${targets.length ? targets.length : 'Todos'})</span>
        </button>
      </div>` : ''}
    </div>
  `;
}

function renderInvestmentFooter() {
  const totals = { USD: 0, PEN: 0, EUR: 0 };
  let itemCount = 0;

  (_activeStack.stages || []).forEach(stage => {
    (stage.items || []).forEach(it => {
      itemCount++;
      const c = Number(it.costo) || 0;
      const m = it.moneda || 'USD';
      if (totals[m] !== undefined) totals[m] += c;
      else totals.USD += c;
    });
  });

  return `
    <div class="p-4 border-t border-gray-200/90 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
          ${icon('payments', 18)}
        </div>
        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-gray-300">Costo Total de Inversión</h4>
          <p class="text-[11px] text-gray-400">${itemCount} tecnologías en este Tech Stack</p>
        </div>
      </div>

      <div class="flex items-center flex-wrap gap-3">
        <div class="bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-2xs">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dólares:</span>
          <span class="text-sm font-extrabold text-emerald-400 font-mono">$ ${totals.USD.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-2xs">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Soles:</span>
          <span class="text-sm font-extrabold text-sky-400 font-mono">S/ ${totals.PEN.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="bg-slate-800/90 border border-slate-700/80 px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-2xs">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Euros:</span>
          <span class="text-sm font-extrabold text-amber-400 font-mono">€ ${totals.EUR.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  `;
}

const STAGE_LINE_COLORS = [
  '#6366f1', // Indigo (Col 1 -> Col 2)
  '#3b82f6', // Blue   (Col 2 -> Col 3)
  '#0ea5e9', // Sky    (Col 3 -> Col 4)
  '#10b981', // Emerald (Col 4 -> Col 5)
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
];

function updateSvgConnections() {
  const svgGroup = document.getElementById('ts-svg-paths');
  const svgLayer = document.getElementById('ts-svg-layer');
  const colsWrapper = document.getElementById('ts-columns-wrapper');
  const wrapper = document.getElementById('ts-content-wrapper') || colsWrapper || document.getElementById('ts-canvas-container');
  if (!svgGroup || !svgLayer || !colsWrapper || !wrapper || !_activeStack) return;

  // 1. Sincronizar dimensiones explícitas del SVG en píxeles (para que nunca colapse a 0)
  const w = Math.max(colsWrapper.scrollWidth, colsWrapper.offsetWidth, wrapper.scrollWidth || 0, 1200);
  const h = Math.max(colsWrapper.scrollHeight, colsWrapper.offsetHeight, wrapper.scrollHeight || 0, 650);
  svgLayer.setAttribute('width', w);
  svgLayer.setAttribute('height', h);
  svgLayer.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgLayer.style.width = w + 'px';
  svgLayer.style.height = h + 'px';
  svgLayer.style.position = 'absolute';
  svgLayer.style.top = '0px';
  svgLayer.style.left = '0px';
  svgLayer.style.zIndex = '10';
  svgLayer.style.pointerEvents = 'none';
  svgLayer.style.overflow = 'visible';

  svgGroup.innerHTML = '';
  const wrapperRect = wrapper.getBoundingClientRect();
  const stages = _activeStack.stages || [];

  for (let s = 0; s < stages.length - 1; s++) {
    const currentStage = stages[s];
    const nextStage = stages[s + 1];
    const nextItems = nextStage.items || [];
    if (!nextItems.length) continue;

    const lineColor = STAGE_LINE_COLORS[s % STAGE_LINE_COLORS.length];
    const nextItemIds = new Set(nextItems.map(it => it.id));

    (currentStage.items || []).forEach(sourceItem => {
      const sourceEl = document.getElementById(sourceItem.id);
      if (!sourceEl) return;
      const sPort = sourceEl.querySelector('.ts-port-out');
      const sRect = (sPort || sourceEl).getBoundingClientRect();

      const x1 = (sPort ? (sRect.left + sRect.width / 2) : sRect.right) - wrapperRect.left;
      const y1 = (sRect.top + sRect.height / 2) - wrapperRect.top;

      let validTargets = (Array.isArray(sourceItem.targets) && sourceItem.targets.length)
        ? sourceItem.targets.filter(tid => nextItemIds.has(tid))
        : [];
      if (validTargets.length === 0 && nextItems.length > 0) {
        validTargets = nextItems.map(it => it.id);
      }

      validTargets.forEach(targetId => {
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;
        const tPort = targetEl.querySelector('.ts-port-in');
        const tRect = (tPort || targetEl).getBoundingClientRect();

        const x2 = (tPort ? (tRect.left + tRect.width / 2) : tRect.left) - wrapperRect.left;
        const y2 = (tRect.top + tRect.height / 2) - wrapperRect.top;

        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return;
        if (x1 === 0 && y1 === 0 && x2 === 0 && y2 === 0) return;

        // Curva Bezier estética punto a punto (de círculo verde a círculo púrpura)
        const dx = Math.max(20, (x2 - x1) * 0.5);
        const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        // Línea principal continua y bien visible
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', pathData);
        pathEl.setAttribute('stroke', lineColor);
        pathEl.setAttribute('stroke-width', '3.5');
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('opacity', '0.95');
        pathEl.style.filter = 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.12))';
        pathEl.setAttribute('data-source', sourceItem.id);
        pathEl.setAttribute('data-target', targetId);
        svgGroup.appendChild(pathEl);
      });
    });
  }
}

function setupEventListeners() {
  if (!_container) return;

  // Re-dibujar líneas en scroll y resize
  const canvas = document.getElementById('ts-canvas-container');
  if (canvas) {
    canvas.addEventListener('scroll', () => updateSvgConnections(), { passive: true });
  }
  window.addEventListener('resize', () => updateSvgConnections(), { passive: true });

  // Observer de redimensión para recalcular ante cambios de tamaño de tarjetas o carga de fuentes/imágenes
  const colsWrapper = document.getElementById('ts-columns-wrapper');
  if (window.ResizeObserver && colsWrapper) {
    if (_resizeObserver) _resizeObserver.disconnect();
    _resizeObserver = new ResizeObserver(() => {
      updateSvgConnections();
    });
    _resizeObserver.observe(colsWrapper);
  }

  // Interacción hover: resaltar conexiones al pasar el mouse por una tarjeta
  _container.querySelectorAll('.ts-node-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const nodeId = card.id;
      const paths = _container.querySelectorAll('#ts-svg-paths [data-source], #ts-svg-paths [data-target]');
      paths.forEach(el => {
        const isConnected = (el.getAttribute('data-source') === nodeId || el.getAttribute('data-target') === nodeId);
        if (isConnected) {
          el.setAttribute('stroke-width', '4.5');
          el.setAttribute('opacity', '1');
        } else {
          el.setAttribute('opacity', '0.15');
        }
      });
    });
    card.addEventListener('mouseleave', () => {
      const paths = _container.querySelectorAll('#ts-svg-paths [data-source], #ts-svg-paths [data-target]');
      paths.forEach(el => {
        el.setAttribute('stroke-width', '3.5');
        el.setAttribute('opacity', '0.95');
      });
    });
  });

  // Re-dibujar al cargar imágenes
  _container.querySelectorAll('img').forEach(img => {
    if (!img.complete) {
      img.addEventListener('load', () => updateSvgConnections(), { once: true });
    }
  });

  // 1. Selector de Stack
  const stackSelect = document.getElementById('ts-stack-select');
  if (stackSelect) {
    stackSelect.addEventListener('change', e => {
      const selected = _stacks.find(s => s.id === e.target.value);
      if (selected) {
        _activeStack = JSON.parse(JSON.stringify(selected));
        renderBuilder();
      }
    });
  }

  // 2. Nombre del Stack
  const nameInput = document.getElementById('ts-stack-name');
  if (nameInput) {
    nameInput.addEventListener('input', e => {
      _activeStack.name = e.target.value;
    });
  }

  // 3. Tipo de proyecto
  const typeSelect = document.getElementById('ts-stack-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', e => {
      _activeStack.project_type = e.target.value;
    });
  }

  // 4. Renombrar columna
  _container.querySelectorAll('.ts-col-title').forEach(inp => {
    inp.addEventListener('input', e => {
      const sIdx = Number(e.target.dataset.stageIndex);
      if (_activeStack.stages[sIdx]) {
        _activeStack.stages[sIdx].title = e.target.value;
      }
    });
  });

  // 5. Botón + Agregar Columna
  const addColBtn = document.getElementById('ts-btn-add-col');
  if (addColBtn) {
    addColBtn.addEventListener('click', () => {
      const nextNum = _activeStack.stages.length + 1;
      _activeStack.stages.push({
        id: 'stg_' + Date.now(),
        title: 'HERRAMIENTA',
        category: 'tool',
        items: []
      });
      renderBuilder();
    });
  }

  // 6. Botón Eliminar Columna
  _container.querySelectorAll('.ts-btn-del-col').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sIdx = Number(btn.dataset.stageIndex);
      const stage = _activeStack.stages[sIdx];
      if (stage.items && stage.items.length > 0) {
        const ok = await confirmModal(`¿Eliminar la columna "${stage.title}" con ${stage.items.length} elemento(s)?`);
        if (!ok) return;
      }
      _activeStack.stages.splice(sIdx, 1);
      renderBuilder();
    });
  });

  // 7. Botón + Añadir elemento a una columna
  _container.querySelectorAll('.ts-btn-add-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sIdx = Number(btn.dataset.stageIndex);
      openAddTechnologyModal(sIdx);
    });
  });

  // 8. Botón Quitar elemento de una columna
  _container.querySelectorAll('.ts-btn-del-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sIdx = Number(btn.dataset.stageIndex);
      const itIdx = Number(btn.dataset.itemIndex);
      _activeStack.stages[sIdx].items.splice(itIdx, 1);
      renderBuilder();
    });
  });

  // 9. Cambio de plan en tarjeta (ADG / ODN / OTI)
  _container.querySelectorAll('.ts-card-plan').forEach(sel => {
    sel.addEventListener('change', e => {
      const sIdx = Number(sel.dataset.stageIndex);
      const itIdx = Number(sel.dataset.itemIndex);
      const planName = e.target.value;
      const item = _activeStack.stages[sIdx].items[itIdx];
      item.plan_name = planName;

      // Buscar costos del plan seleccionado en el catálogo
      const catalogMatch = (_techCatalog.tool || []).concat(_techCatalog.language || []).find(c => c.name.toLowerCase() === (item.name || '').toLowerCase());
      if (catalogMatch && Array.isArray(catalogMatch.plans)) {
        const pObj = catalogMatch.plans.find(p => p.name === planName);
        if (pObj) {
          item.costo = pObj.costo ?? 0;
          item.moneda = pObj.moneda || 'USD';
          item.periodo = pObj.periodo || 'mes';
        }
      }
      renderBuilder();
    });
  });

  // 10. Ramificar a... (Selección de nodos destino)
  _container.querySelectorAll('.ts-btn-toggle-targets').forEach(btn => {
    btn.addEventListener('click', () => {
      const sIdx = Number(btn.dataset.stageIndex);
      const itIdx = Number(btn.dataset.itemIndex);
      openBranchingModal(sIdx, itIdx);
    });
  });

  // 11. Botón Guardar
  const saveBtn = document.getElementById('ts-btn-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await saveActiveStack();
    });
  }

  // 12. Botón Nueva Ramificación
  const newBtn = document.getElementById('ts-btn-new');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      openNewStackModal(false);
    });
  }

  // 13. Botón Clonar para Cotización (ODN)
  const cloneBtn = document.getElementById('ts-btn-clone-quote');
  if (cloneBtn) {
    cloneBtn.addEventListener('click', () => {
      openNewStackModal(true);
    });
  }

  // 14. Botón Eliminar Stack
  const delBtn = document.getElementById('ts-btn-delete');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const ok = await confirmModal(`¿Eliminar la ramificación "${_activeStack.name}"?`);
      if (!ok) return;
      try {
        await api.delete(`/tech-stacks/${_activeStack.id}`);
        toast('Ramificación eliminada');
        _stacks = _stacks.filter(s => s.id !== _activeStack.id);
        _activeStack = _stacks[0] || createEmptyStack('Nuevo Tech Stack', 'Web');
        renderBuilder();
      } catch (err) {
        toast(err.message || 'Error al eliminar', 'error');
      }
    });
  }
}

function openAddTechnologyModal(stageIndex) {
  const stage = _activeStack.stages[stageIndex];
  const allTechs = (_techCatalog.tool || []).concat(_techCatalog.language || []);

  showModal(`Añadir a Columna: ${stage.title}`, `
    <div class="space-y-4">
      <div class="relative">
        <input type="text" id="ts-tech-search" class="input py-2 pl-9 pr-3 text-xs w-full" placeholder="Buscar tecnología (ej: React, Docker, Python, Vercel...)">
        <span class="absolute left-3 top-2.5 text-gray-400">${icon('search', 16)}</span>
      </div>

      <div class="flex items-center gap-2 text-xs border-b border-gray-100 pb-2">
        <button type="button" class="ts-picker-tab font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded" data-filter="all">Todos (${allTechs.length})</button>
        <button type="button" class="ts-picker-tab font-medium text-gray-500 hover:text-gray-800 px-2.5 py-1 rounded" data-filter="tool">Herramientas (${_techCatalog.tool.length})</button>
        <button type="button" class="ts-picker-tab font-medium text-gray-500 hover:text-gray-800 px-2.5 py-1 rounded" data-filter="language">Lenguajes (${_techCatalog.language.length})</button>
      </div>

      <div class="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl" id="ts-tech-list">
        ${allTechs.map(t => techItemRowHtml(t)).join('')}
      </div>
    </div>
  `, 'md');

  const searchInput = document.getElementById('ts-tech-search');
  const techList = document.getElementById('ts-tech-list');

  let currentCategory = 'all';
  function filterList() {
    const q = (searchInput?.value || '').trim().toLowerCase();
    const rows = techList.querySelectorAll('[data-tech-id]');
    rows.forEach(r => {
      const name = (r.dataset.name || '').toLowerCase();
      const cat = r.dataset.category || '';
      const matchCat = (currentCategory === 'all' || cat === currentCategory);
      const matchQ = !q || name.includes(q);
      r.style.display = (matchCat && matchQ) ? '' : 'none';
    });
  }

  searchInput?.addEventListener('input', filterList);
  document.querySelectorAll('.ts-picker-tab').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.ts-picker-tab').forEach(x => {
        x.classList.remove('font-semibold', 'text-indigo-600', 'bg-indigo-50');
        x.classList.add('font-medium', 'text-gray-500');
      });
      b.classList.add('font-semibold', 'text-indigo-600', 'bg-indigo-50');
      b.classList.remove('font-medium', 'text-gray-500');
      currentCategory = b.dataset.filter;
      filterList();
    });
  });

  techList.addEventListener('click', e => {
    const row = e.target.closest('[data-tech-id]');
    if (!row) return;
    const techId = row.dataset.techId;
    const tech = allTechs.find(t => t.id === techId);
    if (!tech) return;

    // Agregar al stage
    const defaultPlan = (Array.isArray(tech.plans) && tech.plans[0]) ? tech.plans[0] : null;
    const newItem = {
      id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      tech_id: tech.id,
      name: tech.name,
      category: tech.category || 'tool',
      image_url: tech.image_url || '',
      plan_name: defaultPlan ? defaultPlan.name : 'Free',
      costo: defaultPlan ? (defaultPlan.costo || 0) : 0,
      moneda: defaultPlan ? (defaultPlan.moneda || 'USD') : 'USD',
      periodo: defaultPlan ? (defaultPlan.periodo || 'mes') : 'mes',
      targets: []
    };

    _activeStack.stages[stageIndex].items.push(newItem);
    closeModal();
    renderBuilder();
  });
}

function techItemRowHtml(t) {
  const avatar = t.image_url
    ? `<div class="w-7 h-7 rounded bg-white border border-gray-200 p-0.5 flex items-center justify-center shrink-0"><img src="${esc(thumbUrl(t.image_url, 64))}" class="max-w-full max-h-full object-contain"></div>`
    : `<span class="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">${esc((t.name || '?').charAt(0))}</span>`;
  return `
    <div class="p-2.5 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-3 transition-colors" data-tech-id="${esc(t.id)}" data-name="${esc(t.name)}" data-category="${esc(t.category)}">
      <div class="flex items-center gap-2.5">
        ${avatar}
        <div>
          <h5 class="text-xs font-bold text-gray-800">${esc(t.name)}</h5>
          <span class="text-[10.5px] text-gray-400 capitalize">${esc(t.category)}</span>
        </div>
      </div>
      <button type="button" class="btn-secondary text-[11px] py-1 px-2.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50">Seleccionar</button>
    </div>
  `;
}

function openBranchingModal(stageIndex, itemIndex) {
  const item = _activeStack.stages[stageIndex].items[itemIndex];
  const nextStage = _activeStack.stages[stageIndex + 1];
  if (!nextStage) return;
  const nextItems = nextStage.items || [];
  const currentTargets = new Set(item.targets || []);

  showModal(`Ramificaciones desde: ${item.name}`, `
    <div class="space-y-3">
      <p class="text-xs text-gray-500">Selecciona hacia cuáles tecnologías de la columna <strong>${esc(nextStage.title)}</strong> se ramifica este elemento:</p>
      
      <div class="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
        ${nextItems.map(it => `
          <label class="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-gray-200/80 hover:border-indigo-300 cursor-pointer transition-all">
            <input type="checkbox" class="ts-target-chk w-4 h-4 text-indigo-600 rounded" value="${esc(it.id)}" ${currentTargets.has(it.id) || currentTargets.size === 0 ? 'checked' : ''}>
            <span class="text-xs font-bold text-gray-800 flex-1">${esc(it.name)}</span>
            <span class="text-[10px] text-gray-400 capitalize">${esc(it.category)}</span>
          </label>
        `).join('')}
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button type="button" id="ts-btn-target-all" class="btn-secondary text-xs py-1.5 px-3">Conectar a Todos</button>
        <button type="button" id="ts-btn-target-apply" class="btn-primary text-xs py-1.5 px-4">Aplicar</button>
      </div>
    </div>
  `, 'sm');

  document.getElementById('ts-btn-target-all')?.addEventListener('click', () => {
    document.querySelectorAll('.ts-target-chk').forEach(c => c.checked = true);
  });

  document.getElementById('ts-btn-target-apply')?.addEventListener('click', () => {
    const selected = [];
    document.querySelectorAll('.ts-target-chk:checked').forEach(c => selected.push(c.value));
    item.targets = selected;
    closeModal();
    renderBuilder();
  });
}

function openNewStackModal(isQuotation = false) {
  showModal(isQuotation ? 'Clonar para Cotización' : 'Nueva Ramificación / Tech Stack', `
    <div class="space-y-4">
      <div>
        <label class="block text-xs font-bold text-gray-700 mb-1">Nombre de la Ramificación:</label>
        <input type="text" id="ts-new-name" class="input w-full py-2 px-3 text-xs font-semibold" placeholder="Ej: Stack E-Commerce Serverless" value="${isQuotation ? esc(_activeStack.name + ' (Cotización)') : ''}">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-700 mb-1">Tipo de Proyecto / Solución:</label>
        <select id="ts-new-type" class="input w-full py-2 px-3 text-xs font-medium">
          <option value="Web">Web</option>
          <option value="Móvil">Móvil (App)</option>
          <option value="API / Backend">API / Backend</option>
          <option value="Escritorio">Escritorio</option>
          <option value="E-Commerce">E-Commerce</option>
          <option value="Full-Stack">Full-Stack</option>
          <option value="Multi-Plataforma">Multi-Plataforma</option>
          <option value="Otro">Otro</option>
        </select>
      </div>

      <p class="text-xs text-gray-500">
        ${isQuotation
          ? 'Se duplicará la estructura actual permitiendo a ODN ajustar planes y precios para la propuesta comercial.'
          : 'Se creará una nueva ramificación lista para añadir columnas, lenguajes y herramientas.'}
      </p>

      <div class="flex justify-end gap-2 pt-2">
        <button type="button" id="ts-new-cancel" class="btn-secondary text-xs py-1.5 px-3">Cancelar</button>
        <button type="button" id="ts-new-confirm" class="btn-primary text-xs py-1.5 px-4">Crear</button>
      </div>
    </div>
  `, 'sm');

  document.getElementById('ts-new-cancel')?.addEventListener('click', closeModal);
  document.getElementById('ts-new-confirm')?.addEventListener('click', async () => {
    const name = document.getElementById('ts-new-name')?.value.trim();
    const type = document.getElementById('ts-new-type')?.value;
    if (!name) { toast('Ingresa un nombre para el Tech Stack', 'warning'); return; }

    const stages = isQuotation ? JSON.parse(JSON.stringify(_activeStack.stages)) : [
      { id: 'stg_1', title: 'HERRAMIENTA', category: 'tool', items: [] },
      { id: 'stg_2', title: 'LENGUAJE', category: 'language', items: [] },
      { id: 'stg_3', title: 'HERRAMIENTA', category: 'tool', items: [] },
      { id: 'stg_4', title: 'PRODUCTO', category: 'product', items: [] },
    ];

    try {
      const created = await api.post('/tech-stacks', {
        name,
        project_type: type,
        stages,
        is_quotation: isQuotation,
      });
      _stacks.push(created);
      _activeStack = JSON.parse(JSON.stringify(created));
      closeModal();
      toast('Tech Stack creado exitosamente');
      renderBuilder();
    } catch (err) {
      toast(err.message || 'Error al crear Tech Stack', 'error');
    }
  });
}

async function saveActiveStack() {
  if (!_activeStack) return;
  try {
    await api.put(`/tech-stacks/${_activeStack.id}`, {
      name: _activeStack.name,
      project_type: _activeStack.project_type,
      stages: _activeStack.stages,
      is_quotation: _activeStack.is_quotation,
      quotation_margin: _activeStack.quotation_margin,
    });
    const idx = _stacks.findIndex(s => s.id === _activeStack.id);
    if (idx !== -1) _stacks[idx] = JSON.parse(JSON.stringify(_activeStack));
    toast('Tech Stack guardado exitosamente');
    renderBuilder();
  } catch (err) {
    toast(err.message || 'Error al guardar Tech Stack', 'error');
  }
}
