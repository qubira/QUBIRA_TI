import { api }      from '../api.js';
import { getUser, pageToken }  from '../state.js';
import { fmtDateTime, fmtMoney, projectStatusBadge, spinner, todayStr, icon, isOverdue, overdueBadge } from '../utils.js';

export function render() {
  const myToken = pageToken;
  const main = document.getElementById('main');
  main.innerHTML = spinner();

  Promise.all([
    api.get('/projects/stats'),
    api.get('/projects', { limit: 6 }),
    api.get('/activities', { limit: 15 }),
  ]).then(([stats, allProjects, activities]) => {
    if (myToken !== pageToken) return;
    const projects = allProjects.slice(0, 6);
    const user = getUser();
    main.innerHTML = `
    <div class="p-6 max-w-7xl mx-auto">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Bienvenido, ${user?.name} 👋</h1>
        <p class="text-gray-500 text-sm mt-1">${todayStr()}</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        ${statCard(icon('folder', 22), 'Total Proyectos', stats?.total ?? '—', 'bg-primary-600')}
        ${statCard(icon('trending_up', 22), 'Activos', stats?.active ?? '—', 'bg-green-500')}
        ${statCard(icon('schedule', 22), 'Pendientes', stats?.pending ?? '—', 'bg-yellow-500')}
        ${statCard(icon('check_circle', 22), 'Completados', stats?.completed ?? '—', 'bg-blue-500',
          stats?.budget != null ? `Presupuesto: ${fmtMoney(stats.budget)}` : '')}
        ${statCard(icon('warning', 22), 'Vencidos', stats?.overdue ?? '—', 'bg-red-500')}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Recent projects -->
        <div class="lg:col-span-2 card">
          <div class="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900">Proyectos Recientes</h2>
            <a href="#/projects" class="text-sm text-primary-600 hover:underline flex items-center gap-1">
              Ver todos ${icon('open_in_new', 14)}
            </a>
          </div>
          <div class="divide-y divide-gray-50">
            ${projects.length === 0
              ? '<p class="text-center text-gray-400 py-8 text-sm">No hay proyectos todavía</p>'
              : projects.map(p => `
                <a href="#/projects/${p.id}" class="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="font-medium text-gray-900 text-sm truncate">${esc(p.name)}</p>
                      ${projectStatusBadge(p.status)}
                      ${isOverdue(p) ? overdueBadge() : ''}
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5">${esc(p.client)} · ${esc(p.code)}</p>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="flex items-center gap-2 justify-end">
                      <div class="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full bg-primary-500 rounded-full" style="width:${p.progress}%"></div>
                      </div>
                      <span class="text-xs text-gray-500 w-8 text-right">${p.progress}%</span>
                    </div>
                    ${p.budget > 0 ? `<p class="text-xs text-gray-400 mt-1">${fmtMoney(p.budget)}</p>` : ''}
                  </div>
                </a>`).join('')}
          </div>
        </div>

        <!-- Activity -->
        <div class="card">
          <div class="p-5 border-b border-gray-100">
            <h2 class="font-semibold text-gray-900">Actividad Reciente</h2>
          </div>
          <div class="p-4 space-y-3 max-h-80 overflow-y-auto">
            ${activities.length === 0
              ? '<p class="text-center text-gray-400 py-4 text-sm">Sin actividad reciente</p>'
              : activities.map(a => `
                <div class="flex gap-3">
                  <div class="w-2 h-2 bg-primary-400 rounded-full mt-1.5 shrink-0"></div>
                  <div class="flex-1">
                    <p class="text-xs text-gray-700 leading-relaxed">${esc(a.description)}</p>
                    ${a.project_name ? `<p class="text-xs text-primary-600 mt-0.5">${esc(a.project_code)} — ${esc(a.project_name)}</p>` : ''}
                    <p class="text-xs text-gray-400 mt-0.5">${fmtDateTime(a.created_at)}</p>
                  </div>
                </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  }).catch(() => {
    if (myToken !== pageToken) return;
    main.innerHTML = '<p class="text-center text-gray-400 py-16">Error al cargar el dashboard</p>';
  });
}

function statCard(iconHtml, label, value, color, sub = '') {
  return `<div class="card p-5">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-sm text-gray-500">${label}</p>
        <p class="text-3xl font-bold text-gray-900 mt-1">${value}</p>
        ${sub ? `<p class="text-xs text-gray-400 mt-1">${sub}</p>` : ''}
      </div>
      <div class="w-11 h-11 rounded-xl flex items-center justify-center ${color} text-white shrink-0">${iconHtml}</div>
    </div>
  </div>`;
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
