import { api }     from '../api.js';
import { pageHeader, spinner } from '../utils.js';
import { initTechStackBuilder } from '../components/tech-stack-builder.js?v=10';

let _techCatalog = { language: [], tool: [] };
let _currentTab = 'stack'; // 'stack' | 'catalog'

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="herramientas-page">${spinner()}</div>`;
  load();
}

function load() {
  Promise.all([
    api.get('/technology-catalog', { category: 'language' }),
    api.get('/technology-catalog', { category: 'tool' }),
  ]).then(([langs, tools]) => {
    _techCatalog = { language: langs || [], tool: tools || [] };
    renderPage();
  }).catch(() => {
    const c = document.getElementById('herramientas-page');
    if (c) c.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar las herramientas</p>';
  });
}

function renderPage() {
  const c = document.getElementById('herramientas-page');
  if (!c) return;

  c.innerHTML = `
    ${pageHeader('Herramientas & Tech Stack', 'Diseño de ramificaciones de tecnología y catálogo de herramientas')}
    
    <!-- Pestañas -->
    <div class="flex items-center gap-3 border-b border-gray-200 mb-6">
      <button type="button" id="tab-btn-stack" class="pb-3 px-3 text-sm font-semibold transition-colors flex items-center gap-2 ${_currentTab === 'stack' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}">
        <span class="text-base">🌳</span> Tech Stack (Ramificaciones)
      </button>
      <button type="button" id="tab-btn-catalog" class="pb-3 px-3 text-sm font-semibold transition-colors flex items-center gap-2 ${_currentTab === 'catalog' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}">
        <span class="text-base">📋</span> Catálogo de Herramientas
      </button>
    </div>

    <div id="tab-content-container"></div>
  `;

  document.getElementById('tab-btn-stack')?.addEventListener('click', () => switchTab('stack'));
  document.getElementById('tab-btn-catalog')?.addEventListener('click', () => switchTab('catalog'));

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
    initTechStackBuilder(document.getElementById('tech-stack-mount'), { role: 'TI' });
  } else {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${techColumn('Lenguajes', 'language')}
        ${techColumn('Herramientas', 'tool')}
      </div>`;
  }
}

function techColumn(label, category) {
  const items = _techCatalog[category] || [];
  return `
  <div class="card p-5">
    <h3 class="font-semibold text-gray-900 mb-3">${label}</h3>
    <div class="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
      ${items.length === 0
        ? '<p class="text-xs text-gray-400 py-3 text-center">Sin registrar</p>'
        : items.map(techRow).join('')}
    </div>
  </div>`;
}

function thumbUrl(url, size = 64) {
  if (!url) return '';
  if (url.includes('res.cloudinary.com') && url.includes('/image/upload/')) {
    return url.replace('/image/upload/', `/image/upload/w_${size},h_${size},c_fit,f_auto,q_auto/`);
  }
  return url;
}

function techRow(t) {
  const avatar = t.image_url
    ? `<div class="w-7 h-7 rounded-md bg-white border border-gray-200/80 p-0.5 flex items-center justify-center shrink-0 shadow-2xs"><img src="${thumbUrl(t.image_url, 64)}" width="24" height="24" loading="lazy" decoding="async" class="max-w-full max-h-full object-contain" alt="${esc(t.name)}"></div>`
    : `<span class="w-7 h-7 rounded-md bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  return `
  <div class="flex items-center gap-3 py-2.5">
    ${avatar}
    <p class="text-sm text-gray-800 flex-1 truncate">${esc(t.name)}</p>
  </div>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
