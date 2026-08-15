import { api }                                         from '../api.js';
import { toast, showModal, closeModal, pageHeader,
         contractStatusBadge, fmtDate, spinner, icon,
         previewFile }                                 from '../utils.js';

const TYPE_LABEL = { contract:'Contrato', proforma:'Proforma', quote:'Cotización', addendum:'Adendum', other:'Otro' };
const STATUS_OPTS = [['draft','Borrador'],['sent','Enviado'],['approved','Aprobado'],['signed','Firmado'],['rejected','Rechazado']];

let _contracts = [], _projects = [];
let _filter = { type: '', status: '', project_id: '' };

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="contracts-page">${spinner()}</div>`;
  api.get('/projects').then(p => { _projects = p; });
  load();
}

function load() {
  api.get('/contracts', _filter).then(data => {
    _contracts = data;
    renderPage();
  });
}

function renderPage() {
  const c = document.getElementById('contracts-page');
  if (!c) return;

  const projOpts = _projects.map(p => `<option value="${p.id}" ${_filter.project_id==p.id?'selected':''}>${esc(p.name)}</option>`).join('');

  c.innerHTML = `
  ${pageHeader('Contratos & Proformas',
    `${_contracts.length} documento${_contracts.length!==1?'s':''}`,
    `<button id="new-btn" class="btn-primary">${icon('add',20)} Nuevo Documento</button>`)}

  <div class="flex flex-wrap gap-3 mb-5">
    <select id="f-project" class="input w-auto"><option value="">Todos los proyectos</option>${projOpts}</select>
    <select id="f-type" class="input w-auto">
      <option value="">Todos los tipos</option>
      ${Object.entries(TYPE_LABEL).map(([k,v]) => `<option value="${k}" ${_filter.type===k?'selected':''}>${v}</option>`).join('')}
    </select>
    <select id="f-status" class="input w-auto">
      <option value="">Todos los estados</option>
      ${STATUS_OPTS.map(([k,v]) => `<option value="${k}" ${_filter.status===k?'selected':''}>${v}</option>`).join('')}
    </select>
  </div>

  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 border-b border-gray-200">
            <th class="text-left px-4 py-3 font-semibold text-gray-600">Documento</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600">Proyecto</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
            <th class="text-right px-4 py-3 font-semibold text-gray-600">Monto</th>
            <th class="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
            <th class="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
            <th class="text-center px-4 py-3 font-semibold text-gray-600">Archivo</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${_contracts.length === 0 ? `
            <tr><td colspan="8" class="text-center py-12 text-gray-400">
              <span class="material-icons text-gray-300" style="font-size:40px">description</span>
              <p class="mt-2">No hay documentos todavía</p>
            </td></tr>` : _contracts.map(contractRow).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  document.getElementById('new-btn').addEventListener('click', () => openModal());
  document.getElementById('f-project').addEventListener('change', e => { _filter.project_id = e.target.value; load(); });
  document.getElementById('f-type').addEventListener('change',    e => { _filter.type       = e.target.value; load(); });
  document.getElementById('f-status').addEventListener('change',  e => { _filter.status     = e.target.value; load(); });

  document.querySelectorAll('.edit-c').forEach(btn => btn.addEventListener('click', () => {
    const ct = _contracts.find(x => String(x.id) === btn.dataset.id);
    if (ct) openModal(ct);
  }));
  document.querySelectorAll('.del-c').forEach(btn => btn.addEventListener('click', async () => {
    const ct = _contracts.find(x => String(x.id) === btn.dataset.id);
    if (!ct || !confirm(`¿Eliminar "${ct.title}"?`)) return;
    try { await api.delete(`/contracts/${ct.id}`); toast('Eliminado'); load(); }
    catch { toast('Error', 'error'); }
  }));

  document.querySelectorAll('.preview-c-btn').forEach(btn => btn.addEventListener('click', () => {
    previewFile(btn.dataset.url, btn.dataset.name);
  }));
}

function contractRow(c) {
  return `<tr class="hover:bg-gray-50">
    <td class="px-4 py-3">
      <p class="font-medium text-gray-900">${esc(c.title)}</p>
      ${c.notes ? `<p class="text-xs text-gray-400 truncate max-w-[200px]">${esc(c.notes)}</p>` : ''}
    </td>
    <td class="px-4 py-3">
      <p class="text-gray-700">${esc(c.project_name||'—')}</p>
      ${c.project_code ? `<p class="text-xs text-gray-400 font-mono">${esc(c.project_code)}</p>` : ''}
    </td>
    <td class="px-4 py-3 text-gray-600">${TYPE_LABEL[c.type]||c.type}</td>
    <td class="px-4 py-3 text-right font-medium">
      ${c.amount>0 ? `${c.currency} ${Number(c.amount).toLocaleString('es-EC',{minimumFractionDigits:2})}` : '—'}
    </td>
    <td class="px-4 py-3 text-center">${contractStatusBadge(c.status)}</td>
    <td class="px-4 py-3 text-gray-500 text-xs">${fmtDate(c.signed_date||c.created_at)}</td>
    <td class="px-4 py-3 text-center">
      ${c.file_path
        ? `<button class="preview-c-btn p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 inline-flex" data-url="${esc(c.file_path)}" data-name="${esc(c.file_name)}" title="${esc(c.file_name)}">${icon('visibility',18)}</button>`
        : '<span class="text-gray-300">—</span>'}
    </td>
    <td class="px-4 py-3">
      <div class="flex gap-1 justify-end">
        <button class="edit-c p-1.5 rounded hover:bg-gray-100 text-gray-400" data-id="${c.id}">${icon('edit',16)}</button>
        <button class="del-c p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" data-id="${c.id}">${icon('delete',16)}</button>
      </div>
    </td>
  </tr>`;
}

function openModal(editing = null) {
  const f = editing || { project_id:'', type:'contract', title:'', amount:'', currency:'USD', status:'draft', notes:'', signed_date:'' };
  const projOpts = _projects.map(p => `<option value="${p.id}" ${String(f.project_id)===String(p.id)?'selected':''}>${esc(p.name)} (${esc(p.code)})</option>`).join('');

  showModal(editing ? 'Editar Documento' : 'Nuevo Contrato / Proforma', `
  <form id="contract-form" class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="label">Proyecto</label>
        <select class="input" name="project_id"><option value="">— Sin proyecto —</option>${projOpts}</select>
      </div>
      <div>
        <label class="label">Tipo *</label>
        <select class="input" name="type" required>
          ${Object.entries(TYPE_LABEL).map(([k,v]) => `<option value="${k}" ${f.type===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Estado</label>
        <select class="input" name="status">
          ${STATUS_OPTS.map(([k,v]) => `<option value="${k}" ${f.status===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div class="col-span-2">
        <label class="label">Título *</label>
        <input class="input" name="title" required value="${esc(f.title)}" placeholder="Ej: Contrato de Instalación Eléctrica">
      </div>
      <div>
        <label class="label">Monto</label>
        <input class="input" type="number" name="amount" min="0" step="0.01" value="${f.amount||''}" placeholder="0.00">
      </div>
      <div>
        <label class="label">Moneda</label>
        <select class="input" name="currency">
          <option value="USD" ${f.currency==='USD'?'selected':''}>USD</option>
          <option value="EUR" ${f.currency==='EUR'?'selected':''}>EUR</option>
        </select>
      </div>
      <div>
        <label class="label">Fecha de Firma</label>
        <input class="input" type="date" name="signed_date" value="${f.signed_date||''}">
      </div>
      <div>
        <label class="label">Archivo (PDF, DOC, etc.)</label>
        <input type="file" class="input text-sm py-1.5" name="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png">
      </div>
      <div class="col-span-2">
        <label class="label">Notas</label>
        <textarea class="input resize-none" name="notes" rows="3" placeholder="Observaciones...">${esc(f.notes||'')}</textarea>
      </div>
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1 justify-center">${editing ? 'Guardar' : 'Crear'}</button>
      <button type="button" id="c-cancel" class="btn-secondary">Cancelar</button>
    </div>
  </form>`, 'lg');

  document.getElementById('c-cancel').addEventListener('click', closeModal);
  document.getElementById('contract-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    // Remove empty file input so server doesn't error
    if (!fd.get('file')?.name) fd.delete('file');
    try {
      if (editing) {
        await api.put(`/contracts/${editing.id}`, fd);
        toast('Actualizado');
      } else {
        await api.post('/contracts', fd);
        toast('Contrato/Proforma creado');
      }
      closeModal(); load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
