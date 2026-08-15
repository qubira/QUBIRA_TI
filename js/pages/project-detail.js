import { api }                                        from '../api.js';
import { navigate }                                   from '../state.js';
import { toast, showModal, closeModal,
         projectStatusBadge, priorityBadge,
         contractStatusBadge, fmtDate, fmtDateTime,
         fmtRelative, fmtMoney, spinner, icon,
         isOverdue, overdueBadge, previewFile }       from '../utils.js';

let _id, _project, _contracts, _documents, _messages, _emails, _activities, _requirements;
let _tab = 'overview';

const DOC_TYPE_LABEL = { dni:'DNI', ce:'CE', pasaporte:'Pasaporte' };
const STATUS_LABEL_ES   = { pending:'Pendiente', active:'Activo', paused:'Pausado', completed:'Completado', cancelled:'Cancelado' };
const PRIORITY_LABEL_ES = { low:'Baja', medium:'Media', high:'Alta', urgent:'Urgente' };

export function render({ id }) {
  _id  = id;
  _tab = 'overview';
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-6xl mx-auto" id="pd-page">${spinner()}</div>`;
  loadAll();
}

function loadAll() {
  Promise.all([
    api.get(`/projects/${_id}`),
    api.get('/contracts',     { project_id: _id }),
    api.get('/documents',     { project_id: _id }),
    api.get('/whatsapp',      { project_id: _id }),
    api.get('/emails',        { project_id: _id }),
    api.get('/activities',    { project_id: _id }),
    api.get('/requirements',  { project_id: _id }),
  ]).then(([proj, contr, docs, msgs, mails, acts, reqs]) => {
    _project      = proj;
    _contracts    = contr;
    _documents    = docs;
    _messages     = msgs;
    _emails       = mails;
    _activities   = acts;
    _requirements = reqs;
    renderPage();
  }).catch(() => { navigate('/projects'); });
}

function renderPage() {
  const container = document.getElementById('pd-page');
  if (!container) return;
  const p = _project;

  container.innerHTML = `
  <!-- Header -->
  <div class="flex items-start gap-4 mb-6">
    <button id="back-btn" class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 mt-0.5">${icon('arrow_back', 20)}</button>
    <div class="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
      ${p.company_logo
        ? `<img src="${esc(p.company_logo)}" class="w-full h-full object-contain">`
        : icon('apartment', 22)}
    </div>
    <div class="flex-1">
      <div class="flex items-center gap-3 flex-wrap">
        <h1 class="text-2xl font-bold text-gray-900">${esc(p.name)}</h1>
        ${projectStatusBadge(p.status)}
        ${priorityBadge(p.priority)}
        ${isOverdue(p) ? overdueBadge() : ''}
      </div>
      <p class="text-gray-500 mt-1">${esc(p.code)} · ${esc(p.client)}</p>
    </div>
    <button id="export-pdf-btn" class="btn-secondary">${icon('picture_as_pdf', 16)} Exportar PDF</button>
    <button id="edit-btn" class="btn-secondary">${icon('edit', 16)} Editar</button>
  </div>

  <!-- Progress -->
  <div class="card p-4 mb-4">
    <div class="flex justify-between text-sm mb-2">
      <span class="font-medium text-gray-700">Avance del proyecto</span>
      <span class="font-bold text-primary-700">${p.progress}%</span>
    </div>
    <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
      <div class="h-full bg-primary-500 rounded-full" style="width:${p.progress}%"></div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="border-b border-gray-200 mb-5">
    <div class="flex gap-1 overflow-x-auto" id="tabs">
      ${['overview','contracts','documents','whatsapp','emails','activity'].map((t,i) => {
        const labels = ['Resumen',`Contratos (${_contracts.length})`,`Documentos (${_documents.length})`,
                        `WhatsApp (${_messages.length})`,`Correos (${_emails.length})`,'Actividad'];
        return `<button data-tab="${t}" class="tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
          ${_tab===t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}">${labels[i]}</button>`;
      }).join('')}
    </div>
  </div>

  <!-- Tab content -->
  <div id="tab-content"></div>`;

  document.getElementById('back-btn').addEventListener('click', () => navigate('/projects'));
  document.getElementById('edit-btn').addEventListener('click', () => openEditModal());
  document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.className = `tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
          ${b.dataset.tab===_tab ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
      });
      renderTabContent();
    });
  });

  renderTabContent();
}

function renderTabContent() {
  const c = document.getElementById('tab-content');
  if (!c) return;
  const p = _project;

  if (_tab === 'overview') {
    const functional    = _requirements.filter(r => r.type !== 'non_functional');
    const nonFunctional = _requirements.filter(r => r.type === 'non_functional');

    c.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
      <!-- Empresa -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-900 mb-4">Empresa</h3>
        <div class="w-full aspect-square rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden mb-4">
          ${p.company_logo
            ? `<img src="${esc(p.company_logo)}" class="w-full h-full object-contain">`
            : `<span class="text-gray-300">${icon('apartment', 40)}</span>`}
        </div>
        <dl class="grid grid-cols-2 gap-4">
          ${infoRow('Nombre Empresa', p.company_name)}
          ${infoRow('Tipo Documento', DOC_TYPE_LABEL[p.id_document_type] || p.id_document_type)}
          ${infoRow('Número Documento', p.id_document_number)}
        </dl>
      </div>

      <!-- Información General -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-900 mb-4">Información General</h3>
        <dl class="grid grid-cols-2 gap-4">
          ${infoRow('Cliente', p.client)}
          ${infoRow('Responsable', p.responsible_name)}
          ${infoRow('Presupuesto', fmtMoney(p.budget))}
          ${infoRow('Moneda', p.currency)}
          ${infoRow('Inicio', fmtDate(p.start_date))}
          ${infoRow('Entrega', fmtDate(p.end_date))}
        </dl>
        ${p.description ? `<div class="mt-4 pt-4 border-t border-gray-100">
          <dt class="text-xs text-gray-400 uppercase tracking-wide mb-1">Descripción</dt>
          <p class="text-sm text-gray-700 whitespace-pre-wrap">${esc(p.description)}</p>
        </div>` : ''}
      </div>

      <!-- Resumen de Contenido -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-900 mb-4">Resumen de Contenido</h3>
        <div class="space-y-3">
          ${contentSummaryBtn('description','text-blue-600','Contratos y Proformas',_contracts.length,'contracts')}
          ${contentSummaryBtn('article','text-green-600','Documentos',_documents.length,'documents')}
          ${contentSummaryBtn('chat','text-emerald-600','Mensajes WhatsApp',_messages.length,'whatsapp')}
          ${contentSummaryBtn('email','text-purple-600','Correos Electrónicos',_emails.length,'emails')}
        </div>
      </div>
    </div>

    <!-- Requerimientos -->
    <div class="card p-5 mb-5">
      <h3 class="font-semibold text-gray-900 mb-4">Requerimientos</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Funcionales</p>
          ${requirementsList(functional)}
        </div>
        <div>
          <p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">No Funcionales</p>
          ${requirementsList(nonFunctional)}
        </div>
      </div>
    </div>

    <!-- Historial -->
    <div class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900">Historial</h3>
        <button data-tab="activity" class="tab-switch text-sm text-primary-600 hover:underline flex items-center gap-1">
          Ver todo ${icon('open_in_new', 14)}
        </button>
      </div>
      ${historyTimeline(_activities.slice(0, 8))}
    </div>`;
    c.querySelectorAll('.tab-switch').forEach(btn => {
      btn.addEventListener('click', () => {
        _tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.className = `tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
            ${b.dataset.tab===_tab ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`;
        });
        renderTabContent();
      });
    });
  }

  if (_tab === 'contracts') {
    c.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-end"><a href="#/contracts" class="btn-primary text-sm">${icon('description',16)} Gestionar Contratos</a></div>
      ${_contracts.length === 0
        ? '<div class="card p-10 text-center text-gray-400">No hay contratos en este proyecto</div>'
        : _contracts.map(ct => `
          <div class="card p-4 flex items-center gap-4">
            <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
              ${icon('description',20)}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 text-sm">${esc(ct.title)}</p>
              <p class="text-xs text-gray-500">${esc(ct.type)} · ${ct.amount > 0 ? '$'+Number(ct.amount).toLocaleString() : 'Sin monto'}</p>
            </div>
            ${contractStatusBadge(ct.status)}
            ${ct.file_path ? `<button class="preview-file-btn p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" data-url="${esc(ct.file_path)}" data-name="${esc(ct.file_name)}">${icon('visibility',18)}</button>` : ''}
          </div>`).join('')}
    </div>`;
    attachPreviewListeners(c);
  }

  if (_tab === 'documents') {
    c.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-end"><a href="#/documents" class="btn-primary text-sm">${icon('article',16)} Gestionar Documentos</a></div>
      ${_documents.length === 0
        ? '<div class="card p-10 text-center text-gray-400">No hay documentos en este proyecto</div>'
        : _documents.map(d => `
          <div class="card p-4 flex items-center gap-4">
            <div class="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center shrink-0 text-xl">${fileIcon(d.file_name)}</div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 text-sm">${esc(d.title)}</p>
              <p class="text-xs text-gray-500">${esc(d.category)} · ${esc(d.file_name||'Sin archivo')}</p>
            </div>
            ${d.file_path ? `<button class="preview-file-btn btn-secondary text-xs py-1" data-url="${esc(d.file_path)}" data-name="${esc(d.file_name||d.title)}">${icon('visibility',14)} Ver</button>` : ''}
          </div>`).join('')}
    </div>`;
    attachPreviewListeners(c);
  }

  if (_tab === 'whatsapp') {
    c.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-end"><a href="#/whatsapp" class="btn-primary text-sm">${icon('chat',16)} Gestionar Mensajes</a></div>
      ${_messages.length === 0
        ? '<div class="card p-10 text-center text-gray-400">No hay mensajes de WhatsApp en este proyecto</div>'
        : `<div class="card p-4 space-y-3 max-h-[500px] overflow-y-auto">
            ${_messages.map(m => `
              <div class="flex ${m.direction==='sent'?'justify-end':'justify-start'}">
                <div class="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm
                  ${m.direction==='sent' ? 'bg-green-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-900 rounded-bl-none'}">
                  ${m.direction==='received' ? `<p class="font-medium text-xs mb-1 text-green-700">${esc(m.contact_name)}</p>` : ''}
                  <p class="whitespace-pre-wrap">${esc(m.content)}</p>
                  <p class="text-xs mt-1 ${m.direction==='sent'?'text-green-100':'text-gray-400'}">${fmtDate(m.msg_date,'dd/MM HH:mm')}</p>
                </div>
              </div>`).join('')}
          </div>`}
    </div>`;
  }

  if (_tab === 'emails') {
    c.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-end"><a href="#/emails" class="btn-primary text-sm">${icon('email',16)} Gestionar Correos</a></div>
      ${_emails.length === 0
        ? '<div class="card p-10 text-center text-gray-400">No hay correos en este proyecto</div>'
        : _emails.map(e => `
          <div class="card p-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="w-2 h-2 rounded-full ${e.direction==='sent'?'bg-blue-500':'bg-purple-500'}"></div>
              <p class="font-medium text-gray-900 text-sm flex-1">${esc(e.subject)}</p>
              <span class="text-xs text-gray-400">${fmtDate(e.email_date)}</span>
            </div>
            <p class="text-xs text-gray-500">${e.direction==='received'?`De: ${esc(e.from_name||e.from_email)}`:`Para: ${esc(e.to_email)}`}</p>
            ${e.body ? `<p class="text-sm text-gray-700 mt-2 line-clamp-2">${esc(e.body)}</p>` : ''}
          </div>`).join('')}
    </div>`;
  }

  if (_tab === 'activity') {
    c.innerHTML = `<div class="card p-5">${historyTimeline(_activities)}</div>`;
  }
}

function exportToPDF() {
  const p = _project;
  const functional    = _requirements.filter(r => r.type !== 'non_functional');
  const nonFunctional = _requirements.filter(r => r.type === 'non_functional');

  const reqRows = items => items.length === 0
    ? '<p class="muted">Sin requerimientos registrados</p>'
    : items.map(r => `
        <div class="req-row">
          <span>${esc(r.description)}</span>
          <span class="req-pct">${r.progress || 0}%</span>
        </div>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>${esc(p.name)} — ${esc(p.code)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; padding: 40px; max-width: 800px; margin: 0 auto; }
      .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
      .header img { width: 56px; height: 56px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; }
      .header h1 { font-size: 22px; margin: 0; }
      .header p { margin: 2px 0 0; color: #6b7280; font-size: 13px; }
      .badges { margin-top: 6px; }
      .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-right: 6px; }
      .b-status { background: #dbeafe; color: #1e40af; }
      .b-priority { background: #fef3c7; color: #92400e; }
      .b-overdue { background: #fee2e2; color: #b91c1c; }
      h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 24px 0 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; }
      .field dt { font-size: 11px; color: #9ca3af; text-transform: uppercase; }
      .field dd { margin: 2px 0 0; font-weight: 600; font-size: 14px; }
      .desc { font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
      .req-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
      .req-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
      .req-pct { font-weight: 700; color: #2563eb; }
      .muted { color: #9ca3af; font-size: 13px; }
      .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
      @media print { body { padding: 20px; } }
    </style>
  </head>
  <body>
    <div class="header">
      ${p.company_logo ? `<img src="${esc(p.company_logo)}">` : ''}
      <div>
        <h1>${esc(p.name)}</h1>
        <p>${esc(p.code)} · ${esc(p.client)}</p>
        <div class="badges">
          <span class="badge b-status">${esc(STATUS_LABEL_ES[p.status] || p.status)}</span>
          <span class="badge b-priority">${esc(PRIORITY_LABEL_ES[p.priority] || p.priority)}</span>
          ${isOverdue(p) ? '<span class="badge b-overdue">Vencido</span>' : ''}
        </div>
      </div>
    </div>

    <h2>Información General</h2>
    <dl class="grid">
      <div class="field"><dt>Cliente</dt><dd>${esc(p.client)}</dd></div>
      <div class="field"><dt>Responsable</dt><dd>${esc(p.responsible_name || '—')}</dd></div>
      <div class="field"><dt>Presupuesto</dt><dd>${fmtMoney(p.budget)} ${esc(p.currency||'')}</dd></div>
      <div class="field"><dt>Avance</dt><dd>${p.progress}%</dd></div>
      <div class="field"><dt>Fecha de Inicio</dt><dd>${fmtDate(p.start_date)}</dd></div>
      <div class="field"><dt>Fecha de Entrega</dt><dd>${fmtDate(p.end_date)}</dd></div>
    </dl>

    ${p.company_name || p.id_document_number ? `
    <h2>Empresa</h2>
    <dl class="grid">
      <div class="field"><dt>Nombre Empresa</dt><dd>${esc(p.company_name || '—')}</dd></div>
      <div class="field"><dt>Documento</dt><dd>${esc(DOC_TYPE_LABEL[p.id_document_type] || p.id_document_type || '—')} ${esc(p.id_document_number||'')}</dd></div>
    </dl>` : ''}

    ${p.description ? `<h2>Descripción</h2><p class="desc">${esc(p.description)}</p>` : ''}

    <h2>Requerimientos</h2>
    <div class="req-cols">
      <div>
        <p class="muted" style="font-weight:700;color:#374151">FUNCIONALES</p>
        ${reqRows(functional)}
      </div>
      <div>
        <p class="muted" style="font-weight:700;color:#374151">NO FUNCIONALES</p>
        ${reqRows(nonFunctional)}
      </div>
    </div>

    <div class="footer">Generado el ${new Date().toLocaleDateString('es-EC', { day:'2-digit', month:'2-digit', year:'numeric' })} desde Qubira CRM</div>
  </body>
  </html>`);
  win.document.close();
  setTimeout(() => { try { win.print(); } catch {} }, 300);
}

function openEditModal() {
  const p = _project;
  showModal('Editar Proyecto', `
  <form id="edit-form" class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="label">Nombre *</label>
        <input class="input" name="name" required value="${esc(p.name)}">
      </div>
      <div class="col-span-2">
        <label class="label">Cliente *</label>
        <input class="input" name="client" required value="${esc(p.client)}">
      </div>
      <div>
        <label class="label">Estado</label>
        <select class="input" name="status">
          ${[['pending','Pendiente'],['active','Activo'],['paused','Pausado'],['completed','Completado'],['cancelled','Cancelado']]
            .map(([v,l]) => `<option value="${v}" ${p.status===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Avance (%)</label>
        <input class="input" type="number" name="progress" min="0" max="100" value="${p.progress}">
      </div>
      <div class="col-span-2">
        <label class="label">Descripción</label>
        <textarea class="input resize-none" name="description" rows="3">${esc(p.description||'')}</textarea>
      </div>
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1 justify-center">Guardar Cambios</button>
      <button type="button" id="edit-cancel" class="btn-secondary">Cancelar</button>
    </div>
  </form>`, 'md');

  document.getElementById('edit-cancel').addEventListener('click', closeModal);
  document.getElementById('edit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.put(`/projects/${_id}`, body);
      toast('Proyecto actualizado');
      closeModal();
      loadAll();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

function infoRow(label, value) {
  if (!value) return '';
  return `<div><dt class="text-xs text-gray-400 uppercase tracking-wide">${label}</dt>
    <dd class="text-sm font-medium text-gray-900 mt-0.5">${esc(value)}</dd></div>`;
}

function historyTimeline(items) {
  if (items.length === 0) return '<p class="text-center text-gray-400 py-4 text-sm">Sin actividad registrada</p>';
  return `<div class="space-y-4">
    ${items.map(a => `
      <div class="flex gap-4">
        <div class="flex flex-col items-center">
          <div class="w-3 h-3 bg-primary-400 rounded-full mt-1"></div>
          <div class="flex-1 w-px bg-gray-200 mt-1"></div>
        </div>
        <div class="pb-4">
          <p class="text-sm text-gray-800">${esc(a.description)}</p>
          <p class="text-xs text-gray-400 mt-1">${fmtDateTime(a.created_at)}${a.user_name ? ` · ${esc(a.user_name)}` : ''}</p>
        </div>
      </div>`).join('')}
  </div>`;
}

function requirementsList(items) {
  if (items.length === 0) return '<p class="text-xs text-gray-400 py-2">Sin requerimientos registrados</p>';
  return `<div class="space-y-2">
    ${items.map(r => `
      <div class="flex items-center gap-3 p-2 rounded-lg border border-gray-100">
        <p class="flex-1 text-sm text-gray-700 truncate" title="${esc(r.description)}">${esc(r.description)}</p>
        <div class="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
          <div class="h-full bg-primary-500 rounded-full" style="width:${r.progress||0}%"></div>
        </div>
        <span class="text-xs text-gray-500 w-9 text-right shrink-0">${r.progress||0}%</span>
      </div>`).join('')}
  </div>`;
}

function contentSummaryBtn(iconName, colorCls, label, count, tabKey) {
  return `<button data-tab="${tabKey}" class="tab-switch w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left">
    <span class="material-icons ${colorCls}" style="font-size:20px">${iconName}</span>
    <span class="flex-1 text-sm text-gray-700">${label}</span>
    <span class="text-sm font-semibold text-gray-900">${count}</span>
  </button>`;
}

function attachPreviewListeners(container) {
  container.querySelectorAll('.preview-file-btn').forEach(btn => {
    btn.addEventListener('click', () => previewFile(btn.dataset.url, btn.dataset.name));
  });
}

function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  const m = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', zip:'📦' };
  return m[ext] || '📎';
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
