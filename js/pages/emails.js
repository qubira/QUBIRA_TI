import { api }                                         from '../api.js';
import { toast, showModal, closeModal, pageHeader,
         fmtDate, fmtRelative, spinner, icon }         from '../utils.js';

let _emails = [], _projects = [];
let _filter = { project_id: '', direction: '', search: '' };
let _selected = null;
let _debounce;

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto" id="emails-page">${spinner()}</div>`;
  api.get('/projects').then(p => { _projects = p; });
  load();
}

function load() {
  api.get('/emails', _filter).then(data => { _emails = data; _selected = null; renderPage(); });
}

function renderPage() {
  const c = document.getElementById('emails-page');
  if (!c) return;

  const projOpts = _projects.map(p => `<option value="${p.id}" ${_filter.project_id==p.id?'selected':''}>${esc(p.name)}</option>`).join('');

  c.innerHTML = `
  ${pageHeader('Correos Electrónicos',
    `${_emails.length} correo${_emails.length!==1?'s':''}`,
    `<button id="new-email-btn" class="btn-primary">${icon('add',20)} Registrar Correo</button>`)}

  <div class="flex flex-wrap gap-3 mb-5">
    <div class="relative flex-1 min-w-[200px]">
      <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:18px">search</span>
      <input id="email-search" class="input pl-9" placeholder="Buscar asunto o remitente..." value="${esc(_filter.search)}">
    </div>
    <select id="f-project" class="input w-auto"><option value="">Todos los proyectos</option>${projOpts}</select>
    <select id="f-dir" class="input w-auto">
      <option value="">Todos</option>
      <option value="received" ${_filter.direction==='received'?'selected':''}>Recibidos</option>
      <option value="sent"     ${_filter.direction==='sent'    ?'selected':''}>Enviados</option>
    </select>
  </div>

  <div class="flex gap-4" style="height:calc(100vh - 290px)">
    <!-- Email list -->
    <div class="${_selected?'w-80 shrink-0':'flex-1'} card overflow-hidden flex flex-col">
      <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        ${_emails.length} correos
      </div>
      <div class="flex-1 overflow-y-auto divide-y divide-gray-50">
        ${_emails.length === 0 ? `
          <div class="p-10 text-center">
            <span class="material-icons text-gray-300" style="font-size:40px">email</span>
            <p class="text-gray-400 text-sm mt-2">No hay correos</p>
          </div>` : _emails.map(emailRow).join('')}
      </div>
    </div>

    <!-- Email detail -->
    ${_selected ? emailDetail(_selected) : ''}
  </div>`;

  document.getElementById('new-email-btn').addEventListener('click', () => openModal());
  document.getElementById('email-search').addEventListener('input', e => {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => { _filter.search = e.target.value; load(); }, 300);
  });
  document.getElementById('f-project').addEventListener('change', e => { _filter.project_id = e.target.value; load(); });
  document.getElementById('f-dir').addEventListener('change',     e => { _filter.direction   = e.target.value; load(); });

  document.querySelectorAll('.email-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      _selected = _selected?.id === id ? null : _emails.find(e => e.id === id);
      renderPage();
    });
  });

  document.querySelectorAll('.star-email').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await api.put(`/emails/${btn.dataset.id}/star`);
      load();
    });
  });

  document.querySelectorAll('.del-email').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('¿Eliminar correo?')) return;
      await api.delete(`/emails/${btn.dataset.id}`);
      load();
    });
  });
}

function emailRow(e) {
  const sel = _selected?.id === e.id;
  return `
  <button class="email-row w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${sel?'bg-primary-50 border-l-2 border-primary-500':''}" data-id="${e.id}">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${e.direction==='sent'?'bg-blue-100':'bg-purple-100'}">
        <span class="material-icons ${e.direction==='sent'?'text-blue-600':'text-purple-600'}" style="font-size:16px">${e.direction==='sent'?'send':'inbox'}</span>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1">
          <p class="text-sm font-medium text-gray-900 truncate">${esc(e.subject)}</p>
          <button class="star-email shrink-0 text-gray-300 hover:text-yellow-400" data-id="${e.id}">
            <span class="material-icons" style="font-size:16px">${e.starred?'star':'star_border'}</span>
          </button>
        </div>
        <p class="text-xs text-gray-500 truncate">
          ${e.direction==='received' ? esc(e.from_name||e.from_email) : `Para: ${esc(e.to_email)}`}
        </p>
        <div class="flex items-center gap-2 mt-0.5">
          ${e.project_name ? `<span class="text-xs text-blue-600 truncate max-w-[120px]">${esc(e.project_name)}</span>` : ''}
          <span class="text-xs text-gray-400 ml-auto shrink-0">${fmtDate(e.email_date,'dd/MM/yy')}</span>
        </div>
      </div>
    </div>
  </button>`;
}

function emailDetail(e) {
  return `
  <div class="flex-1 card overflow-hidden flex flex-col">
    <div class="px-6 py-4 border-b border-gray-100">
      <div class="flex items-start justify-between gap-4">
        <h2 class="font-semibold text-gray-900 text-lg">${esc(e.subject)}</h2>
        <button class="del-email p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 shrink-0" data-id="${e.id}">${icon('delete',18)}</button>
      </div>
      <div class="mt-3 space-y-1 text-sm">
        <p class="text-gray-600"><span class="font-medium">De:</span> ${e.from_name ? `${esc(e.from_name)} &lt;${esc(e.from_email)}&gt;` : esc(e.from_email||'—')}</p>
        <p class="text-gray-600"><span class="font-medium">Para:</span> ${esc(e.to_email||'—')}</p>
        <p class="text-gray-600"><span class="font-medium">Fecha:</span> ${fmtRelative(e.email_date)}</p>
        ${e.project_name ? `<p class="text-gray-600"><span class="font-medium">Proyecto:</span> ${esc(e.project_name)}</p>` : ''}
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-6">
      ${e.body
        ? `<p class="text-gray-800 whitespace-pre-wrap leading-relaxed">${esc(e.body)}</p>`
        : '<p class="text-gray-400 italic">Sin contenido registrado</p>'}
    </div>
  </div>`;
}

function openModal() {
  const projOpts = _projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  showModal('Registrar Correo', `
  <form id="email-form" class="space-y-4">
    <div>
      <label class="label">Asunto *</label>
      <input class="input" name="subject" required placeholder="Asunto del correo">
    </div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="label">Dirección</label>
        <select class="input" name="direction">
          <option value="received">Recibido</option>
          <option value="sent">Enviado</option>
        </select>
      </div>
      <div>
        <label class="label">Proyecto</label>
        <select class="input" name="project_id"><option value="">— Sin proyecto —</option>${projOpts}</select>
      </div>
      <div>
        <label class="label">Nombre Remitente</label>
        <input class="input" name="from_name" placeholder="Nombre del remitente">
      </div>
      <div>
        <label class="label">Email Remitente</label>
        <input class="input" type="email" name="from_email" placeholder="remitente@email.com">
      </div>
      <div>
        <label class="label">Email Destino</label>
        <input class="input" type="email" name="to_email" placeholder="destino@email.com">
      </div>
      <div>
        <label class="label">Fecha</label>
        <input class="input" type="datetime-local" name="email_date">
      </div>
    </div>
    <div>
      <label class="label">Cuerpo del correo</label>
      <textarea class="input resize-none" name="body" rows="6" placeholder="Pega aquí el contenido del correo..."></textarea>
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1 justify-center">Guardar Correo</button>
      <button type="button" id="email-cancel" class="btn-secondary">Cancelar</button>
    </div>
  </form>`, 'lg');

  document.getElementById('email-cancel').addEventListener('click', closeModal);
  document.getElementById('email-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    if (!body.email_date) body.email_date = new Date().toISOString();
    try {
      await api.post('/emails', body);
      toast('Correo registrado');
      closeModal(); load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
