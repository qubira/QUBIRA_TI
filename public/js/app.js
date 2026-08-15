import { api }                        from './api.js';
import { getUser, setUser, navigate }  from './state.js';
import { icon }                        from './utils.js';
import { render as renderLogin }       from './pages/login.js';
import { render as renderDashboard }   from './pages/dashboard.js';
import { render as renderProjects }    from './pages/projects.js';
import { render as renderProjectDetail } from './pages/project-detail.js';
import { render as renderContracts }   from './pages/contracts.js';
import { render as renderDocuments }   from './pages/documents.js';
import { render as renderWhatsApp }    from './pages/whatsapp.js';
import { render as renderEmails }      from './pages/emails.js';
import { render as renderUsers }       from './pages/users.js';

// ─── Router ───────────────────────────────────────────────────────────────────
const exactRoutes = {};
const paramRoutes = [];

function addRoute(pattern, handler) {
  if (!pattern.includes(':')) {
    exactRoutes[pattern] = handler;
  } else {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    paramRoutes.push({ re, keys, handler });
  }
}

function matchRoute(hash) {
  if (exactRoutes[hash]) return { handler: exactRoutes[hash], params: {} };
  for (const { re, keys, handler } of paramRoutes) {
    const m = hash.match(re);
    if (m) {
      const params = {};
      keys.forEach((k, i) => { params[k] = m[i + 1]; });
      return { handler, params };
    }
  }
  return null;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
let sidebarCollapsed = localStorage.getItem('sb') === '1';

const NAV = [
  { path: '/',          iconName: 'dashboard',   label: 'Dashboard',            exact: true },
  { path: '/projects',  iconName: 'folder',      label: 'Proyectos' },
  { path: '/contracts', iconName: 'description', label: 'Contratos & Proformas' },
  { path: '/documents', iconName: 'article',     label: 'Documentos' },
  { path: '/whatsapp',  iconName: 'chat',        label: 'WhatsApp' },
  { path: '/emails',    iconName: 'email',       label: 'Correos' },
];

function isActive(path, currentHash, exact) {
  if (exact) return currentHash === path;
  return currentHash === path || currentHash.startsWith(path + '/');
}

function navLink({ path, iconName, label, exact }, currentHash) {
  const active = isActive(path, currentHash, exact);
  const cls = active
    ? 'bg-primary-600 text-white'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';
  return `<a href="#${path}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${cls}" title="${sidebarCollapsed ? label : ''}">
    ${icon(iconName, 20)}
    ${!sidebarCollapsed ? `<span>${label}</span>` : ''}
  </a>`;
}

function renderSidebar(currentHash) {
  const user = getUser();
  if (!user) return;

  const sc = document.getElementById('sidebar-container');
  const collapsed = sidebarCollapsed;

  sc.innerHTML = `
  <aside id="sidebar" class="flex flex-col bg-white border-r border-gray-200 transition-all duration-300 shrink-0 ${collapsed ? 'w-16' : 'w-64'}">
    <!-- Logo -->
    <div class="flex items-center justify-between px-4 py-4 border-b border-gray-200 min-h-[64px]">
      <div class="flex items-center gap-2 ${collapsed ? 'mx-auto' : ''}">
        <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
          <span class="text-white font-bold text-sm">Q</span>
        </div>
        ${!collapsed ? '<span class="font-bold text-gray-900 text-lg">Qubira</span>' : ''}
      </div>
      ${!collapsed ? `<button id="sb-toggle" class="p-1 rounded-lg hover:bg-gray-100 text-gray-500">${icon('chevron_left', 20)}</button>` : ''}
    </div>

    <!-- Nav -->
    <nav class="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
      ${!collapsed ? '<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">Principal</p>' : ''}
      ${NAV.map(n => navLink(n, currentHash)).join('')}
      ${user.role === 'admin' ? `
        ${!collapsed ? '<p class="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-4 mb-2">Administración</p>' : ''}
        <a href="#/users" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive('/users', currentHash) ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}" title="${collapsed ? 'Usuarios' : ''}">
          ${icon('people', 20)}
          ${!collapsed ? '<span>Usuarios</span>' : ''}
        </a>` : ''}
    </nav>

    <!-- User -->
    <div class="border-t border-gray-200 p-2">
      ${!collapsed ? `
      <div class="flex items-center gap-3 px-2 py-2">
        <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
          <span class="text-primary-700 font-semibold text-sm">${user.name?.[0]?.toUpperCase()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">${user.name}</p>
          <p class="text-xs text-gray-500 capitalize">${user.role}</p>
        </div>
        <button id="logout-btn" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Cerrar sesión">${icon('logout', 18)}</button>
      </div>` : `
      <div class="flex flex-col items-center gap-2 py-2">
        <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <span class="text-primary-700 font-semibold text-sm">${user.name?.[0]?.toUpperCase()}</span>
        </div>
        <button id="logout-btn" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">${icon('logout', 18)}</button>
        <button id="sb-toggle" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">${icon('chevron_right', 18)}</button>
      </div>`}
    </div>
  </aside>`;

  document.getElementById('sb-toggle')?.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    localStorage.setItem('sb', sidebarCollapsed ? '1' : '0');
    renderSidebar(location.hash.slice(1) || '/');
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  });
}

// ─── Route handling ───────────────────────────────────────────────────────────
function handleRoute() {
  const hash = location.hash.slice(1) || '/';
  const user = getUser();

  if (!user && hash !== '/login') { navigate('/login'); return; }
  if (user  && hash === '/login') { navigate('/');     return; }

  const main = document.getElementById('main');
  const sc   = document.getElementById('sidebar-container');

  if (user) {
    renderSidebar(hash);
    main.className = 'flex-1 overflow-y-auto';
  } else {
    sc.innerHTML = '';
    main.className = 'flex-1';
  }

  const matched = matchRoute(hash);
  if (matched) {
    matched.handler(matched.params);
  } else {
    navigate(user ? '/' : '/login');
  }
}

// ─── Register routes ──────────────────────────────────────────────────────────
addRoute('/',                () => renderDashboard());
addRoute('/login',           () => renderLogin());
addRoute('/projects',        () => renderProjects());
addRoute('/projects/:id',    p  => renderProjectDetail(p));
addRoute('/contracts',       () => renderContracts());
addRoute('/documents',       () => renderDocuments());
addRoute('/whatsapp',        () => renderWhatsApp());
addRoute('/emails',          () => renderEmails());
addRoute('/users',           () => renderUsers());

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('hashchange', handleRoute);

window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const user = await api.get('/auth/me');
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
  handleRoute();
});
