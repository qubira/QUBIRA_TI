import { api }                                          from '../api.js';
import { toast, showModal, closeModal, pageHeader,
         fmtDate, spinner, icon }                       from '../utils.js';

let _messages = [], _projects = [], _contacts = [];
let _filter = { project_id: '', contact_name: '' };
let _selectedContact = null;

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto flex flex-col" style="height:calc(100vh - 0px)" id="wa-page">${spinner()}</div>`;
  Promise.all([
    api.get('/projects'),
    api.get('/whatsapp/contacts'),
  ]).then(([p, c]) => { _projects = p; _contacts = c; load(); });
}

function load() {
  api.get('/whatsapp', _filter).then(data => { _messages = data; renderPage(); });
}

function renderPage() {
  const c = document.getElementById('wa-page');
  if (!c) return;

  const filtered = _selectedContact ? _messages.filter(m => m.contact_name === _selectedContact) : _messages;
  const projOpts = _projects.map(p => `<option value="${p.id}" ${_filter.project_id==p.id?'selected':''}>${esc(p.name)}</option>`).join('');

  c.innerHTML = `
  ${pageHeader('WhatsApp',
    `${_messages.length} mensaje${_messages.length!==1?'s':''}`,
    `<button id="bulk-btn" class="btn-secondary">${icon('import_export',18)} Importar Chat</button>
     <button id="new-msg-btn" class="btn-primary">${icon('add',20)} Nuevo Mensaje</button>`)}

  <div class="flex gap-4 flex-1 overflow-hidden min-h-0">
    <!-- Contacts sidebar -->
    <div class="w-64 shrink-0 card flex flex-col overflow-hidden">
      <div class="p-3 border-b border-gray-100">
        <div class="relative">
          <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" style="font-size:16px">search</span>
          <input id="contact-search" class="input pl-8 text-xs py-1.5" placeholder="Buscar contacto..." value="${esc(_filter.contact_name)}">
        </div>
      </div>
      <div class="p-3 border-b border-gray-100">
        <select id="wa-project" class="input text-xs py-1.5"><option value="">Todos los proyectos</option>${projOpts}</select>
      </div>
      <div class="flex-1 overflow-y-auto" id="contacts-list">
        <button data-contact="" class="contact-btn w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 text-left border-b border-gray-50 ${!_selectedContact?'bg-primary-50':''}">
          <div class="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center shrink-0">
            <span class="material-icons text-white" style="font-size:20px">chat</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900">Todos</p>
            <p class="text-xs text-gray-400">${_messages.length} mensajes</p>
          </div>
        </button>
        ${_contacts.map(ct => `
          <button data-contact="${esc(ct.contact_name)}" class="contact-btn w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 text-left border-b border-gray-50 ${_selectedContact===ct.contact_name?'bg-primary-50':''}">
            <div class="w-9 h-9 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shrink-0">
              <span class="text-white font-bold text-sm">${esc(ct.contact_name?.[0]?.toUpperCase())}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">${esc(ct.contact_name)}</p>
              <p class="text-xs text-gray-400">${ct.message_count} mensajes</p>
            </div>
          </button>`).join('')}
      </div>
    </div>

    <!-- Messages area -->
    <div class="flex-1 card flex flex-col overflow-hidden min-w-0">
      <div class="px-4 py-3 border-b border-gray-100 bg-green-50 flex items-center gap-3 shrink-0">
        <div class="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center">
          <span class="material-icons text-white" style="font-size:20px">chat</span>
        </div>
        <div>
          <p class="font-medium text-gray-900 text-sm">${_selectedContact ? esc(_selectedContact) : 'Todos los mensajes'}</p>
          <p class="text-xs text-gray-500">${filtered.length} mensaje${filtered.length!==1?'s':''}</p>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-2 wa-bg" id="messages-area">
        ${filtered.length === 0 ? `
          <div class="h-full flex items-center justify-center">
            <div class="text-center"><span class="material-icons text-gray-300" style="font-size:48px">chat</span>
              <p class="text-gray-400 text-sm mt-2">No hay mensajes</p>
            </div>
          </div>` : filtered.map(msgBubble).join('')}
        <div id="msgs-bottom"></div>
      </div>
    </div>
  </div>`;

  document.getElementById('new-msg-btn').addEventListener('click', () => openNewMsgModal());
  document.getElementById('bulk-btn').addEventListener('click', () => openBulkModal());
  document.getElementById('contact-search').addEventListener('input', e => { _filter.contact_name = e.target.value; load(); });
  document.getElementById('wa-project').addEventListener('change', e => { _filter.project_id = e.target.value; load(); });

  document.querySelectorAll('.contact-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _selectedContact = btn.dataset.contact || null;
      renderPage();
    });
  });

  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.put(`/whatsapp/${btn.dataset.id}/star`);
      load();
    });
  });

  document.querySelectorAll('.del-msg').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar mensaje?')) return;
      await api.delete(`/whatsapp/${btn.dataset.id}`);
      load();
    });
  });

  document.getElementById('msgs-bottom')?.scrollIntoView({ behavior: 'smooth' });
}

function msgBubble(m) {
  const sent = m.direction === 'sent';
  return `
  <div class="flex items-end gap-2 ${sent?'justify-end':'justify-start'} group">
    ${!sent ? `<div class="w-7 h-7 bg-gray-400 rounded-full flex items-center justify-center shrink-0 mb-1">
      <span class="text-white text-xs font-bold">${esc(m.contact_name?.[0]?.toUpperCase())}</span>
    </div>` : ''}
    <div class="relative max-w-xs lg:max-w-md">
      <div class="px-3 py-2 rounded-lg shadow-sm text-sm ${sent?'bg-[#d9fdd3] rounded-br-none':'bg-white rounded-bl-none'}">
        ${!sent && !_selectedContact ? `<p class="text-xs font-semibold text-green-700 mb-1">${esc(m.contact_name)}</p>` : ''}
        <p class="whitespace-pre-wrap text-gray-900">${esc(m.content)}</p>
        <div class="flex items-center justify-end gap-2 mt-1">
          <span class="text-[10px] text-gray-400">${fmtDate(m.msg_date,'dd/MM HH:mm')}</span>
          ${m.project_name ? `<span class="text-[10px] text-blue-500">${esc(m.project_name)}</span>` : ''}
        </div>
      </div>
      <div class="absolute -top-7 right-0 hidden group-hover:flex items-center gap-1 bg-white rounded-lg shadow px-1.5 py-1 z-10">
        <button class="star-btn text-gray-400 hover:text-yellow-500" data-id="${m.id}">
          <span class="material-icons" style="font-size:14px">${m.starred?'star':'star_border'}</span>
        </button>
        <button class="del-msg text-gray-400 hover:text-red-500" data-id="${m.id}">
          <span class="material-icons" style="font-size:14px">delete</span>
        </button>
      </div>
    </div>
  </div>`;
}

function openNewMsgModal() {
  const projOpts = _projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  showModal('Registrar Mensaje', `
  <form id="msg-form" class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="label">Contacto *</label>
        <input class="input" name="contact_name" required placeholder="Nombre del contacto" value="${esc(_selectedContact||'')}">
      </div>
      <div>
        <label class="label">Teléfono</label>
        <input class="input" name="phone" placeholder="+593...">
      </div>
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
    </div>
    <div>
      <label class="label">Fecha y hora</label>
      <input class="input" type="datetime-local" name="msg_date">
    </div>
    <div>
      <label class="label">Mensaje *</label>
      <textarea class="input resize-none" name="content" rows="4" required placeholder="Contenido del mensaje..."></textarea>
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1 justify-center">Guardar</button>
      <button type="button" id="msg-cancel" class="btn-secondary">Cancelar</button>
    </div>
  </form>`, 'md');

  document.getElementById('msg-cancel').addEventListener('click', closeModal);
  document.getElementById('msg-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    if (!body.msg_date) body.msg_date = new Date().toISOString();
    try {
      await api.post('/whatsapp', body);
      toast('Mensaje guardado');
      closeModal();
      api.get('/whatsapp/contacts').then(c => { _contacts = c; });
      load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

function openBulkModal() {
  const projOpts = _projects.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  showModal('Importar Chat de WhatsApp', `
  <form id="bulk-form" class="space-y-4">
    <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-800">
      <strong>Cómo exportar:</strong> WhatsApp → conversación → Más opciones (⋮) → Exportar chat → Sin archivos multimedia. Pega el texto aquí.
    </div>
    <div>
      <label class="label">Proyecto (opcional)</label>
      <select class="input" name="project_id"><option value="">— Sin proyecto —</option>${projOpts}</select>
    </div>
    <div>
      <label class="label">Pega el texto del chat exportado *</label>
      <textarea class="input resize-none font-mono text-xs" name="bulkText" rows="12"
        placeholder="[15/01/2024, 09:30:00] Juan Pérez: Hola buenos días..."></textarea>
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1 justify-center" style="background:#16a34a">Importar Mensajes</button>
      <button type="button" id="bulk-cancel" class="btn-secondary">Cancelar</button>
    </div>
  </form>`, 'lg');

  document.getElementById('bulk-cancel').addEventListener('click', closeModal);
  document.getElementById('bulk-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const bulkText = fd.get('bulkText');
    const project_id = fd.get('project_id') || null;
    if (!bulkText?.trim()) { toast('Pega el texto del chat', 'error'); return; }
    const msgs = parseBulk(bulkText);
    try {
      await api.post('/whatsapp/bulk', { project_id, messages: msgs });
      toast(`${msgs.length} mensajes importados`);
      closeModal();
      api.get('/whatsapp/contacts').then(c => { _contacts = c; });
      load();
    } catch { toast('Error al importar', 'error'); }
  });
}

function parseBulk(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const msgs = [];
  const pat = /^\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:a\.m\.|p\.m\.|AM|PM)?\]?\s+-?\s*(.+?):\s(.+)$/;
  let cur = null;
  for (const line of lines) {
    const m = line.match(pat);
    if (m) {
      if (cur) msgs.push(cur);
      cur = { contact_name: m[3].trim(), content: m[4], msg_date: new Date().toISOString(), direction: 'received' };
    } else if (cur) {
      cur.content += '\n' + line;
    }
  }
  if (cur) msgs.push(cur);
  return msgs.length > 0 ? msgs : lines.map(l => ({ contact_name: 'Importado', content: l, msg_date: new Date().toISOString(), direction: 'received' }));
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
