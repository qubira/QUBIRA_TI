import { api }                                         from '../api.js';
import { pageHeader,
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
    `${_contracts.length} documento${_contracts.length!==1?'s':''} · los sube y administra ADG`)}

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
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          ${_contracts.length === 0 ? `
            <tr><td colspan="7" class="text-center py-12 text-gray-400">
              <span class="material-icons text-gray-300" style="font-size:40px">description</span>
              <p class="mt-2">No hay documentos todavía</p>
            </td></tr>` : _contracts.map(contractRow).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  document.getElementById('f-project').addEventListener('change', e => { _filter.project_id = e.target.value; load(); });
  document.getElementById('f-type').addEventListener('change',    e => { _filter.type       = e.target.value; load(); });
  document.getElementById('f-status').addEventListener('change',  e => { _filter.status     = e.target.value; load(); });

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
  </tr>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
