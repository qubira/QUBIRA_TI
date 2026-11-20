/* Casos de soporte derivados (componente compartido de la API) */
export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `<div class="p-6 max-w-6xl mx-auto"><div id="casos-derivados"></div></div>`;
  const el = document.getElementById('casos-derivados');
  const dibujar = () => window.qbCasos.render(el, { token: () => localStorage.getItem('token') });
  if (window.qbCasos) dibujar();
  else { el.textContent = 'Cargando los casos…'; document.addEventListener('qb-casos-listo', dibujar, { once: true }); }
}
