import { api }                        from './api.js';
import { getUser, setUser, navigate, normalizeUser, bumpPageToken } from './state.js';
import { icon }                        from './utils.js';
import { render as renderLogin }       from './pages/login.js';
import { render as renderDashboard }   from './pages/dashboard.js';
import { render as renderProjects }    from './pages/projects.js';
import { render as renderProjectDetail } from './pages/project-detail.js';
import { render as renderDocuments }   from './pages/documents.js';
import { render as renderWhatsApp }    from './pages/whatsapp.js';
import { render as renderEmails }      from './pages/emails.js';
import { render as renderCalendario }  from './pages/calendario.js';
import { render as renderAuditoria }   from './pages/auditoria.js';

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

const QUALIFYING_AUDIT_CARGOS = ['SUPERVISOR', 'COORDINADOR', 'GERENTE'];
function canViewAudit(user) {
  if (!user) return false;
  if ((user.nivel_acceso || 0) >= 100) return true;
  return QUALIFYING_AUDIT_CARGOS.includes(String(user.cargo || '').toUpperCase());
}

const NAV = [
  { path: '/',           iconName: 'dashboard',     label: 'Dashboard',            exact: true },
  { path: '/projects',   iconName: 'folder',        label: 'Proyectos' },
  { path: '/calendario', iconName: 'calendar_month', label: 'Calendario' },
  { path: '/documents',  iconName: 'article',       label: 'Documentos' },
  { path: '/whatsapp',   iconName: 'chat',          label: 'WhatsApp' },
  { path: '/emails',     iconName: 'email',         label: 'Correos' },
  { path: '/auditoria',  iconName: 'fact_check',    label: 'Auditoría',  visible: canViewAudit },
];

function isActive(path, currentHash, exact) {
  if (exact) return currentHash === path;
  return currentHash === path || currentHash.startsWith(path + '/');
}

function navLink({ path, iconName, label, exact }, currentHash) {
  const active = isActive(path, currentHash, exact);
  const cls = active
    ? 'bg-primary-600 text-white'
    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200';
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
  <aside id="sidebar" class="flex flex-col h-full bg-gray-900 transition-all duration-300 shrink-0 ${collapsed ? 'w-16' : 'w-64'}">
    <!-- Logo -->
    <div class="flex items-center justify-between px-4 py-4 border-b border-gray-800 min-h-[64px]">
      <div class="flex items-center gap-2 ${collapsed ? 'mx-auto' : ''}">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
          <img src="https://raw.githubusercontent.com/qubira/IMAGENES/main/logo2.png" alt="Qubira" class="w-full h-full object-contain">
        </div>
        ${!collapsed ? '<span class="font-bold text-white text-lg">Qubira TI</span>' : ''}
      </div>
      ${!collapsed ? `<button id="sb-toggle" class="p-1 rounded-lg hover:bg-gray-800 text-gray-400">${icon('chevron_left', 20)}</button>` : ''}
    </div>

    <!-- Nav -->
    <nav class="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
      ${!collapsed ? '<p class="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mb-2">Principal</p>' : ''}
      ${NAV.filter(n => !n.visible || n.visible(user)).map(n => navLink(n, currentHash)).join('')}
    </nav>

    <!-- User -->
    <div class="border-t border-gray-800 p-2">
      ${!collapsed ? `
      <div class="flex items-center gap-3 px-2 py-2">
        <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
          <span class="text-primary-700 font-semibold text-sm">${user.name?.[0]?.toUpperCase()}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white truncate">${user.name}</p>
          <p class="text-xs text-gray-400 capitalize">${user.role}</p>
        </div>
        <button id="logout-btn" class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400" title="Cerrar sesión">${icon('logout', 18)}</button>
      </div>` : `
      <div class="flex flex-col items-center gap-2 py-2">
        <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
          <span class="text-primary-700 font-semibold text-sm">${user.name?.[0]?.toUpperCase()}</span>
        </div>
        <button id="logout-btn" class="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400">${icon('logout', 18)}</button>
        <button id="sb-toggle" class="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400">${icon('chevron_right', 18)}</button>
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

  bumpPageToken();
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
addRoute('/calendario',      () => renderCalendario());
addRoute('/auditoria',       () => renderAuditoria());
addRoute('/documents',       () => renderDocuments());
addRoute('/whatsapp',        () => renderWhatsApp());
addRoute('/emails',          () => renderEmails());

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('hashchange', handleRoute);

const CENTRAL_LOGIN_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:5515/login.html'
  : 'https://qubira-login.vercel.app/login.html';

function isAuthorizedForThisPanel(central) {
  return (central.authorized_modules || []).includes('TI');
}

window.addEventListener('DOMContentLoaded', async () => {
  const handoffCode = new URLSearchParams(location.search).get('handoff');

  if (handoffCode) {
    try {
      const data = await api.post('/auth/exchange', { code: handoffCode });
      if (!isAuthorizedForThisPanel(data.user)) { window.location.href = CENTRAL_LOGIN_URL; return; }
      const user = normalizeUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      history.replaceState(null, '', location.pathname + location.hash);
    } catch {
      window.location.href = CENTRAL_LOGIN_URL;
      return;
    }
    handleRoute();
    return;
  }

  const token = localStorage.getItem('token');
  if (token) {
    try {
      const { user: central } = await api.get('/auth/me');
      if (!isAuthorizedForThisPanel(central)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = CENTRAL_LOGIN_URL;
        return;
      }
      const user = normalizeUser(central);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
  handleRoute();
});
