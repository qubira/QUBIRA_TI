import { montarLista } from '../flujo-panel.js';

/* Flujo de proyectos: en qué etapa está cada proyecto y qué puerta le toca aprobar a cada uno */
export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-7xl mx-auto"><div id="flujo-proyectos"></div></div>`;
  montarLista(document.getElementById('flujo-proyectos'));
}
