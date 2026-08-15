import { api }                                        from '../api.js';
import { getUser }                                    from '../state.js';
import { toast, showModal, closeModal, pageHeader,
         fmtDate, spinner, icon }                    from '../utils.js';

const ROLE_LABEL = { admin:'Administrador', manager:'Gerente', technical:'Técnico' };
const ROLE_COLOR = { admin:'bg-purple-100 text-purple-800', manager:'bg-blue-100 text-blue-800', technical:'bg-green-100 text-green-800' };

let _users = [];

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-4xl mx-auto" id="users-page">${spinner()}</div>`;
  load();
}

function load() {
  api.get('/users').then(data => { _users = data; renderPage(); });
}

function renderPage() {
  const c = document.getElementById('users-page');
  if (!c) return;
  const me = getUser();

  c.innerHTML = `
  ${pageHeader('Gestión de Usuarios', 'Control de acceso al sistema',
    `<button id="new-user-btn" class="btn-primary">${icon('add',20)} Nuevo Usuario</button>`)}

  <div class="card overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-gray-50 border-b border-gray-200">
          <th class="text-left px-4 py-3 font-semibold text-gray-600">Usuario</th>
          <th class="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
          <th class="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
          <th class="text-left px-4 py-3 font-semibold text-gray-600">Creado</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        ${_users.map(u => userRow(u, me)).join('')}
      </tbody>
    </table>
  </div>`;

  document.getElementById('new-user-btn').addEventListener('click', () => openModal());

  document.querySelectorAll('.edit-user').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = _users.find(x => String(x.id) === btn.dataset.id);
      if (u) openModal(u);
    });
  });

  document.querySelectorAll('.toggle-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const u = _users.find(x => String(x.id) === btn.dataset.id);
      if (!u) return;
      if (u.id === me?.id) { toast('No puedes desactivarte a ti mismo', 'error'); return; }
      try {
        await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
        toast(u.active ? 'Usuario desactivado' : 'Usuario activado');
        load();
      } catch { toast('Error', 'error'); }
    });
  });
}

function userRow(u, me) {
  const isMe = u.id === me?.id;
  return `
  <tr class="hover:bg-gray-50 ${!u.active?'opacity-50':''}">
    <td class="px-4 py-3">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isMe?'bg-primary-100 text-primary-700':'bg-gray-100 text-gray-600'}">
          ${esc(u.name?.[0]?.toUpperCase())}
        </div>
        <div>
          <p class="font-medium text-gray-900">${esc(u.name)} ${isMe?'<span class="text-xs text-primary-600">(tú)</span>':''}</p>
          <p class="text-xs text-gray-500">@${esc(u.username)}</p>
        </div>
      </div>
    </td>
    <td class="px-4 py-3">
      <span class="badge ${ROLE_COLOR[u.role]||'bg-gray-100 text-gray-700'}">${ROLE_LABEL[u.role]||u.role}</span>
    </td>
    <td class="px-4 py-3">
      <span class="badge ${u.active?'bg-green-100 text-green-800':'bg-red-100 text-red-700'}">${u.active?'Activo':'Inactivo'}</span>
    </td>
    <td class="px-4 py-3 text-gray-500 text-xs">${fmtDate(u.created_at)}</td>
    <td class="px-4 py-3">
      <div class="flex gap-1 justify-end">
        <button class="edit-user p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" data-id="${u.id}">
          ${icon('edit',16)}
        </button>
        ${!isMe ? `<button class="toggle-user p-1.5 rounded text-gray-400 ${u.active?'hover:bg-red-50 hover:text-red-600':'hover:bg-green-50 hover:text-green-600'}" data-id="${u.id}" title="${u.active?'Desactivar':'Activar'}">
          <span class="material-icons" style="font-size:16px">${u.active?'person_off':'person'}</span>
        </button>` : ''}
      </div>
    </td>
  </tr>`;
}

function openModal(editing = null) {
  showModal(editing ? 'Editar Usuario' : 'Nuevo Usuario', `
  <form id="user-form" class="space-y-4">
    <div>
      <label class="label">Nombre completo *</label>
      <input class="input" name="name" required value="${esc(editing?.name||'')}" placeholder="Nombre y apellido">
    </div>
    <div>
      <label class="label">Usuario *</label>
      <input class="input" type="text" name="username" required value="${esc(editing?.username||'')}" placeholder="nombre.usuario">
    </div>
    ${!editing ? `<div>
      <label class="label">Contraseña *</label>
      <input class="input" type="password" name="password" required minlength="8" placeholder="Mínimo 8 caracteres">
    </div>` : ''}
    <div>
      <label class="label">Rol</label>
      <select class="input" name="role">
        <option value="technical" ${editing?.role==='technical'?'selected':''}>Técnico</option>
        <option value="manager"   ${editing?.role==='manager'  ?'selected':''}>Gerente</option>
        <option value="admin"     ${editing?.role==='admin'    ?'selected':''}>Administrador</option>
      </select>
    </div>
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1 justify-center">${editing ? 'Guardar' : 'Crear Usuario'}</button>
      <button type="button" id="user-cancel" class="btn-secondary">Cancelar</button>
    </div>
  </form>`, 'sm');

  document.getElementById('user-cancel').addEventListener('click', closeModal);
  document.getElementById('user-form').addEventListener('submit', async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    if (editing) delete body.password;
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, body);
        toast('Usuario actualizado');
      } else {
        await api.post('/users', body);
        toast('Usuario creado');
      }
      closeModal(); load();
    } catch (err) { toast(err.message || 'Error', 'error'); }
  });
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
