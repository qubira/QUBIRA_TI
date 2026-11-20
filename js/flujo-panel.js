/* Flujo de proyectos: etapas y puertas (componente compartido de la API) */
const token = () => localStorage.getItem('token');
function cuandoListo(el, fn) {
  if (window.qbFlujo) return fn();
  if (el) el.textContent = 'Cargando el flujo del proyecto…';
  document.addEventListener('qb-flujo-listo', fn, { once: true });
}
export function montarLista(el) { cuandoListo(el, () => window.qbFlujo.lista(el, { token })); }
export function montarDetalle(el, id) { cuandoListo(el, () => window.qbFlujo.detalle(el, { token, id })); }
