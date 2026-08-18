import { api }                                         from '../api.js';
import { toast, showModal, closeModal, pageHeader,
         fmtDate, fileIcon, fileSize, spinner, icon,
         previewFile }                                 from '../utils.js';

const CATEGORIES = { general:'General', technical:'Técnico', legal:'Legal',
                     financial:'Financiero', report:'Informe', manual:'Manual', other:'Otro' };

let _docs = [], _projects = [];
let _filter = { project_id: '', category: '', search: '' };
let _debounce;

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="docs-page">${spinner()}</div>`;
  api.get('/projects').then(p => { _projects = p; });
  load();
}

function load() {
  api.get('/documents', _filter).then(data => { _docs = data; renderPage(); });
}

function renderPage() {
  const c = document.getElementById('docs-page');
  if (!c) return;

  const projOpts = _projects.map(p => `<option value="${p.id}" ${_filter.project_id==p.id?'selected':''}>${esc(p.name)}</option>`).join('');
  const catOpts  = Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}" ${_filter.category===k?'selected':''}>${v}</option>`).join('');

  c.innerHTML = `
  ${pageHeader('Documentos',
    `${_docs.length} documento${_docs.length!==1?'s':''}`,
    `<button id="new-doc-btn" class="btn-primary">${icon('add',20)} Subir Documento</button>`)}

  <div class="flex flex-wrap gap-3 mb-5">
    <div class="relative flex-1 min-w-[200px]">
      <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">search</span>
      <input id="search-doc" class="input pl-9" placeholder="Buscar documentos..." value="${esc(_filter.search)}">
    </div>
    <select id="f-project" class="input w-auto"><option value="">Todos los proyectos</option>${projOpts}</select>
    <select id="f-cat" class="input w-auto"><option value="">Todas las categorías</option>${catOpts}</select>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
    ${_docs.length === 0 ? `
      <div class="col-span-4 card p-12 text-center">
        <span class="material-icons text-gray-300" style="font-size:48px">article</span>
        <p class="text-gray-500 mt-3">No se encontraron documentos</p>
      </div>` : _docs.map(docCard).join('')}
  </div>`;

  document.getElementById('new-doc-btn').addEventListener('click', () => openModal());
  document.getElementById('search-doc').addEventListener('input', e => {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => { _filter.search = e.target.value; load(); }, 300);
  });
  document.getElementById('f-project').addEventListener('change', e => { _filter.project_id = e.target.value; load(); });
  document.getElementById('f-cat').addEventListener('change',    e => { _filter.category    = e.target.value; load(); });

  document.querySelectorAll('.del-doc').forEach(btn => btn.addEventListener('click', async () => {
    const d = _docs.find(x => String(x.id) === btn.dataset.id);
    if (!d || !confirm(`¿Eliminar "${d.title}"?`)) return;
    try { await api.delete(`/documents/${d.id}`); toast('Eliminado'); load(); }
    catch { toast('Error', 'error'); }
  }));

  document.querySelectorAll('.preview-doc-btn').forEach(btn => btn.addEventListener('click', async () => {
    try {
      const { url } = await api.get(`/documents/${btn.dataset.id}/file`);
      previewFile(url, btn.dataset.name);
    } catch (err) { toast(err.message || 'Error al abrir el archivo', 'error'); }
  }));
}

function docCard(d) {
  return `
  <div class="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
    <div class="flex items-start justify-between">
      <span class="text-3xl">${fileIcon(d.file_name)}</span>
      <button class="del-doc p-1.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-600" data-id="${d.id}">${icon('delete',16)}</button>
    </div>
    <div class="flex-1">
      <p class="font-medium text-gray-900 text-sm line-clamp-2">${esc(d.title)}</p>
      ${d.description ? `<p class="text-xs text-gray-500 mt-1 line-clamp-2">${esc(d.description)}</p>` : ''}
    </div>
    <div class="space-y-1">
      <div class="flex items-center gap-1 flex-wrap">
        <span class="badge bg-gray-100 text-gray-600">${CATEGORIES[d.category]||d.category}</span>
        ${d.project_name ? `<span class="badge bg-blue-50 text-blue-700 truncate max-w-[120px]">${esc(d.project_name)}</span>` : ''}
      </div>
      ${d.tags ? `<div class="flex items-center gap-1">
        <span class="material-icons text-gray-400" style="font-size:12px">tag</span>
        <span class="text-xs text-gray-400 truncate">${esc(d.tags)}</span>
      </div>` : ''}
      <div class="flex items-center justify-between mt-2">
        <span class="text-xs text-gray-400">${fileSize(d.file_size)} · ${fmtDate(d.created_at,'dd/MM/yy')}</span>
        ${d.file_path ? `<button class="preview-doc-btn flex items-center gap-1 text-xs text-primary-600 hover:underline" data-id="${d.id}" data-name="${esc(d.file_name||d.title)}">${icon('visibility',14)} Ver</button>` : ''}
      </div>
    </div>
  </div>`;
}

function openModal() {
  const projOpts = _projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const catOpts  = Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

  showModal('Subir Documento', `
  <form id="doc-form" class="space-y-4">
    <div>
      <label class="label">Título *</label>
      <input class="input" name="title" required placeholder="Nombre del documento">
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="label">Proyecto</label>
        <select class="input" name="project_id"><option value="">— Sin proyecto —</option>${projOpts}</select>
      </div>
      <div>
        <label class="label">Categoría</label>
        <select class="input" name="category">${catOpts}</select>
      </div>
    </div>
    <div>
      <label class="label">Descripción</label>
      <textarea class="input resize-none" name="description" rows="2" placeholder="Descripción breve..."></textarea>
    </div>
    <div>
      <label class="label">Etiquetas (separadas por comas)</label>
      <input class="input" name="tags" placeholder="ej: urgente, revisado, v2">
    </div>
    <div>
      <label class="label">Archivo</label>
      <input type="file" class="input text-sm py-1.5" name="file">
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1 justify-center">Subir Documento</button>
      <button type="button" id="doc-cancel" class="btn-secondary">Cancelar</button>
    </div>
  </form>`, 'md');

  document.getElementById('doc-cancel').addEventListener('click', closeModal);
  document.getElementById('doc-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!fd.get('file')?.name) fd.delete('file');
    try {
      await api.post('/documents', fd);
      toast('Documento subido');
      closeModal(); load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
