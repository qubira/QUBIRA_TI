/* El login de credenciales central vive en LOGIN/login.html — esta
   ruta ya no muestra un formulario propio, solo redirige ahí. Llegar
   aquí significa que no hay sesión local válida ni un traspaso
   (?handoff=) en curso (eso lo maneja app.js antes de enrutar). */

const CENTRAL_LOGIN_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:5515/login.html'
  : 'https://qubira-login.vercel.app/login.html';

export function render() {
  const main = document.getElementById('main');
  main.innerHTML = `
  <div style="min-height:100%;display:grid;place-items:center;font-family:'Inter','Segoe UI',sans-serif;color:#6b7280;">
    <p>Redirigiendo al acceso central de Qubira…</p>
  </div>`;
  window.location.href = CENTRAL_LOGIN_URL;
}
