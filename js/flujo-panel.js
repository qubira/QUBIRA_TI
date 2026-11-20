/* Flujo de proyectos: etapas y puertas (componente compartido de la API) */
const token = () => localStorage.getItem('token');
function cuandoListo(el, fn) {
  if (window.qbFlujo) return fn();
  if (el) el.textContent = 'Cargando el flujo del proyecto…';
  document.addEventListener('qb-flujo-listo', fn, { once: true });
}
export function montarLista(el) { cuandoListo(el, () => window.qbFlujo.lista(el, { token })); }
export function montarDetalle(el, id) { cuandoListo(el, () => window.qbFlujo.detalle(el, { token, id })); }
/* Tablero Scrum del proyecto */
export function montarScrum(el, id) {
  const dibujar = () => window.qbScrum.render(el, { token, id });
  if (window.qbScrum) return dibujar();
  el.textContent = 'Cargando el tablero Scrum…';
  document.addEventListener('qb-scrum-listo', dibujar, { once: true });
}
