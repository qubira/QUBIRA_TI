import { api }                                        from '../api.js';
import { navigate, getUser }                          from '../state.js';
import { toast, showModal, closeModal,
         projectStatusBadge, priorityBadge,
         fmtDate, fmtDateTime,
         fmtRelative, fmtMoney, spinner, icon,
         isOverdue, overdueBadge, previewFile,
         sanitizeRichText } from '../utils.js';

let _id, _project, _documents, _messages, _emails, _activities, _requirements;
let _tab = 'overview';
let _scrumRoles = [], _scrumUsers = [];
let _technologies = [];
let _techCatalog = { language: [], tool: [] };
let _pendingTechImage = { language: null, tool: null };
let _pendingCatalogMatch = { language: null, tool: null };

/* Un solo listener delegado (no uno por render) para cerrar el desplegable
   de tecnologías al hacer clic fuera — evita acumular listeners en cada
   renderTechnologies(). */
document.addEventListener('click', e => {
  document.querySelectorAll('.tech-dropdown:not(.hidden)').forEach(dd => {
    if (!dd.closest('[data-tech-wrap]')?.contains(e.target)) dd.classList.add('hidden');
  });
});
let _meetings = [];
let _meetingPool = [];
let _meetingFormOpen = false;
let _editingMeetingId = null;
let _meetingConflicts = [];
let _meetingSelectedParticipants = [];
let _meetingCheckToken = 0;
let _meetingParticipantInfo = new Map();
let _meetingExternalParticipants = [];
let _meetingDirResults = [];
let _meetingDirDebounce;

const SCRUM_ROLES = [['product_owner','Product Owner'],['scrum_master','Scrum Master'],['developer','Equipo de Desarrollo']];
const MEETING_ROLE_LABEL = { ...Object.fromEntries(SCRUM_ROLES), responsible: 'Responsable' };
const MEETING_TYPES = ['Reunión técnica','Planificación','Revisión','Incidencia','Coordinación','Otro'];
const EXTERNAL_KINDS = [['cliente','Cliente'],['postulante','Postulante'],['proveedor','Proveedor'],['consultor','Consultor'],['otro','Otro']];

const DOC_TYPE_LABEL = { dni:'DNI', ce:'CE', pasaporte:'Pasaporte', ruc:'RUC' };
const PROJECT_TYPE_LABEL = { web:'Web', mobile:'Aplicativo Móvil', desktop:'Aplicativo de Escritorio' };
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
    api.get('/documents',     { project_id: _id }),
    api.get('/whatsapp',      { project_id: _id }),
    api.get('/emails',        { project_id: _id }),
    api.get('/activities',    { project_id: _id }),
    api.get('/requirements',  { project_id: _id }),
  ]).then(([proj, docs, msgs, mails, acts, reqs]) => {
    _project      = proj;
    _documents    = docs;
    _messages     = msgs;
    _emails       = mails;
    _activities   = acts;
    _requirements = reqs;
    renderPage();
  }).catch(err => {
    toast(err.message || 'No se pudo cargar el proyecto', 'error');
    navigate('/projects');
  });
}

function renderPage() {
  const container = document.getElementById('pd-page');
  if (!container) return;
  const p = _project;

  const daysLeft = p.status === 'observed' && p.observation_deadline
    ? Math.ceil((new Date(p.observation_deadline) - new Date()) / 86400000) : null;

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
        ${daysLeft !== null ? `<span class="badge ${daysLeft <= 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'} inline-flex items-center gap-1">${icon('schedule', 12)} ${daysLeft > 0 ? `${daysLeft} día${daysLeft === 1 ? '' : 's'} para subsanar` : 'Plazo vencido'}</span>` : ''}
      </div>
      <p class="text-gray-500 mt-1">${esc(p.code)} · ${esc(p.client)}</p>
      ${p.origin_area && p.origin_area !== 'TI' ? `
        <p class="text-xs text-gray-400 mt-1 inline-flex items-center gap-1">${icon('call_made', 12)} Enviado por <strong class="text-gray-600">${esc(p.origin_area)}</strong> · ${esc(p.created_by_name || 'usuario eliminado')}</p>
      ` : ''}
    </div>
    <button id="export-pdf-btn" class="btn-secondary">${icon('picture_as_pdf', 16)} Exportar PDF</button>
    ${p.website_url ? `<a href="${esc(p.website_url)}" target="_blank" rel="noopener" class="btn-secondary">${icon('open_in_new', 16)} Ver página</a>` : ''}
    ${p.status === 'pending_approval' ? `
      <span class="text-sm text-amber-700 flex items-center gap-1.5">${icon('hourglass_empty', 16)} Esperando aprobación de ADG</span>
      ${p.origin_area === 'TI' ? `<button id="edit-btn" class="btn-secondary">${icon('edit', 16)} Editar</button>` : ''}
    ` : p.status === 'observed' ? `
      <span class="text-sm text-red-700 flex items-center gap-1.5">${icon('flag', 16)} Observado por ADG</span>
      ${p.origin_area === 'TI' ? `<button id="edit-btn" class="btn-secondary">${icon('edit', 16)} Editar</button>` : ''}
    ` : p.status === 'pending' ? `
      <button id="claim-btn" class="btn-primary">${icon('add_task', 16)} Reclamar para TI</button>
    ` : p.status === 'completed' ? `
      <span class="text-sm text-gray-400 flex items-center gap-1.5">${icon('lock', 16)} Completado — ADG aprobó el cierre</span>
    ` : `
      <button id="edit-btn" class="btn-secondary">${icon('edit', 16)} Editar</button>
      ${p.status === 'finished_by_ti'
        ? `<span class="text-sm text-purple-600 flex items-center gap-1.5">${icon('hourglass_empty', 16)} Esperando revisión de ADG</span>`
        : `<button id="finish-btn" class="btn-primary">${icon('task_alt', 16)} Marcar como finalizado</button>`}
    `}
  </div>

  <!-- Progress -->
  <div class="card p-4 mb-4" id="progress-card">
    <div class="flex justify-between text-sm mb-2">
      <span class="font-medium text-gray-700">Avance del proyecto</span>
      <span class="font-bold text-primary-700" id="progress-pct">${p.progress}%</span>
    </div>
    <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
      <div class="h-full bg-primary-500 rounded-full" id="progress-fill" style="width:${p.progress}%"></div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="border-b border-gray-200 mb-5">
    <div class="flex gap-1 overflow-x-auto" id="tabs">
      ${(() => {
        const tabs = ['overview','github','scrum','schedule','technologies','requirements','documents','whatsapp','emails','activity'];
        const labels = ['Resumen','GitHub','Scrum','Cronograma','Tecnologías',`Requisitos (${_requirements.length})`,`Documentos (${_documents.length})`,
                        `WhatsApp (${_messages.length})`,`Correos (${_emails.length})`,'Actividad'];
        if (p.status === 'observed') { tabs.push('observations'); labels.push('Observaciones'); }
        return tabs.map((t,i) => `<button data-tab="${t}" class="tab-btn px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
          ${t === 'observations' ? (_tab===t ? 'border-red-600 text-red-700' : 'border-transparent text-red-500 hover:text-red-700') :
            (_tab===t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700')}">${labels[i]}</button>`).join('');
      })()}
    </div>
  </div>

  <!-- Tab content -->
  <div id="tab-content"></div>`;

  document.getElementById('back-btn').addEventListener('click', () => navigate('/projects'));
  document.getElementById('export-pdf-btn').addEventListener('click', exportToPDF);
  document.getElementById('edit-btn')?.addEventListener('click', () => openEditModal());
  document.getElementById('claim-btn')?.addEventListener('click', async () => {
    try {
      await api.post(`/projects/${_id}/claim`);
      toast('Proyecto anexado a tu área');
      loadAll();
    } catch (err) { toast(err.message || 'Error al reclamar', 'error'); }
  });
  document.getElementById('finish-btn')?.addEventListener('click', async () => {
    if (!confirm('¿Marcar este proyecto como finalizado? ADG lo va a revisar antes de darlo por completado.')) return;
    try {
      await api.put(`/projects/${_id}`, { status: 'finished_by_ti' });
      toast('Proyecto marcado como finalizado');
      loadAll();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });

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
          ${infoRow('Tipo de Proyecto', PROJECT_TYPE_LABEL[p.project_type] || p.project_type)}
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
        ${(p.github_url || p.website_url) ? `<div class="mt-4 pt-4 border-t border-gray-100 space-y-2">
          ${p.github_url ? `<a href="${esc(p.github_url)}" target="_blank" rel="noopener" class="flex items-center gap-2 text-sm text-primary-600 hover:underline">${icon('code', 16)} GitHub</a>` : ''}
          ${p.website_url ? `<a href="${esc(p.website_url)}" target="_blank" rel="noopener" class="flex items-center gap-2 text-sm text-primary-600 hover:underline">${icon('language', 16)} Ver página</a>` : ''}
        </div>` : ''}
        ${p.description ? `<div class="mt-4 pt-4 border-t border-gray-100">
          <dt class="text-xs text-gray-400 uppercase tracking-wide mb-1">Descripción</dt>
          <p class="text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto pr-1">${esc(p.description)}</p>
        </div>` : ''}
      </div>

      <!-- Resumen de Contenido -->
      <div class="card p-5">
        <h3 class="font-semibold text-gray-900 mb-4">Resumen de Contenido</h3>
        <div class="space-y-3">
          ${contentSummaryBtn('checklist','text-amber-600','Requisitos',_requirements.length,'requirements')}
          ${contentSummaryBtn('article','text-green-600','Documentos',_documents.length,'documents')}
          ${contentSummaryBtn('chat','text-emerald-600','Mensajes WhatsApp',_messages.length,'whatsapp')}
          ${contentSummaryBtn('email','text-purple-600','Correos Electrónicos',_emails.length,'emails')}
        </div>
      </div>
    </div>

    ${p.family ? `
    <!-- Proyectos relacionados (familia) -->
    <div class="card p-5 mb-5" id="family-card">
      <h3 class="font-semibold text-gray-900 mb-4 flex items-center gap-2">${icon('workspaces', 18)} Familia: ${esc(p.family)}</h3>
      <div id="family-list" class="flex justify-center py-3"><div class="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>
    </div>` : ''}

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
    if (p.family) loadFamilyProjects(p.family);
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

  if (_tab === 'github') {
    if (!p.github_url) {
      c.innerHTML = `
      <div class="card p-8 text-center">
        <span class="text-gray-300">${icon('code', 48)}</span>
        <p class="text-gray-400 mt-3">Todavía no se registró un repositorio de GitHub</p>
        <p class="text-xs text-gray-400 mt-1">Se agrega desde el botón "Editar"</p>
      </div>`;
    } else {
      c.innerHTML = `
      <div class="card p-6 mb-4" id="gh-preview">${spinner()}</div>
      <div id="gh-browser"></div>`;
      loadGithubPreview(p.github_url);
    }
  }

  if (_tab === 'scrum') {
    c.innerHTML = `<div id="scrum-container">${spinner()}</div>`;
    loadScrum();
  }

  if (_tab === 'schedule') {
    c.innerHTML = `<div id="schedule-container">${spinner()}</div>`;
    loadSchedule();
  }

  if (_tab === 'technologies') {
    c.innerHTML = `<div id="tech-container">${spinner()}</div>`;
    loadTechnologies();
  }

  if (_tab === 'requirements') {
    const functional    = _requirements.filter(r => r.type !== 'non_functional');
    const nonFunctional = _requirements.filter(r => r.type === 'non_functional');
    c.innerHTML = `
    <p class="text-xs text-gray-400 mb-3">Los requisitos los agrega y edita ADG — solo el responsable del proyecto puede actualizar el % de avance.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      ${requirementsColumn('Funcionales', functional, 'functional')}
      ${requirementsColumn('No Funcionales', nonFunctional, 'non_functional')}
    </div>`;
    wireRequirementsTab();
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
            ${d.file_path ? `<button class="preview-file-btn btn-secondary text-xs py-1" data-id="${d.id}" data-name="${esc(d.file_name||d.title)}">${icon('visibility',14)} Ver</button>` : ''}
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

  if (_tab === 'observations') {
    const deadline = p.observation_deadline ? new Date(p.observation_deadline) : null;
    const daysLeft = deadline ? Math.ceil((deadline - new Date()) / 86400000) : null;
    const canResubmit = p.origin_area === 'TI';
    c.innerHTML = `
    <div class="card p-5 bg-red-50 border border-red-200">
      <div class="flex items-center gap-2 mb-3">
        ${icon('flag', 18)}
        <h3 class="font-semibold text-red-800">Observación de ADG</h3>
      </div>
      <p class="text-sm text-red-900 whitespace-pre-wrap mb-4">${esc(p.observation_reason || 'Sin motivo registrado')}</p>
      <div class="flex flex-wrap items-center gap-4 text-xs text-red-700 mb-4">
        <span>Observado el ${fmtDateTime(p.observed_at)}</span>
        ${deadline ? `<span class="font-semibold">${daysLeft > 0 ? `${daysLeft} día${daysLeft === 1 ? '' : 's'} restantes para reenviar` : 'Plazo vencido — se archivará automáticamente'}</span>` : ''}
      </div>
      ${canResubmit ? `<button id="resubmit-btn" class="btn-primary">${icon('send', 16)} Reenviar solicitud corregida</button>` : ''}
    </div>`;
    document.getElementById('resubmit-btn')?.addEventListener('click', async () => {
      if (!confirm('¿Reenviar esta solicitud? Vuelve a la cola de aprobación de ADG.')) return;
      try {
        await api.post(`/projects/${_id}/resubmit`, {});
        toast('Solicitud reenviada');
        loadAll();
      } catch (err) { toast(err.message || 'Error', 'error'); }
    });
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
      ${['active','paused'].includes(p.status) ? `
      <div>
        <label class="label">Estado</label>
        <select class="input" name="status">
          ${[['active','Activo'],['paused','Pausado']]
            .map(([v,l]) => `<option value="${v}" ${p.status===v?'selected':''}>${l}</option>`).join('')}
        </select>
        <p class="text-xs text-gray-400 mt-1">Para finalizar el proyecto usá el botón "Marcar como finalizado".</p>
      </div>` : ''}
      <div class="col-span-2">
        <label class="label">Descripción</label>
        <textarea class="input resize-none" name="description" rows="3">${esc(p.description||'')}</textarea>
      </div>
      <div>
        <label class="label">Link de GitHub</label>
        <input class="input" type="url" name="github_url" value="${esc(p.github_url||'')}" placeholder="https://github.com/...">
      </div>
      <div>
        <label class="label">Link de la Página</label>
        <input class="input" type="url" name="website_url" value="${esc(p.website_url||'')}" placeholder="https://...">
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

async function loadScrum() {
  try {
    const [roles, users] = await Promise.all([
      api.get('/scrum-roles', { project_id: _id }),
      _scrumUsers.length ? Promise.resolve(_scrumUsers) : api.get('/users'),
    ]);
    _scrumRoles = roles;
    _scrumUsers = users;
    renderScrum();
  } catch {
    const c = document.getElementById('scrum-container');
    if (c) c.innerHTML = '<p class="text-center text-red-400 py-8 text-sm">Error al cargar los roles Scrum</p>';
  }
}

function renderScrum() {
  const c = document.getElementById('scrum-container');
  if (!c) return;
  c.innerHTML = `
  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
    ${SCRUM_ROLES.map(([key, label]) => scrumRoleColumn(key, label)).join('')}
  </div>`;
  wireScrum();
}

function scrumRoleHint(key) {
  if (key === 'product_owner') return 'Define qué se construye y prioriza el backlog';
  if (key === 'scrum_master')  return 'Facilita el proceso y quita obstáculos al equipo';
  return 'Construye el incremento del producto';
}

function scrumRoleColumn(key, label) {
  const items = _scrumRoles.filter(r => r.role === key);
  const userOpts = _scrumUsers.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  return `
  <div class="card p-5">
    <h3 class="font-semibold text-gray-900 mb-1">${label}</h3>
    <p class="text-xs text-gray-400 mb-3">${scrumRoleHint(key)}</p>
    <div class="space-y-2 mb-3">
      ${items.length === 0
        ? '<p class="text-xs text-gray-400 text-center py-2">Sin asignar</p>'
        : items.map(it => `
          <div class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-white">
            <div class="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
              <span class="text-primary-700 font-semibold text-[10px]">${esc((it.user_name || '?')[0]?.toUpperCase() || '?')}</span>
            </div>
            <p class="flex-1 text-sm text-gray-700 truncate">${esc(it.user_name || 'Usuario')}</p>
            <button type="button" class="scrum-del text-gray-300 hover:text-red-500 shrink-0" data-id="${it.id}">${icon('delete',14)}</button>
          </div>`).join('')}
    </div>
    <div class="flex gap-2">
      <select class="input text-xs flex-1" id="scrum-select-${key}">
        <option value="">Elegir trabajador...</option>
        ${userOpts}
      </select>
      <button type="button" class="btn-secondary text-xs px-3 scrum-add" data-role="${key}">${icon('add',16)}</button>
    </div>
  </div>`;
}

function wireScrum() {
  document.querySelectorAll('.scrum-add').forEach(btn => {
    btn.addEventListener('click', async () => {
      const role = btn.dataset.role;
      const select = document.getElementById(`scrum-select-${role}`);
      const user_id = select.value;
      if (!user_id) return;
      try {
        await api.post('/scrum-roles', { project_id: _id, role, user_id });
        _scrumRoles = await api.get('/scrum-roles', { project_id: _id });
        renderScrum();
      } catch (err) { toast(err.message || 'Error', 'error'); }
    });
  });
  document.querySelectorAll('.scrum-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.delete(`/scrum-roles/${btn.dataset.id}`);
        _scrumRoles = _scrumRoles.filter(r => String(r.id) !== btn.dataset.id);
        renderScrum();
      } catch (err) { toast(err.message || 'Error', 'error'); }
    });
  });
}

/* Fechas del cronograma son "YYYY-MM-DD" puras (sin hora). fmtDate() pasa
   por new Date(), que interpreta ese string como medianoche UTC y luego lo
   vuelve a leer en hora local — en husos horarios negativos eso corre la
   fecha un día hacia atrás. Se formatea el string directamente, sin Date. */
function fmtMeetingDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

async function loadSchedule() {
  try {
    const [meetings, scrumRoles] = await Promise.all([
      api.get('/calendar/meetings', { project_id: _id }),
      api.get('/scrum-roles', { project_id: _id }),
    ]);
    _meetings = meetings;
    const pool = new Map();
    scrumRoles.forEach(s => pool.set(s.user_id, { user_id: s.user_id, name: s.user_name, role: s.role }));
    if (_project?.responsible_id && !pool.has(_project.responsible_id)) {
      pool.set(_project.responsible_id, { user_id: _project.responsible_id, name: _project.responsible_name, role: 'responsible' });
    }
    _meetingPool = Array.from(pool.values());
    _meetingParticipantInfo = new Map(pool);
    renderSchedule();
  } catch {
    const c = document.getElementById('schedule-container');
    if (c) c.innerHTML = '<p class="text-center text-red-400 py-8 text-sm">Error al cargar el cronograma</p>';
  }
}

function renderSchedule() {
  const c = document.getElementById('schedule-container');
  if (!c) return;
  c.innerHTML = `
  <div class="grid grid-cols-1 ${_meetingFormOpen ? 'lg:grid-cols-[1fr_360px]' : ''} gap-5 items-start">
    <div>
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-gray-900">Reuniones programadas</h3>
        <button type="button" id="schedule-add-btn" class="btn-primary text-sm">${icon('add',16)} Agregar reunión</button>
      </div>
      <div id="schedule-list">${scheduleListHtml()}</div>
    </div>
    ${_meetingFormOpen ? `<div id="schedule-form-panel">${meetingFormHtml()}</div>` : ''}
  </div>`;
  wireSchedule();
}

function scheduleListHtml() {
  if (!_meetings.length) return '<div class="card p-10 text-center text-gray-400">No hay reuniones programadas</div>';
  const groups = {};
  _meetings.forEach(m => { (groups[m.meeting_date] ||= []).push(m); });
  return Object.entries(groups).map(([date, items]) => `
    <div class="mb-5">
      <h4 class="text-sm font-semibold text-gray-500 mb-2">${fmtMeetingDate(date)}</h4>
      <div class="space-y-2">${items.map(meetingCard).join('')}</div>
    </div>`).join('');
}

function meetingCard(m) {
  const isBusy = m.visibility === 'busy_only';
  const participantsHtml = (m.participants || []).map(p => p.participant_type === 'external'
    ? `${esc(p.external_name)} (${EXTERNAL_KINDS.find(k=>k[0]===p.external_kind)?.[1] || p.external_kind})`
    : `${esc(p.user_name || '—')} — ${esc(MEETING_ROLE_LABEL[p.role] || p.user_area || p.role || '—')}`)
    .join('<br>');
  const statusBadge = m.status === 'cancelled'
    ? '<span class="badge bg-red-50 text-red-600">Cancelada</span>'
    : m.status === 'completed'
      ? '<span class="badge bg-gray-100 text-gray-500">Realizada</span>'
      : '<span class="badge bg-green-50 text-green-700">Programada</span>';
  return `
  <div class="card p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h4 class="font-semibold text-gray-900">${esc(m.title)}</h4>
          ${statusBadge}
          ${isBusy ? `<span class="badge bg-gray-100 text-gray-500">${icon('lock',12)} Privada</span>` : ''}
        </div>
        <p class="text-xs text-gray-500 mt-1">${m.start_time.slice(0,5)} — ${m.end_time.slice(0,5)}${m.meeting_type ? ' · ' + esc(m.meeting_type) : ''}</p>
        ${!isBusy && m.motivo ? `<p class="text-sm text-gray-600 mt-2">${esc(m.motivo)}</p>` : ''}
        ${!isBusy && participantsHtml ? `<div class="text-xs text-gray-500 mt-2">${participantsHtml}</div>` : ''}
        ${!isBusy ? `<p class="text-xs text-gray-400 mt-2">Programada por ${esc(m.created_by_name || '—')}</p>` : ''}
      </div>
      ${!isBusy ? `
      <div class="flex gap-1 shrink-0">
        <button type="button" class="meeting-view-btn p-1.5 rounded hover:bg-gray-100 text-gray-400" data-id="${m.id}" title="Ver detalle">${icon('visibility',16)}</button>
        <button type="button" class="meeting-edit-btn p-1.5 rounded hover:bg-gray-100 text-gray-400" data-id="${m.id}" title="Editar">${icon('edit',16)}</button>
        <button type="button" class="meeting-del-btn p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" data-id="${m.id}" title="Eliminar">${icon('delete',16)}</button>
      </div>` : ''}
    </div>
  </div>`;
}

function meetingFormHtml() {
  const editing = _meetings.find(m => m.id === _editingMeetingId);
  const selected = new Set(_meetingSelectedParticipants);
  const extras = _meetingSelectedParticipants.filter(id => !_meetingPool.some(p => p.user_id === id));
  return `
  <div class="card p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-gray-900">${editing ? 'Editar reunión' : 'Nueva reunión'}</h3>
      <button type="button" id="schedule-form-close" class="p-1 rounded hover:bg-gray-100 text-gray-400">${icon('close',18)}</button>
    </div>
    <form id="meeting-form" class="space-y-3">
      <div>
        <label class="text-xs font-medium text-gray-600">Nombre de la reunión *</label>
        <input name="title" class="input text-sm w-full mt-1" required value="${esc(editing?.title || '')}">
      </div>
      <div class="grid grid-cols-3 gap-2">
        <div>
          <label class="text-xs font-medium text-gray-600">Fecha *</label>
          <input type="date" name="date" class="input text-sm w-full mt-1" required value="${editing?.meeting_date || ''}">
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Inicio *</label>
          <input type="time" name="start_time" class="input text-sm w-full mt-1" required value="${editing ? editing.start_time.slice(0,5) : ''}">
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600">Fin *</label>
          <input type="time" name="end_time" class="input text-sm w-full mt-1" required value="${editing ? editing.end_time.slice(0,5) : ''}">
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Tipo de reunión</label>
        <select name="meeting_type" class="input text-sm w-full mt-1">
          <option value="">— Seleccionar —</option>
          ${MEETING_TYPES.map(t => `<option value="${t}" ${editing?.meeting_type===t?'selected':''}>${t}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Motivo</label>
        <input name="motivo" class="input text-sm w-full mt-1" value="${esc(editing?.motivo || '')}">
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Descripción</label>
        <textarea name="description" class="input text-sm w-full mt-1" rows="2">${esc(editing?.description || '')}</textarea>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Equipo del proyecto</label>
        <div class="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-32 overflow-y-auto" id="meeting-participants-list">
          ${_meetingPool.length === 0
            ? '<p class="text-xs text-gray-400 p-3">Este proyecto todavía no tiene equipo Scrum ni responsable asignado.</p>'
            : _meetingPool.map(p => `
              <label class="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" class="meeting-participant-checkbox" value="${p.user_id}" ${selected.has(p.user_id) ? 'checked' : ''}>
                <span>${esc(p.name || '—')} — ${esc(MEETING_ROLE_LABEL[p.role] || p.role)}</span>
              </label>`).join('')}
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Agregar a alguien de otra área</label>
        <div class="relative">
          <input id="meeting-dir-search" class="input text-sm w-full" placeholder="Buscar por nombre, cargo o área...">
          <div id="meeting-dir-results" class="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto hidden"></div>
        </div>
        ${extras.length ? `<div class="flex flex-wrap gap-1.5 mt-2">
          ${extras.map(id => {
            const info = _meetingParticipantInfo.get(id) || {};
            return `<span class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
              ${esc(info.name || info.nombre || '—')}${info.area ? ' — ' + esc(info.area) : ''}
              <button type="button" class="meeting-remove-extra text-indigo-300 hover:text-red-500 flex items-center" data-id="${id}">${icon('close',12)}</button>
            </span>`;
          }).join('')}
        </div>` : ''}
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 block mb-1">Participante externo (cliente, proveedor...)</label>
        <div class="flex gap-2">
          <input id="meeting-ext-name" class="input text-sm flex-1" placeholder="Nombre">
          <select id="meeting-ext-kind" class="input text-sm w-auto">
            ${EXTERNAL_KINDS.map(([k,l]) => `<option value="${k}">${l}</option>`).join('')}
          </select>
          <button type="button" id="meeting-ext-add" class="btn-secondary text-xs px-3">${icon('add',16)}</button>
        </div>
        <div id="meeting-selected-externals" class="flex flex-wrap gap-1.5 mt-2">${externalsHtml()}</div>
      </div>
      <div id="meeting-conflict-banner">${conflictBannerHtml()}</div>
      <div class="flex gap-2 pt-1">
        <button type="submit" id="meeting-save-btn" class="btn-primary text-sm flex-1 justify-center" ${_meetingConflicts.length ? 'disabled' : ''}>${editing ? 'Guardar cambios' : 'Guardar reunión'}</button>
        <button type="button" id="schedule-form-cancel" class="btn-secondary text-sm">Cancelar</button>
      </div>
    </form>
  </div>`;
}

function externalsHtml() {
  if (!_meetingExternalParticipants.length) return '';
  return _meetingExternalParticipants.map((p, i) => `
    <span class="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
      ${esc(p.name)} (${EXTERNAL_KINDS.find(k=>k[0]===p.kind)?.[1] || p.kind})
      <button type="button" class="meeting-remove-external text-amber-300 hover:text-red-500 flex items-center" data-i="${i}">${icon('close',12)}</button>
    </span>`).join('');
}

function conflictBannerHtml() {
  if (!_meetingConflicts.length) return '';
  return `
  <div class="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
    <p class="font-semibold flex items-center gap-1.5">${icon('warning',16)} ${_meetingConflicts.length > 1 ? 'Se detectaron conflictos de horario:' : 'Conflicto de horario'}</p>
    <ul class="mt-1.5 space-y-1 list-disc list-inside">
      ${_meetingConflicts.map(c => `<li>${esc(c.user_name || 'Alguien')} (${esc(c.area || '—')}) ya tiene "${esc(c.meeting_name)}" de ${c.start_time.slice(0,5)} a ${c.end_time.slice(0,5)} (${fmtMeetingDate(c.date)}).</li>`).join('')}
    </ul>
  </div>`;
}

function wireSchedule() {
  const addBtn = document.getElementById('schedule-add-btn');
  if (addBtn) addBtn.addEventListener('click', () => {
    _editingMeetingId = null;
    _meetingSelectedParticipants = [];
    _meetingExternalParticipants = [];
    _meetingConflicts = [];
    _meetingFormOpen = true;
    renderSchedule();
  });

  ['schedule-form-close', 'schedule-form-cancel'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', () => {
      _meetingFormOpen = false;
      _editingMeetingId = null;
      renderSchedule();
    });
  });

  document.querySelectorAll('.meeting-participant-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const pool = new Set(_meetingPool.map(p => p.user_id));
      const extras = _meetingSelectedParticipants.filter(id => !pool.has(id));
      const checked = Array.from(document.querySelectorAll('.meeting-participant-checkbox:checked')).map(x => Number(x.value));
      _meetingSelectedParticipants = [...checked, ...extras];
      scheduleLiveCheck();
    });
  });

  wireDirectorySearch();
  wireRemoveExtras();

  const extAdd = document.getElementById('meeting-ext-add');
  if (extAdd) extAdd.addEventListener('click', () => {
    const nameEl = document.getElementById('meeting-ext-name');
    const kindEl = document.getElementById('meeting-ext-kind');
    const name = nameEl.value.trim();
    if (!name) return;
    _meetingExternalParticipants.push({ name, kind: kindEl.value });
    nameEl.value = '';
    document.getElementById('meeting-selected-externals').innerHTML = externalsHtml();
    wireRemoveExternals();
  });
  wireRemoveExternals();

  const form = document.getElementById('meeting-form');
  if (form) {
    ['date', 'start_time', 'end_time'].forEach(fieldName => {
      const el = form.elements[fieldName];
      if (el) el.addEventListener('change', scheduleLiveCheck);
    });
    form.addEventListener('submit', submitMeeting);
  }

  document.querySelectorAll('.meeting-view-btn').forEach(btn => btn.addEventListener('click', () => viewMeeting(btn.dataset.id)));
  document.querySelectorAll('.meeting-edit-btn').forEach(btn => btn.addEventListener('click', () => editMeeting(btn.dataset.id)));
  document.querySelectorAll('.meeting-del-btn').forEach(btn => btn.addEventListener('click', () => deleteMeeting(btn.dataset.id)));
}

function wireDirectorySearch() {
  const search = document.getElementById('meeting-dir-search');
  const results = document.getElementById('meeting-dir-results');
  if (!search) return;
  search.addEventListener('input', () => {
    clearTimeout(_meetingDirDebounce);
    const q = search.value.trim();
    if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
    _meetingDirDebounce = setTimeout(async () => {
      try {
        _meetingDirResults = await api.get('/calendar/directory', { q });
        results.innerHTML = _meetingDirResults.length
          ? _meetingDirResults.map(p => `
              <button type="button" class="meeting-dir-pick w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between" data-id="${p.user_id}">
                <span>${esc([p.nombre, p.apellidos].filter(Boolean).join(' '))}</span>
                <span class="text-xs text-gray-400">${esc(p.area || '—')}${p.cargo ? ' · ' + esc(p.cargo) : ''}</span>
              </button>`).join('')
          : '<p class="px-3 py-2 text-xs text-gray-400">Sin resultados</p>';
        results.classList.remove('hidden');
        results.querySelectorAll('.meeting-dir-pick').forEach(btn => btn.addEventListener('click', () => {
          const person = _meetingDirResults.find(p => String(p.user_id) === btn.dataset.id);
          if (person && !_meetingSelectedParticipants.includes(person.user_id)) {
            _meetingSelectedParticipants.push(person.user_id);
            _meetingParticipantInfo.set(person.user_id, { name: [person.nombre, person.apellidos].filter(Boolean).join(' '), area: person.area });
            // Re-renderizar todo el panel (no solo parchear el DOM a mano) para
            // que el <form> nuevo quede completamente re-cableado, incluido el
            // listener de submit — si no, "Guardar reunión" queda sin efecto.
            // Se preserva lo ya escrito, porque el re-render genera un <form> en blanco.
            const preserved = captureMeetingFormValues();
            renderSchedule();
            restoreMeetingFormValues(preserved);
            scheduleLiveCheck();
            return;
          }
          search.value = ''; results.classList.add('hidden'); results.innerHTML = '';
        }));
      } catch { /* silencioso */ }
    }, 250);
  });
}

const MEETING_FORM_FIELDS = ['title', 'date', 'start_time', 'end_time', 'meeting_type', 'motivo', 'description'];

/* Un pick de participante o quitar un "extra" re-renderiza el panel del
   formulario para que quede bien cableado (el <form> es nuevo, necesita su
   propio listener de submit) — pero eso también borra lo que el usuario ya
   había escrito. Se guarda y se restaura antes/después del re-render. */
function captureMeetingFormValues() {
  const form = document.getElementById('meeting-form');
  if (!form) return null;
  const values = {};
  MEETING_FORM_FIELDS.forEach(f => { if (form.elements[f]) values[f] = form.elements[f].value; });
  return values;
}
function restoreMeetingFormValues(values) {
  if (!values) return;
  const form = document.getElementById('meeting-form');
  if (!form) return;
  Object.entries(values).forEach(([f, v]) => { if (form.elements[f]) form.elements[f].value = v; });
}

function wireRemoveExtras() {
  document.querySelectorAll('.meeting-remove-extra').forEach(btn => btn.addEventListener('click', () => {
    const id = Number(btn.dataset.id);
    _meetingSelectedParticipants = _meetingSelectedParticipants.filter(x => x !== id);
    const preserved = captureMeetingFormValues();
    renderSchedule();
    restoreMeetingFormValues(preserved);
  }));
}
function wireRemoveExternals() {
  document.querySelectorAll('.meeting-remove-external').forEach(btn => btn.addEventListener('click', () => {
    _meetingExternalParticipants.splice(Number(btn.dataset.i), 1);
    document.getElementById('meeting-selected-externals').innerHTML = externalsHtml();
    wireRemoveExternals();
  }));
}

async function scheduleLiveCheck() {
  const form = document.getElementById('meeting-form');
  if (!form) return;
  const date = form.elements.date.value;
  const start = form.elements.start_time.value;
  const end = form.elements.end_time.value;
  const saveBtn = document.getElementById('meeting-save-btn');

  if (!date || !start || !end || !_meetingSelectedParticipants.length || end <= start) {
    _meetingConflicts = [];
    const bannerEl = document.getElementById('meeting-conflict-banner');
    if (bannerEl) bannerEl.innerHTML = '';
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  const token = ++_meetingCheckToken;
  let conflicts = [];
  try {
    const res = await api.post('/calendar/check-availability', {
      date, start_time: start, end_time: end,
      participant_ids: _meetingSelectedParticipants,
      exclude_meeting_id: _editingMeetingId || undefined,
    });
    conflicts = res.conflicts || [];
  } catch { conflicts = []; }
  if (token !== _meetingCheckToken) return;
  _meetingConflicts = conflicts;
  const bannerEl = document.getElementById('meeting-conflict-banner');
  if (bannerEl) bannerEl.innerHTML = conflictBannerHtml();
  const saveBtnEl = document.getElementById('meeting-save-btn');
  if (saveBtnEl) saveBtnEl.disabled = _meetingConflicts.length > 0;
}

async function submitMeeting(e) {
  e.preventDefault();
  const form = e.target;
  const title = form.elements.title.value.trim();
  const date = form.elements.date.value;
  const start_time = form.elements.start_time.value;
  const end_time = form.elements.end_time.value;
  const meeting_type = form.elements.meeting_type.value;
  const motivo = form.elements.motivo.value.trim();
  const description = form.elements.description.value.trim();

  if (!title) return toast('El nombre de la reunión es requerido', 'error');
  if (!date || !start_time || !end_time) return toast('Fecha y horario son requeridos', 'error');
  if (end_time <= start_time) return toast('La hora de fin debe ser posterior a la de inicio', 'error');
  if (!_meetingSelectedParticipants.length && !_meetingExternalParticipants.length) return toast('Selecciona al menos un participante', 'error');

  const payload = {
    project_id: _id, title, date, start_time, end_time, meeting_type, motivo, description,
    participants: _meetingSelectedParticipants.map(user_id => ({ user_id })),
    external_participants: _meetingExternalParticipants,
  };

  try {
    if (_editingMeetingId) {
      await api.put(`/calendar/meetings/${_editingMeetingId}`, payload);
      toast('Reunión actualizada');
    } else {
      await api.post('/calendar/meetings', payload);
      toast('Reunión programada');
    }
    _meetingFormOpen = false;
    _editingMeetingId = null;
    _meetingConflicts = [];
    await loadSchedule();
  } catch (err) {
    if (err.response?.data?.conflicts) {
      _meetingConflicts = err.response.data.conflicts;
      const bannerEl = document.getElementById('meeting-conflict-banner');
      if (bannerEl) bannerEl.innerHTML = conflictBannerHtml();
      const saveBtnEl = document.getElementById('meeting-save-btn');
      if (saveBtnEl) saveBtnEl.disabled = true;
    }
    toast(err.message || 'Error', 'error');
  }
}

function editMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || m.visibility === 'busy_only') return;
  _editingMeetingId = id;
  _meetingSelectedParticipants = (m.participants || []).filter(p => p.participant_type === 'internal').map(p => p.user_id);
  (m.participants || []).filter(p => p.participant_type === 'internal').forEach(p => {
    _meetingParticipantInfo.set(p.user_id, { name: p.user_name, area: p.user_area });
  });
  _meetingExternalParticipants = (m.participants || []).filter(p => p.participant_type === 'external')
    .map(p => ({ name: p.external_name, kind: p.external_kind }));
  _meetingConflicts = [];
  _meetingFormOpen = true;
  renderSchedule();
}

async function deleteMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || !confirm(`¿Deseas eliminar la reunión "${m.title}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api.delete(`/calendar/meetings/${id}`);
    toast('Reunión eliminada');
    if (_editingMeetingId === id) { _meetingFormOpen = false; _editingMeetingId = null; }
    await loadSchedule();
  } catch (err) { toast(err.message || 'Error', 'error'); }
}

function viewMeeting(id) {
  const m = _meetings.find(x => x.id === id);
  if (!m || m.visibility === 'busy_only') return;
  const participantsHtml = (m.participants || []).map(p => p.participant_type === 'external'
    ? `<li>${esc(p.external_name)} — ${EXTERNAL_KINDS.find(k=>k[0]===p.external_kind)?.[1] || p.external_kind} (externo)</li>`
    : `<li>${esc(p.user_name || '—')} — ${esc(MEETING_ROLE_LABEL[p.role] || p.user_area || p.role || '—')}</li>`).join('');
  showModal(esc(m.title), `
    <div class="space-y-3 text-sm">
      <p><span class="font-medium text-gray-700">Fecha:</span> ${fmtMeetingDate(m.meeting_date)}</p>
      <p><span class="font-medium text-gray-700">Horario:</span> ${m.start_time.slice(0,5)} — ${m.end_time.slice(0,5)}</p>
      ${m.meeting_type ? `<p><span class="font-medium text-gray-700">Tipo:</span> ${esc(m.meeting_type)}</p>` : ''}
      ${m.motivo ? `<p><span class="font-medium text-gray-700">Motivo:</span> ${esc(m.motivo)}</p>` : ''}
      ${m.description ? `<p><span class="font-medium text-gray-700">Descripción:</span> ${esc(m.description)}</p>` : ''}
      <div>
        <p class="font-medium text-gray-700 mb-1">Participantes:</p>
        <ul class="list-disc list-inside text-gray-600">${participantsHtml || '<li>Sin participantes</li>'}</ul>
      </div>
      <p class="text-xs text-gray-400">Programada por ${esc(m.created_by_name || '—')}</p>
    </div>
  `, 'md');
}

async function loadTechnologies() {
  try {
    const [techs, langCat, toolCat] = await Promise.all([
      api.get('/technologies', { project_id: _id }),
      api.get('/technology-catalog', { category: 'language' }),
      api.get('/technology-catalog', { category: 'tool' }),
    ]);
    _technologies = techs;
    _techCatalog = { language: langCat, tool: toolCat };
    renderTechnologies();
  } catch {
    const c = document.getElementById('tech-container');
    if (c) c.innerHTML = '<p class="text-center text-red-400 py-8 text-sm">Error al cargar las tecnologías</p>';
  }
}

function renderTechnologies() {
  const c = document.getElementById('tech-container');
  if (!c) return;
  c.innerHTML = `
  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    ${techColumn('Lenguajes', 'language')}
    ${techColumn('Herramientas', 'tool')}
  </div>`;
  wireTechnologies();
}

function techColumn(label, category) {
  const items = _technologies.filter(t => t.category === category);
  const catalog = _techCatalog[category] || [];
  return `
  <div class="card p-5">
    <h3 class="font-semibold text-gray-900 mb-4">${label}</h3>
    <div class="flex flex-wrap gap-2 mb-3" id="tech-list-${category}">
      ${items.length === 0
        ? '<p class="text-xs text-gray-400">Sin registrar</p>'
        : items.map(techChip).join('')}
    </div>
    <div class="flex gap-2 items-center">
      <input type="file" accept="image/*" id="tech-img-${category}" class="hidden" data-category="${category}">
      <button type="button" class="tech-img-btn w-9 h-9 shrink-0 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 hover:bg-gray-100" data-category="${category}" title="Imagen (opcional, solo para tecnologías nuevas)">
        <img id="tech-img-preview-${category}" class="hidden w-full h-full object-cover" alt="">
        <span id="tech-img-icon-${category}" class="material-icons text-gray-400" style="font-size:18px">image</span>
      </button>
      <div class="relative flex-1" data-tech-wrap="${category}">
        <input id="tech-new-${category}" autocomplete="off" class="input text-sm w-full" placeholder="${category === 'tool' ? 'Buscar o escribir: Figma, Docker...' : 'Buscar o escribir: JavaScript, Python...'}">
        <div id="tech-dropdown-${category}" class="tech-dropdown hidden absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto z-20"></div>
      </div>
      <button type="button" class="btn-secondary text-xs px-3 tech-add-btn" data-category="${category}">${icon('add',16)}</button>
    </div>
  </div>`;
}

function techAvatarHtml(name, image_url, sizeClass) {
  return image_url
    ? `<img src="${image_url}" class="${sizeClass} rounded object-cover shrink-0" alt="">`
    : `<span class="${sizeClass} rounded bg-indigo-200 flex items-center justify-center text-[9px] font-bold text-indigo-700 shrink-0">${esc((name || '?').charAt(0).toUpperCase())}</span>`;
}

function techDropdownOptionHtml(c) {
  return `
  <button type="button" class="tech-option w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left" data-id="${c.id}" data-name="${esc(c.name)}" data-image="${c.image_url || ''}">
    ${techAvatarHtml(c.name, c.image_url, 'w-5 h-5')}
    <span class="truncate">${esc(c.name)}</span>
  </button>`;
}

function techChip(t) {
  const avatar = t.image_url
    ? `<img src="${t.image_url}" class="w-4 h-4 rounded object-cover" alt="">`
    : `<span class="w-4 h-4 rounded bg-indigo-200 flex items-center justify-center text-[9px] font-bold text-indigo-700">${esc((t.name || '?').charAt(0).toUpperCase())}</span>`;
  return `
  <span class="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
    ${avatar}
    <button type="button" class="tech-edit-btn hover:underline" data-id="${t.id}" title="Editar">${esc(t.name)}</button>
    <button type="button" class="tech-del-btn text-indigo-300 hover:text-red-500 rounded-full flex items-center justify-center" data-id="${t.id}" title="Quitar">${icon('close',14)}</button>
  </span>`;
}

function wireTechnologies() {
  document.querySelectorAll('.tech-img-btn').forEach(btn => {
    btn.addEventListener('click', () => document.getElementById(`tech-img-${btn.dataset.category}`).click());
  });

  document.querySelectorAll('input[type="file"][id^="tech-img-"]').forEach(inp => {
    inp.addEventListener('change', () => {
      const category = inp.dataset.category;
      const file = inp.files[0] || null;
      _pendingTechImage[category] = file;
      const preview = document.getElementById(`tech-img-preview-${category}`);
      const iconEl = document.getElementById(`tech-img-icon-${category}`);
      if (file) {
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
        iconEl.classList.add('hidden');
      } else {
        preview.classList.add('hidden');
        iconEl.classList.remove('hidden');
      }
    });
  });

  document.querySelectorAll('.tech-add-btn').forEach(btn => {
    const category = btn.dataset.category;
    const input = document.getElementById(`tech-new-${category}`);
    const dropdown = document.getElementById(`tech-dropdown-${category}`);

    const closeDropdown = () => dropdown.classList.add('hidden');
    const openDropdown = () => {
      const q = input.value.trim().toLowerCase();
      const options = (_techCatalog[category] || [])
        .filter(c => !q || c.name.toLowerCase().includes(q))
        .slice(0, 8);
      if (!options.length) { closeDropdown(); return; }
      dropdown.innerHTML = options.map(techDropdownOptionHtml).join('');
      dropdown.querySelectorAll('.tech-option').forEach(opt => {
        opt.addEventListener('click', () => {
          input.value = opt.dataset.name;
          _pendingCatalogMatch[category] = { id: opt.dataset.id, name: opt.dataset.name, image_url: opt.dataset.image || null };
          closeDropdown();
        });
      });
      dropdown.classList.remove('hidden');
    };

    input.addEventListener('input', () => { _pendingCatalogMatch[category] = null; openDropdown(); });
    input.addEventListener('focus', openDropdown);

    const submit = async () => {
      const name = input.value.trim();
      if (!name) return;
      try {
        const picked = _pendingCatalogMatch[category] && _pendingCatalogMatch[category].name.toLowerCase() === name.toLowerCase()
          ? _pendingCatalogMatch[category] : null;
        const match = picked || (_techCatalog[category] || []).find(c => c.name.toLowerCase() === name.toLowerCase());
        if (match) {
          await api.post('/technologies', { project_id: _id, category, name, catalog_id: match.id });
        } else {
          const fd = new FormData();
          fd.append('project_id', _id);
          fd.append('category', category);
          fd.append('name', name);
          if (_pendingTechImage[category]) fd.append('image', _pendingTechImage[category]);
          await api.post('/technologies', fd);
        }
        _pendingTechImage[category] = null;
        _pendingCatalogMatch[category] = null;
        closeDropdown();
        await loadTechnologies();
      } catch (err) { toast(err.message || 'Error', 'error'); }
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.key === 'Escape') closeDropdown();
    });
  });

  document.querySelectorAll('.tech-edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const current = _technologies.find(t => t.id === btn.dataset.id);
      const name = prompt('Editar:', current?.name || '');
      if (!name || !name.trim() || name.trim() === current?.name) return;
      try {
        await api.put(`/technologies/${btn.dataset.id}`, { name: name.trim() });
        await loadTechnologies();
      } catch (err) { toast(err.message || 'Error', 'error'); }
    });
  });

  document.querySelectorAll('.tech-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await api.delete(`/technologies/${btn.dataset.id}`);
        _technologies = _technologies.filter(t => t.id !== btn.dataset.id);
        renderTechnologies();
      } catch (err) { toast(err.message || 'Error', 'error'); }
    });
  });
}

async function loadFamilyProjects(family) {
  try {
    const siblings = (await api.get('/projects', { family })).filter(x => x.id !== _id);
    const c = document.getElementById('family-list');
    if (!c) return;
    c.innerHTML = siblings.length === 0
      ? '<p class="text-center text-gray-400 py-2 text-sm">No hay otros proyectos en esta familia todavía</p>'
      : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${siblings.map(s => `
            <a href="#/projects/${s.id}" class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-sm transition-all">
              <div class="w-11 h-11 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                ${s.company_logo ? `<img src="${esc(s.company_logo)}" class="w-full h-full object-contain">` : icon('apartment', 18)}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900 truncate">${esc(s.name)}</p>
                <p class="text-xs text-gray-500 truncate">${PROJECT_TYPE_LABEL[s.project_type] || 'Sin tipo'} · ${esc(s.code)}</p>
              </div>
              ${projectStatusBadge(s.status)}
            </a>`).join('')}
        </div>`;
  } catch {
    const c = document.getElementById('family-list');
    if (c) c.innerHTML = '<p class="text-center text-red-400 py-2 text-sm">Error al cargar proyectos relacionados</p>';
  }
}

function parseGithubUrl(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/|\/$/g, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
  } catch { return null; }
}

async function loadGithubPreview(url) {
  const parsed = parseGithubUrl(url);
  if (!parsed) {
    const c = document.getElementById('gh-preview');
    if (c) c.innerHTML = githubFallback(url);
    return;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
    if (!res.ok) throw new Error('not ok');
    const repo = await res.json();
    const c = document.getElementById('gh-preview');
    if (!c) return;
    c.innerHTML = `
    <div class="flex items-start gap-4">
      <img src="${esc(repo.owner?.avatar_url || '')}" class="w-14 h-14 rounded-lg border border-gray-200 shrink-0">
      <div class="flex-1 min-w-0">
        <a href="${esc(repo.html_url)}" target="_blank" rel="noopener" class="font-semibold text-gray-900 hover:underline break-all">${esc(repo.full_name)}</a>
        ${repo.description ? `<p class="text-sm text-gray-500 mt-1">${esc(repo.description)}</p>` : ''}
        <div class="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
          ${repo.language ? `<span class="flex items-center gap-1">${icon('code', 14)} ${esc(repo.language)}</span>` : ''}
          <span class="flex items-center gap-1">${icon('star', 14)} ${repo.stargazers_count}</span>
          <span class="flex items-center gap-1">${icon('call_split', 14)} ${repo.forks_count}</span>
          ${repo.private ? `<span class="flex items-center gap-1 text-amber-600">${icon('lock', 14)} Privado</span>` : ''}
          <span>Actualizado ${fmtRelative(repo.pushed_at)}</span>
        </div>
      </div>
      <a href="${esc(repo.html_url)}" target="_blank" rel="noopener" class="btn-primary shrink-0">${icon('open_in_new', 16)} Abrir</a>
    </div>`;
    initGithubBrowser(parsed.owner, parsed.repo, repo.default_branch);
  } catch {
    const c = document.getElementById('gh-preview');
    if (c) c.innerHTML = githubFallback(url);
  }
}

function githubFallback(url) {
  return `
  <div class="text-center py-4">
    <span class="text-gray-300">${icon('code', 40)}</span>
    <p class="text-sm text-gray-500 mt-3 mb-1 break-all">${esc(url)}</p>
    <p class="text-xs text-gray-400 mb-4">No se pudo cargar la vista previa (repositorio privado o no disponible)</p>
    <a href="${esc(url)}" target="_blank" rel="noopener" class="btn-primary inline-flex">${icon('open_in_new', 16)} Abrir repositorio</a>
  </div>`;
}

let _ghOwner = null, _ghRepo = null, _ghBranch = 'main', _ghPath = '';

function initGithubBrowser(owner, repo, branch) {
  _ghOwner = owner; _ghRepo = repo; _ghBranch = branch || 'main'; _ghPath = '';
  loadGithubFiles();
}

async function loadGithubFiles() {
  const container = document.getElementById('gh-browser');
  if (!container) return;
  container.innerHTML = `
  <div class="card overflow-hidden">
    <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-sm flex items-center gap-1 flex-wrap" id="gh-breadcrumb"></div>
    <div class="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 text-xs" id="gh-commit-bar"></div>
    <div id="gh-file-table" class="divide-y divide-gray-50">
      <div class="flex justify-center py-6"><div class="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin"></div></div>
    </div>
  </div>`;
  renderGhBreadcrumb();

  const myOwner = _ghOwner, myRepo = _ghRepo, myPath = _ghPath;
  try {
    const [contentsRes, commitRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${myOwner}/${myRepo}/contents/${myPath}?ref=${_ghBranch}`),
      fetch(`https://api.github.com/repos/${myOwner}/${myRepo}/commits?path=${encodeURIComponent(myPath)}&sha=${_ghBranch}&per_page=1`),
    ]);
    if (myPath !== _ghPath) return; // el usuario ya navegó a otra carpeta
    if (!contentsRes.ok) throw new Error('not ok');
    let items = await contentsRes.json();
    if (!Array.isArray(items)) items = [items];
    items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));

    let lastCommit = null;
    if (commitRes.ok) {
      const commits = await commitRes.json();
      lastCommit = Array.isArray(commits) ? commits[0] : null;
    }

    const t = document.getElementById('gh-file-table');
    const bar = document.getElementById('gh-commit-bar');
    if (!t) return;

    if (bar) {
      bar.innerHTML = lastCommit ? `
        <div class="flex items-center gap-2 text-gray-600">
          ${lastCommit.author?.avatar_url ? `<img src="${esc(lastCommit.author.avatar_url)}" class="w-5 h-5 rounded-full">` : ''}
          <span class="font-medium text-gray-800">${esc(lastCommit.commit?.author?.name || 'commit')}</span>
          <span class="truncate flex-1">${esc((lastCommit.commit?.message || '').split('\n')[0])}</span>
          <span class="text-gray-400 shrink-0">${fmtRelative(lastCommit.commit?.author?.date)}</span>
        </div>` : '';
    }

    t.innerHTML = items.length === 0
      ? '<p class="text-center text-gray-400 py-6 text-sm">Carpeta vacía</p>'
      : items.map(it => `
        <div class="gh-item flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer" data-type="${it.type}" data-path="${esc(it.path)}" data-url="${esc(it.html_url)}">
          ${icon(it.type === 'dir' ? 'folder' : 'description', 16)}
          <span class="text-gray-700">${esc(it.name)}</span>
        </div>`).join('');

    t.querySelectorAll('.gh-item').forEach(row => {
      row.addEventListener('click', () => {
        if (row.dataset.type === 'dir') {
          _ghPath = row.dataset.path;
          loadGithubFiles();
        } else {
          window.open(row.dataset.url, '_blank', 'noopener');
        }
      });
    });
  } catch {
    if (myPath !== _ghPath) return;
    const t = document.getElementById('gh-file-table');
    if (t) t.innerHTML = '<p class="text-center text-gray-400 py-6 text-sm">No se pudo cargar el contenido del repositorio</p>';
  }
}

function renderGhBreadcrumb() {
  const bc = document.getElementById('gh-breadcrumb');
  if (!bc) return;
  const parts = _ghPath ? _ghPath.split('/') : [];
  let accum = '';
  const crumbs = [`<button class="gh-crumb font-semibold text-primary-600 hover:underline" data-path="">${esc(_ghRepo)}</button>`];
  parts.forEach(seg => {
    accum = accum ? `${accum}/${seg}` : seg;
    crumbs.push(`<span class="text-gray-300">/</span><button class="gh-crumb text-primary-600 hover:underline" data-path="${esc(accum)}">${esc(seg)}</button>`);
  });
  bc.innerHTML = crumbs.join(' ');
  bc.querySelectorAll('.gh-crumb').forEach(btn => {
    btn.addEventListener('click', () => { _ghPath = btn.dataset.path; loadGithubFiles(); });
  });
}

function requirementsColumn(label, items, type) {
  return `
  <div class="card p-5">
    <h3 class="font-semibold text-gray-900 mb-4">${label}</h3>
    <div class="space-y-2 max-h-96 overflow-y-auto pr-1" id="req-col-${type}">
      ${items.length === 0
        ? '<p class="text-xs text-gray-400 py-2 text-center">Sin requerimientos registrados</p>'
        : items.map(requirementRow).join('')}
    </div>
  </div>`;
}

function isResponsible() {
  const user = getUser();
  if (!user || !_project) return false;
  if (user.nivel_acceso >= 100) return true;
  return String(user.id) === String(_project.responsible_id);
}

function requirementRow(r) {
  const canEditProgress = isResponsible();
  return `
  <div class="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100">
    <div class="flex-1 text-sm text-gray-700 break-words rte-display">${sanitizeRichText(r.description || '')}</div>
    ${canEditProgress
      ? `<input type="number" min="0" max="100" value="${r.progress ?? 0}" class="req-progress-input input text-xs text-center shrink-0" style="width:56px;padding:3px 4px" data-id="${r.id}">`
      : `<span class="text-xs font-medium text-gray-500 shrink-0 mt-0.5" title="Solo el responsable puede editar el avance">${r.progress ?? 0}</span>`}
    <span class="text-xs text-gray-400 shrink-0 mt-1.5">%</span>
  </div>`;
}

async function refreshProjectProgress() {
  try {
    const proj = await api.get(`/projects/${_id}`);
    _project.progress = proj.progress;
    const pct = document.getElementById('progress-pct');
    const fill = document.getElementById('progress-fill');
    if (pct)  pct.textContent = `${proj.progress}%`;
    if (fill) fill.style.width = `${proj.progress}%`;
  } catch { /* no bloquea el flujo si falla el refresco */ }
}

function wireRequirementsTab() {
  document.querySelectorAll('.req-progress-input').forEach(inp => {
    inp.addEventListener('change', async () => {
      const value = Math.max(0, Math.min(100, parseInt(inp.value) || 0));
      inp.value = value;
      try {
        await api.put(`/requirements/${inp.dataset.id}`, { progress: value });
        const r = _requirements.find(x => x.id === inp.dataset.id);
        if (r) r.progress = value;
        refreshProjectProgress();
      } catch (err) { toast(err.message || 'Error', 'error'); }
    });
  });
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
    btn.addEventListener('click', async () => {
      try {
        const { url } = await api.get(`/documents/${btn.dataset.id}/file`);
        previewFile(url, btn.dataset.name);
      } catch (err) { toast(err.message || 'Error al abrir el archivo', 'error'); }
    });
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
