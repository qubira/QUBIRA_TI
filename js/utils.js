// ─── Toast ───────────────────────────────────────────────────────────────────
export function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  const el = document.createElement('div');
  el.className = `toast ${colors[type] || colors.success} text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ─── Icons ────────────────────────────────────────────────────────────────────
export function icon(name, size = 20) {
  return `<span class="material-icons" style="font-size:${size}px;line-height:1">${name}</span>`;
}

// ─── Date ─────────────────────────────────────────────────────────────────────
function safeParse(s) {
  if (!s) return null;
  const iso = typeof s === 'string' ? s.replace(' ', 'T') : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(s, fmt = 'dd/MM/yyyy') {
  const d = safeParse(s);
  if (!d) return '—';
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  const yy  = String(d.getFullYear()).slice(-2);
  const yyyy = d.getFullYear();
  const HH  = String(d.getHours()).padStart(2, '0');
  const MM  = String(d.getMinutes()).padStart(2, '0');
  if (fmt === 'dd/MM/yyyy HH:mm') return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
  if (fmt === 'dd/MM HH:mm')      return `${dd}/${mm} ${HH}:${MM}`;
  if (fmt === 'dd/MM/yy')         return `${dd}/${mm}/${yy}`;
  return `${dd}/${mm}/${yyyy}`;
}

export function fmtDateTime(s) { return fmtDate(s, 'dd/MM/yyyy HH:mm'); }

const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIA = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

export function fmtRelative(s) {
  const d = safeParse(s);
  if (!d) return '—';
  const HH = String(d.getHours()).padStart(2,'0');
  const MM = String(d.getMinutes()).padStart(2,'0');
  return `${d.getDate()} de ${MES[d.getMonth()]}, ${d.getFullYear()} a las ${HH}:${MM}`;
}

export function todayStr() {
  const d = new Date();
  return `${DIA[d.getDay()]} ${d.getDate()} de ${MES[d.getMonth()]}, ${d.getFullYear()}`;
}

// ─── Badges ───────────────────────────────────────────────────────────────────
const PS = {
  pending:        ['Pendiente',        'bg-yellow-100 text-yellow-800'],
  active:         ['Activo',           'bg-green-100 text-green-800'],
  finished_by_ti: ['Por revisar',      'bg-purple-100 text-purple-800'],
  completed:      ['Completado',       'bg-blue-100 text-blue-800'],
  cancelled:      ['Cancelado',        'bg-red-100 text-red-800'],
  paused:         ['Pausado',          'bg-gray-100 text-gray-700'],
};
const CS = {
  draft:    ['Borrador',  'bg-gray-100 text-gray-700'],
  sent:     ['Enviado',   'bg-blue-100 text-blue-800'],
  signed:   ['Firmado',   'bg-green-100 text-green-800'],
  rejected: ['Rechazado', 'bg-red-100 text-red-800'],
  approved: ['Aprobado',  'bg-emerald-100 text-emerald-800'],
};
const PR = {
  low:    ['Baja',    'bg-gray-100 text-gray-600'],
  medium: ['Media',   'bg-yellow-100 text-yellow-700'],
  high:   ['Alta',    'bg-orange-100 text-orange-700'],
  urgent: ['Urgente', 'bg-red-100 text-red-700'],
};

function badge(map, key) {
  const [label, cls] = map[key] || [key, 'bg-gray-100 text-gray-700'];
  return `<span class="badge ${cls}">${label}</span>`;
}

export const projectStatusBadge  = k => badge(PS, k);
export const contractStatusBadge = k => badge(CS, k);
export const priorityBadge       = k => badge(PR, k);

// ─── Vencimiento ──────────────────────────────────────────────────────────────
export function isOverdue(p) {
  if (!p.end_date || p.status === 'completed' || p.status === 'cancelled') return false;
  return p.end_date < new Date().toISOString().slice(0, 10);
}
export function overdueBadge() {
  return `<span class="badge bg-red-100 text-red-700">Vencido</span>`;
}

// ─── Money ────────────────────────────────────────────────────────────────────
export function fmtMoney(v) {
  return v != null ? `$${Number(v).toLocaleString('es-EC', { minimumFractionDigits: 2 })}` : '$0.00';
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function spinner() {
  return `<div class="flex items-center justify-center py-16">
    <div class="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
  </div>`;
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function pageHeader(title, subtitle, actionsHtml = '') {
  return `<div class="flex items-center justify-between mb-5">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">${title}</h1>
      ${subtitle ? `<p class="text-sm text-gray-500 mt-0.5">${subtitle}</p>` : ''}
    </div>
    <div class="flex gap-2">${actionsHtml}</div>
  </div>`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
const SIZE = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '2xl': 'max-w-6xl' };

export function showModal(title, content, size = 'md', footer = '') {
  const c = document.getElementById('modal-container');
  c.innerHTML = `
    <div id="modal-overlay" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full ${SIZE[size] || SIZE.md} max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 class="font-semibold text-gray-900 text-lg">${title}</h3>
          <button id="modal-close-btn" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xl leading-none">&times;</button>
        </div>
        <div class="overflow-y-auto flex-1 px-6 py-4">${content}</div>
        ${footer ? `<div class="px-6 py-4 border-t border-gray-100 shrink-0">${footer}</div>` : ''}
      </div>
    </div>`;
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
}

export function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
}

// ─── Vista previa de archivos (sin descargar) ──────────────────────────────────
export function previewFile(url, filename) {
  const safeName = (filename || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const ext = (filename || url || '').split('.').pop()?.toLowerCase().split('?')[0];
  const isImage = ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
  const isPdf = ext === 'pdf';
  const isWord = ext === 'docx';
  const isSheet = ext === 'xlsx' || ext === 'xls';

  const c = document.getElementById('modal-container');
  c.innerHTML = `
    <div id="modal-overlay" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-6 py-3 border-b border-gray-100 shrink-0">
          <h3 class="font-semibold text-gray-900 text-sm truncate">${safeName || 'Vista previa'}</h3>
          <div class="flex items-center gap-2 shrink-0">
            <a href="${url}" target="_blank" class="btn-secondary text-xs py-1.5">${icon('download',14)} Descargar</a>
            <button id="modal-close-btn" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-xl leading-none">&times;</button>
          </div>
        </div>
        <div class="flex-1 bg-gray-100 overflow-auto" id="preview-body">
          <div class="w-full h-full flex items-center justify-center">
            ${isImage
              ? `<img src="${url}" class="max-w-full max-h-full object-contain">`
              : isPdf
                ? `<iframe src="${url}" class="w-full h-full border-0"></iframe>`
                : isWord || isSheet
                  ? `<div class="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>`
                  : `<div class="text-center p-10">
                      <span class="material-icons text-gray-300" style="font-size:48px">insert_drive_file</span>
                      <p class="text-gray-500 mt-3 mb-4">Vista previa no disponible para este tipo de archivo.</p>
                      <a href="${url}" target="_blank" class="btn-primary">Descargar archivo</a>
                    </div>`}
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  if (isWord) renderWordPreview(url);
  else if (isSheet) renderSheetPreview(url);
}

function previewFallback(message) {
  const body = document.getElementById('preview-body');
  if (!body) return;
  body.innerHTML = `<div class="w-full h-full flex items-center justify-center">
    <div class="text-center p-10">
      <span class="material-icons text-gray-300" style="font-size:48px">error_outline</span>
      <p class="text-gray-500 mt-3">${message}</p>
    </div>
  </div>`;
}

async function renderWordPreview(url) {
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
    const body = document.getElementById('preview-body');
    if (body) body.innerHTML = `<div class="bg-white max-w-3xl mx-auto my-6 p-10 shadow-sm word-preview">${value}</div>`;
  } catch {
    previewFallback('No se pudo generar la vista previa de este documento Word.');
  }
}

async function renderSheetPreview(url) {
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const tabs = wb.SheetNames.map((name, i) => `<button class="sheet-tab-btn ${i===0?'bg-primary-600 text-white':'bg-white text-gray-600'} text-xs px-3 py-1.5 rounded-lg shrink-0" data-sheet="${name}">${name}</button>`).join('');
    const body = document.getElementById('preview-body');
    if (!body) return;
    body.innerHTML = `
      <div class="h-full flex flex-col">
        <div class="flex gap-2 p-3 border-b border-gray-200 bg-white overflow-x-auto shrink-0">${tabs}</div>
        <div class="flex-1 overflow-auto p-4" id="sheet-table-wrap"></div>
      </div>`;
    const renderSheet = name => {
      document.getElementById('sheet-table-wrap').innerHTML =
        `<div class="bg-white inline-block min-w-full xlsx-table">${XLSX.utils.sheet_to_html(wb.Sheets[name], { id: 'sheet-table' })}</div>`;
    };
    renderSheet(wb.SheetNames[0]);
    body.querySelectorAll('.sheet-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        body.querySelectorAll('.sheet-tab-btn').forEach(b => b.className = b.className.replace('bg-primary-600 text-white', 'bg-white text-gray-600'));
        btn.className = btn.className.replace('bg-white text-gray-600', 'bg-primary-600 text-white');
        renderSheet(btn.dataset.sheet);
      });
    });
  } catch {
    previewFallback('No se pudo generar la vista previa de esta hoja de cálculo.');
  }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
export function progressBar(pct) {
  return `<div class="h-2 bg-gray-100 rounded-full overflow-hidden">
    <div class="h-full bg-primary-500 rounded-full transition-all" style="width:${pct}%"></div>
  </div>`;
}

// ─── File helpers ─────────────────────────────────────────────────────────────
const EXT = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', zip:'📦', rar:'📦' };
export function fileIcon(name) {
  if (!name) return '📎';
  const ext = name.split('.').pop()?.toLowerCase();
  return EXT[ext] || '📎';
}
export function fileSize(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1024/1024).toFixed(1)} MB`;
}
